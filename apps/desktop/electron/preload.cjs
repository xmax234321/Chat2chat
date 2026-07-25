const { contextBridge, ipcRenderer } = require('electron');

const SERVER_WS = process.env.CHAT2CHAT_SERVER_WS || 'wss://api.chat2chat.org/ws';
const SERVER_HTTP = process.env.CHAT2CHAT_SERVER_HTTP || 'https://api.chat2chat.org';

contextBridge.exposeInMainWorld('chat2chat', {
  isElectron: true,
  platform: process.platform,
  serverWs: SERVER_WS,
  serverHttp: SERVER_HTTP,
  desktopLink: {
    start: (offer) => ipcRenderer.invoke('desktop-link:start', offer),
    startSession: (offer) => ipcRenderer.invoke('desktop-link:start-session', offer),
    stop: (options) => ipcRenderer.invoke('desktop-link:stop', options),
    sendBle: (frame) => ipcRenderer.invoke('desktop-link:send-ble', frame),
    onPaired: (cb) => {
      const listener = (_event, data) => cb(data);
      ipcRenderer.on('desktop-link:paired', listener);
      return () => ipcRenderer.removeListener('desktop-link:paired', listener);
    },
    onBleMessage: (cb) => {
      const listener = (_event, frame) => cb(frame);
      ipcRenderer.on('desktop-link:ble-message', listener);
      return () => ipcRenderer.removeListener('desktop-link:ble-message', listener);
    },
    onPhoneOnline: (cb) => {
      const listener = (_event, online) => cb(online);
      ipcRenderer.on('desktop-link:phone-online', listener);
      return () => ipcRenderer.removeListener('desktop-link:phone-online', listener);
    },
  },
  saveBackup: (options) => ipcRenderer.invoke('backup:save', options),
  openBackup: () => ipcRenderer.invoke('backup:open'),
});
