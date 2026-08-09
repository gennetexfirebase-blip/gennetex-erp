function inspect(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

module.exports = {
  inspect,
  inherits: (ctor, superCtor) => {
    ctor.super_ = superCtor;
    Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
  },
  deprecate: (fn) => fn,
  format: (...args) => args.map(String).join(' '),
  TextEncoder: global.TextEncoder,
  TextDecoder: global.TextDecoder,
};
