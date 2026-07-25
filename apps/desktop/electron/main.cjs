const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { registerDesktopLinkIpc, stopServers } = require('./desktop-link.cjs');

const isDev = !app.isPackaged;
const SERVER_WS = process.env.CHAT2CHAT_SERVER_WS || 'wss://api.chat2chat.org/ws';
const SERVER_HTTP = process.env.CHAT2CHAT_SERVER_HTTP || 'https://api.chat2chat.org';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Chat2Chat',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#0B0B0C',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../web-dist/index.html'));
  }
}

function registerBackupIpc() {
  ipcMain.handle('backup:save', async (event, { defaultPath, content }) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) ||
      BrowserWindow.getFocusedWindow() ||
      BrowserWindow.getAllWindows()[0];
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Save Chat2Chat backup',
      defaultPath,
      filters: [{ name: 'Chat2Chat Backup', extensions: ['json', 'c2backup.json'] }],
    });
    if (canceled || !filePath) return { canceled: true };
    await fs.writeFile(filePath, content, 'utf8');
    return { canceled: false, filePath };
  });

  ipcMain.handle('backup:open', async (event) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) ||
      BrowserWindow.getFocusedWindow() ||
      BrowserWindow.getAllWindows()[0];
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Open Chat2Chat backup',
      filters: [
        {
          name: 'Chat2Chat Backup',
          extensions: ['json', 'c2backup.json', 'zip', 'c2backup.zip'],
        },
      ],
      properties: ['openFile'],
    });
    if (canceled || !filePaths?.[0]) return { canceled: true };
    const filePath = filePaths[0];
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.zip') || lower.endsWith('.c2backup.zip')) {
      const buffer = await fs.readFile(filePath);
      return { canceled: false, filePath, zipBytes: buffer.toString('base64') };
    }
    const content = await fs.readFile(filePath, 'utf8');
    return { canceled: false, filePath, content };
  });
}

app.whenReady().then(() => {
  registerDesktopLinkIpc();
  registerBackupIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopServers(true);
  if (process.platform !== 'darwin') app.quit();
});
