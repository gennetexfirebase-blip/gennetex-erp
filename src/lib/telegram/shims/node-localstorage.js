/**
 * node-localstorage-ийн орлуулга. GramJS-ийн StoreSession үүнийг extend хийдэг тул
 * бодит класс хэрэгтэй (undefined бол `class extends undefined` алдаа өгнө).
 * Бид StringSession ашигладаг тул эдгээр метод бодитоор дуудагдахгүй.
 */
class LocalStorage {
  constructor() {
    this._data = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null;
  }
  setItem(key, value) {
    this._data[key] = String(value);
  }
  removeItem(key) {
    delete this._data[key];
  }
  clear() {
    this._data = {};
  }
  get length() {
    return Object.keys(this._data).length;
  }
  key(i) {
    const keys = Object.keys(this._data);
    return i < keys.length ? keys[i] : null;
  }
}

module.exports = { LocalStorage, JSONStorage: LocalStorage };
