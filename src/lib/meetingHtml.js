/**
 * Өөрийн WebRTC live/хурал UI (гадны meet сервис ашиглахгүй).
 * Host: камер автоматаар, дэлгэц share сонголттой.
 * Signaling: Supabase Realtime broadcast.
 */
export function buildMeetingHtml({
  supabaseUrl,
  supabaseKey,
  meetingId,
  name,
  role = 'viewer',
  enableScreenShare = false,
}) {
  const safeName = String(name || 'Ажилтан').replace(/[<>"'\\]/g, '');
  const safeId = String(meetingId || '').replace(/[^a-zA-Z0-9-]/g, '');
  const isHost = role === 'host';
  const allowShare = isHost && enableScreenShare;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <style>
    *{box-sizing:border-box}
    html,body{margin:0;height:100%;background:#0b0f1a;color:#fff;font-family:system-ui,-apple-system,sans-serif}
    #app{display:flex;flex-direction:column;height:100%}
    .stage{flex:1;display:flex;align-items:center;justify-content:center;position:relative;background:#000}
    video{width:100%;height:100%;object-fit:cover;background:#000}
    .status{position:absolute;left:12px;right:12px;bottom:16px;text-align:center;color:#94a3b8;font-size:13px;text-shadow:0 1px 3px #000}
    .host-actions{display:none;padding:10px 12px;background:#111827;gap:8px;justify-content:center;flex-wrap:wrap}
    .host-actions.show{display:flex}
    .btn{border:0;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer;color:#fff}
    .btn-primary{background:#4f6ef7}
    .btn-secondary{background:#333}
  </style>
</head>
<body>
  <div id="app">
    <div class="stage">
      <video id="video" autoplay playsinline ${isHost ? 'muted' : ''}></video>
      <div class="status" id="status">Холбогдож байна...</div>
    </div>
    <div class="host-actions${allowShare ? ' show' : ''}" id="hostActions">
      ${allowShare ? '<button class="btn btn-secondary" id="shareBtn">Дэлгэц share</button>' : ''}
    </div>
    <button id="leaveBtn" style="display:none"></button>
    <div id="peers" style="display:none"></div>
  </div>
  <script>
    const SUPABASE_URL = ${JSON.stringify(supabaseUrl)};
    const SUPABASE_KEY = ${JSON.stringify(supabaseKey)};
    const MEETING_ID = ${JSON.stringify(safeId)};
    const DISPLAY_NAME = ${JSON.stringify(safeName)};
    const IS_HOST = ${isHost ? 'true' : 'false'};
    const MY_ID = IS_HOST ? 'host' : ('p_' + Math.random().toString(36).slice(2) + Date.now().toString(36));

    const video = document.getElementById('video');
    const statusEl = document.getElementById('status');
    const peersEl = document.getElementById('peers');
    const setStatus = (t) => { statusEl.textContent = t || ''; };
    const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const channel = sb.channel('meeting-' + MEETING_ID, { config: { broadcast: { self: false } } });
    const peers = new Map();
    let localStream = null;
    let ended = false;

    function postClose() {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('close');
    }
    function send(payload) {
      channel.send({ type: 'broadcast', event: 'signal', payload });
    }
    function updatePeerCount() {
      if (!IS_HOST || !peersEl) return;
      peersEl.textContent = 'Оролцогч: ' + peers.size;
    }
    function createPc(peerId) {
      const pc = new RTCPeerConnection(ICE);
      pc.onicecandidate = (e) => {
        if (e.candidate) send({ type: 'ice', from: MY_ID, to: peerId, candidate: e.candidate });
      };
      pc.onconnectionstatechange = () => {
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          peers.delete(peerId);
          updatePeerCount();
        }
      };
      if (!IS_HOST) {
        pc.ontrack = (e) => {
          video.srcObject = e.streams[0];
          setStatus('');
        };
      }
      peers.set(peerId, pc);
      updatePeerCount();
      return pc;
    }
    async function hostAddPeer(peerId) {
      if (!localStream) {
        setStatus('Камер/share бэлэн биш');
        return;
      }
      let pc = peers.get(peerId);
      if (pc) { try { pc.close(); } catch (e) {} peers.delete(peerId); }
      pc = createPc(peerId);
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ type: 'offer', from: 'host', to: peerId, sdp: offer });
    }
    async function republishAll() {
      send({ type: 'host-ready', from: 'host' });
      const ids = [...peers.keys()];
      for (const peerId of ids) {
        try { await hostAddPeer(peerId); } catch (e) {}
      }
    }
    async function handleSignal(msg) {
      if (!msg || ended) return;
      if (msg.to && msg.to !== MY_ID && msg.to !== '*') return;
      if (msg.type === 'join' && IS_HOST) { await hostAddPeer(msg.from); return; }
      if (msg.type === 'host-ready' && !IS_HOST) {
        send({ type: 'join', from: MY_ID, name: DISPLAY_NAME });
        return;
      }
      if (msg.type === 'offer' && !IS_HOST && msg.to === MY_ID) {
        let pc = peers.get('host');
        if (pc) { try { pc.close(); } catch (e) {} }
        pc = createPc('host');
        await pc.setRemoteDescription(msg.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ type: 'answer', from: MY_ID, to: 'host', sdp: answer });
        setStatus('Холбогдлоо');
        return;
      }
      if (msg.type === 'answer' && IS_HOST && msg.to === 'host') {
        const pc = peers.get(msg.from);
        if (pc) await pc.setRemoteDescription(msg.sdp);
        return;
      }
      if (msg.type === 'ice') {
        const key = IS_HOST ? msg.from : 'host';
        const pc = peers.get(key);
        if (pc && msg.candidate) { try { await pc.addIceCandidate(msg.candidate); } catch (e) {} }
        return;
      }
      if (msg.type === 'leave' && IS_HOST) {
        const pc = peers.get(msg.from);
        if (pc) { try { pc.close(); } catch (e) {} peers.delete(msg.from); updatePeerCount(); }
        return;
      }
      if (msg.type === 'ended' && !IS_HOST) {
        setStatus('Live дууслаа');
        ended = true;
        setTimeout(postClose, 800);
      }
    }
    function stopLocal() {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
        localStream = null;
      }
    }
    function ensureMediaDevices() {
      if (!navigator.mediaDevices) navigator.mediaDevices = {};
      if (!navigator.mediaDevices.getUserMedia) {
        const legacy = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        if (!legacy) return false;
        navigator.mediaDevices.getUserMedia = (constraints) =>
          new Promise((resolve, reject) => legacy.call(navigator, constraints, resolve, reject));
      }
      return typeof navigator.mediaDevices.getUserMedia === 'function';
    }

    async function getCamStream() {
      const attempts = [
        { video: { facingMode: 'user' }, audio: true },
        { video: true, audio: true },
        { video: { facingMode: 'environment' }, audio: true },
        { video: true, audio: false },
      ];
      let lastErr;
      for (const c of attempts) {
        try {
          return await navigator.mediaDevices.getUserMedia(c);
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr || new Error('getUserMedia failed');
    }

    async function startCamera() {
      try {
        stopLocal();
        if (!ensureMediaDevices()) {
          setStatus('Энэ төхөөрөмж камер дэмжихгүй');
          if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('camera-error');
          return;
        }
        localStream = await getCamStream();
        video.srcObject = localStream;
        video.muted = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        try { await video.play(); } catch (e) {}
        setStatus('Live — камер асаалттай');
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('camera-on');
        await republishAll();
      } catch (e) {
        setStatus('Камер нээгдсэнгүй: ' + (e.name || '') + ' ' + (e.message || e));
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('camera-error');
      }
    }
    async function startShare() {
      try {
        stopLocal();
        localStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 15 },
          audio: true,
        });
        video.srcObject = localStream;
        video.muted = true;
        try { await video.play(); } catch (e) {}
        setStatus('Дэлгэц share хийгдэж байна');
        localStream.getVideoTracks()[0].onended = () => {
          setStatus('Share зогссон — камер руу шилжиж байна');
          startCamera();
        };
        await republishAll();
      } catch (e) {
        setStatus('Дэлгэц share амжилтгүй: ' + (e.message || e));
        startCamera();
      }
    }
    window.startCamera = startCamera;
    window.startShare = startShare;
    async function endMeeting() {
      ended = true;
      send({ type: 'ended', from: 'host' });
      peers.forEach((pc) => { try { pc.close(); } catch (e) {} });
      peers.clear();
      stopLocal();
      try {
        await sb.from('meetings').update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('id', MEETING_ID).eq('status', 'active');
      } catch (e) {}
      postClose();
    }
    function leave() {
      if (IS_HOST) return endMeeting();
      send({ type: 'leave', from: MY_ID });
      peers.forEach((pc) => { try { pc.close(); } catch (e) {} });
      postClose();
    }
    document.getElementById('leaveBtn').onclick = leave;
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) shareBtn.onclick = startShare;
    channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => handleSignal(payload))
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        if (IS_HOST) {
          setStatus('Камер + микрофон асааж байна...');
          startCamera();
          setTimeout(function () { try { startCamera(); } catch (e) {} }, 500);
        } else {
          setStatus('Холбогдож байна...');
          send({ type: 'join', from: MY_ID, name: DISPLAY_NAME });
          setTimeout(() => { if (!ended) send({ type: 'join', from: MY_ID, name: DISPLAY_NAME }); }, 2000);
        }
      });
  </script>
</body>
</html>`;
}
