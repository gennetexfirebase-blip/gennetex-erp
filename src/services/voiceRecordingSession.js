import { requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';

export const VOICE_PLAYBACK_MODE = {
  allowsRecording: false, playsInSilentMode: true,
  shouldRouteThroughEarpiece: false, interruptionMode: 'doNotMix',
};

/** One press owns one recording, including asynchronous permission/preparation. */
export function createVoiceRecordingSession({ recorder, onRecording, onSend, onError }) {
  let held = false, busy = false, recording = false, disposed = false;

  const release = async (cancel = false) => {
    held = false;
    if (!recording) return;
    recording = false;
    busy = true;
    let stopped = false;
    try {
      const durationMs = recorder.getStatus().durationMillis;
      await recorder.stop();
      stopped = true;
      if (!disposed) onRecording(false);
      const uri = recorder.uri;
      await setAudioModeAsync(VOICE_PLAYBACK_MODE);
      if (!disposed && !cancel && durationMs >= 700) {
        if (!uri) throw new Error('Дууны файл үүссэнгүй. Дахин бичнэ үү.');
        await onSend({ uri, durationMs });
      }
    } catch (error) {
      if (!disposed) onError(error);
    } finally {
      if (!stopped) await recorder.stop().catch(() => {});
      await setAudioModeAsync(VOICE_PLAYBACK_MODE).catch(() => {});
      busy = false;
      if (!disposed) onRecording(false);
    }
  };

  return {
    async start() {
      if (busy || recording || disposed) return;
      held = true;
      busy = true;
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!held || disposed) return;
        if (!permission.granted) throw new Error('Дуут мессеж бичихийн тулд микрофоны зөвшөөрөл өгнө үү.');
        await setAudioModeAsync({ ...VOICE_PLAYBACK_MODE, allowsRecording: true });
        if (!held || disposed) return;
        await recorder.prepareToRecordAsync();
        if (!held || disposed) {
          await recorder.stop();
          return;
        }
        recorder.record();
        recording = true;
        onRecording(true);
      } catch (error) {
        recording = false;
        await recorder.stop().catch(() => {});
        if (!disposed) onError(error);
      } finally {
        busy = false;
        if (!recording) await setAudioModeAsync(VOICE_PLAYBACK_MODE).catch(() => {});
      }
    },
    release,
    dispose() { disposed = true; return release(true); },
  };
}
