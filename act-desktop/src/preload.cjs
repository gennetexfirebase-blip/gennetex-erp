const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('gennetexDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,
}));
