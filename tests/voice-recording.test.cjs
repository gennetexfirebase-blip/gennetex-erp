const test = require('node:test');
const assert = require('node:assert/strict');
const createLoader = require('./helpers/load-app-module.cjs');

function setup(options = {}) {
  const events = [], clips = [], errors = [];
  const recorder = {
    uri: 'file:///voice.m4a',
    prepareToRecordAsync: async () => { events.push('prepare'); await options.preparing; },
    record: () => events.push('record'),
    getStatus: () => ({ durationMillis: options.duration ?? 2200 }),
    stop: async () => { events.push('stop'); },
  };
  const load = createLoader({ 'expo-audio': {
    requestRecordingPermissionsAsync: async () => { await options.permission; return { granted: options.granted !== false }; },
    setAudioModeAsync: async mode => events.push(mode.allowsRecording ? 'recording-mode' : 'speaker-mode'),
  } });
  const { createVoiceRecordingSession } = load('src/services/voiceRecordingSession.js');
  const session = createVoiceRecordingSession({ recorder, onRecording() {}, onSend: clip => clips.push(clip), onError: error => errors.push(error) });
  return { session, events, clips, errors };
}

test('voice recording stops and resets speaker route before sending actual duration', async () => {
  const h = setup();
  await h.session.start();
  await h.session.release();
  assert.equal(h.clips[0].durationMs, 2200);
  assert.ok(h.events.indexOf('stop') < h.events.indexOf('speaker-mode'));
  assert.equal(h.events.at(-1), 'speaker-mode');
});

test('release before permission response never starts microphone', async () => {
  let allow;
  const h = setup({ permission: new Promise(resolve => { allow = resolve; }) });
  const pending = h.session.start();
  await h.session.release();
  allow(); await pending;
  assert.equal(h.events.includes('record'), false);
  assert.equal(h.clips.length, 0);
});

test('release during preparation stops prepared recorder without sending', async () => {
  let prepared;
  const h = setup({ preparing: new Promise(resolve => { prepared = resolve; }) });
  const pending = h.session.start();
  while (!h.events.includes('prepare')) await new Promise(resolve => setImmediate(resolve));
  await h.session.release();
  prepared(); await pending;
  assert.equal(h.events.includes('record'), false);
  assert.ok(h.events.includes('stop'));
  assert.equal(h.clips.length, 0);
});

test('permission denial is explained without recording', async () => {
  const h = setup({ granted: false });
  await h.session.start();
  assert.equal(h.errors.length, 1);
  assert.equal(h.events.includes('record'), false);
});

test('cancel, unmount and accidental short recordings never send', async () => {
  for (const kind of ['cancel', 'unmount', 'short']) {
    const h = setup({ duration: kind === 'short' ? 200 : 2000 });
    await h.session.start();
    if (kind === 'unmount') await h.session.dispose();
    else await h.session.release(kind === 'cancel');
    assert.equal(h.clips.length, 0);
    assert.ok(h.events.includes('stop'));
  }
});

test('native audio upload uses actual bytes and rejects empty recordings', async () => {
  let uploaded;
  const load = createLoader({
    'react-native': { Platform: { OS: 'android' } },
    'expo-file-system/legacy': { EncodingType: { Base64: 'base64' },
      getInfoAsync: async uri => ({ exists: true, size: uri.includes('empty') ? 0 : 3 }),
      readAsStringAsync: async () => Buffer.from([1, 2, 3]).toString('base64') },
    'base64-arraybuffer': { decode: value => Uint8Array.from(Buffer.from(value, 'base64')).buffer },
    '../lib/supabase': { supabase: { storage: { from: () => ({
      upload: async (path, bytes, options) => { uploaded = { bytes, options }; return { error: null }; },
      getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/voice.m4a' } }),
    }) } } },
    '../lib/realtimeChannel': {}, './notificationService': {},
  });
  const service = load('src/services/chatService.js');
  await service.uploadChatFile('file:///voice.m4a', { name: 'voice.m4a', mimeType: 'audio/mp4' });
  assert.deepEqual([...new Uint8Array(uploaded.bytes)], [1, 2, 3]);
  assert.equal(uploaded.options.contentType, 'audio/mp4');
  await assert.rejects(() => service.uploadChatFile('file:///empty.m4a'));
});
