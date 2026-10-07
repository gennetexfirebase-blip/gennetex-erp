const { app, BrowserWindow, Menu, Notification, session, shell } = require('electron');
const path = require('node:path');

const APP_URL = process.env.GENNETEX_ACT_URL || 'https://akt.gennetex.com';
const APP_ORIGIN = new URL(APP_URL).origin;
const SUPABASE_HOST = 'zkftykocmqzrgdhgwluu.supabase.co';
const SESSION_PARTITION = 'persist:gennetex-acts';

app.setAppUserModelId('mn.gennetex.acts');

function iconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '..', '..', 'assets', 'icon.png');
}

function isTrustedNavigation(rawUrl) {
  if (rawUrl.startsWith('file://') && rawUrl.includes('offline.html')) return true;
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    return url.origin === APP_ORIGIN
      || host === SUPABASE_HOST
      || host === 'google.com'
      || host.endsWith('.google.com')
      || host.endsWith('.googleusercontent.com');
  } catch {
    return false;
  }
}

function createWindow() {
  const window = new BrowserWindow({
    title: 'Gennetex Акт',
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: '#f4f6f8',
    icon: iconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      partition: SESSION_PARTITION,
    },
  });

  window.once('ready-to-show', () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedNavigation(url)) return { action: 'allow' };
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (isTrustedNavigation(url)) return;
    event.preventDefault();
    void shell.openExternal(url);
  });

  window.webContents.on('did-fail-load', (_event, errorCode, _description, validatedUrl, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    const offlinePath = path.join(__dirname, 'offline.html');
    const retryUrl = `${APP_URL}?desktopRetry=${Date.now()}`;
    void window.loadFile(offlinePath, { query: { retry: retryUrl, failed: validatedUrl || APP_URL } });
  });

  window.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      event.preventDefault();
      void window.loadURL(APP_URL);
    }
  });

  void window.loadURL(APP_URL);
  return window;
}

const singleInstance = app.requestSingleInstanceLock();

if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    const appSession = session.fromPartition(SESSION_PARTITION);
    appSession.setDownloadPath(app.getPath('downloads'));
    appSession.on('will-download', (_event, item) => {
      item.once('done', (_doneEvent, state) => {
        if (state !== 'completed' || !Notification.isSupported()) return;
        new Notification({
          title: 'Gennetex Акт',
          body: `${item.getFilename()} файл татагдлаа.`,
          icon: iconPath(),
        }).show();
      });
    });
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
