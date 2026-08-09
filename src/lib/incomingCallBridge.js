/** Native дуудлагын answer/decline → IncomingCallManager холбох */
const listeners = new Set();

export const incomingCallBridge = {
  subscribe(handler) {
    listeners.add(handler);
    return () => listeners.delete(handler);
  },
  emitAnswer(data) {
    listeners.forEach((fn) => fn({ type: 'answer', data }));
  },
  emitDecline(data) {
    listeners.forEach((fn) => fn({ type: 'decline', data }));
  },
  emitTimeout(data) {
    listeners.forEach((fn) => fn({ type: 'timeout', data }));
  },
};
