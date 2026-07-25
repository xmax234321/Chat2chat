const http = require('http');
const os = require('os');
const { WebSocketServer } = require('ws');
const { ipcMain, BrowserWindow } = require('electron');

const SERVICE_UUID = 'c2c0d001-0000-4000-8000-0000c2c00001';
const RX_UUID = 'c2c0d002-0000-4000-8000-0000c2c00002';
const TX_UUID = 'c2c0d003-0000-4000-8000-0000c2c00003';

let bleno = null;
try {
  bleno = require('@abandonware/bleno');
} catch {
  bleno = null;
}

let httpServer = null;
let wss = null;
let activeToken = null;
let linkSessionActive = false;
let blePeripheral = null;
let bleTxCharacteristic = null;
let bleRxBuffer = [];
let paired = false;
const linkClients = { phone: null, desktop: null };
let phoneHeartbeat = null;
let phoneLastPong = 0;
const PHONE_PING_MS = 8000;
const PHONE_PONG_TIMEOUT_MS = 20000;

function clearPhoneHeartbeat() {
  if (phoneHeartbeat) {
    clearInterval(phoneHeartbeat);
    phoneHeartbeat = null;
  }
}

function markPhoneOffline() {
  clearPhoneHeartbeat();
  if (linkClients.phone) {
    linkClients.phone = null;
    broadcast('desktop-link:phone-online', false);
  }
}

function startPhoneHeartbeat(socket) {
  clearPhoneHeartbeat();
  phoneLastPong = Date.now();
  phoneHeartbeat = setInterval(() => {
    if (!linkClients.phone || linkClients.phone.readyState !== 1) {
      markPhoneOffline();
      return;
    }
    if (Date.now() - phoneLastPong > PHONE_PONG_TIMEOUT_MS) {
      try {
        linkClients.phone.terminate();
      } catch {
        /* ignore */
      }
      markPhoneOffline();
      return;
    }
    linkClients.phone.send(JSON.stringify({ type: 'ping' }));
  }, PHONE_PING_MS);
}

function lanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

function decodeFrame(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function handleBleChunk(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.kind === 'chunk') {
      bleRxBuffer[parsed.index ?? bleRxBuffer.length] = parsed.data;
      if (bleRxBuffer.filter(Boolean).length === parsed.total) {
        const assembled = bleRxBuffer.join('');
        bleRxBuffer = [];
        const json = Buffer.from(assembled, 'base64').toString('utf8');
        broadcast('desktop-link:ble-message', json);
      }
      return;
    }
  } catch {
    /* fall through */
  }
  broadcast('desktop-link:ble-message', raw);
}

function notifyBle(value) {
  if (!bleTxCharacteristic) return;
  const b64 = Buffer.from(value, 'utf8').toString('base64');
  const total = Math.max(1, Math.ceil(b64.length / 160));
  for (let index = 0, offset = 0; offset < b64.length; index++, offset += 160) {
    const chunk = JSON.stringify({
      kind: 'chunk',
      index,
      total,
      data: b64.slice(offset, offset + 160),
    });
    bleTxCharacteristic.updateValue(Buffer.from(chunk, 'utf8'));
  }
}

function startBle() {
  if (!bleno) return;

  const { PrimaryService, Characteristic } = bleno;

  bleTxCharacteristic = new Characteristic({
    uuid: TX_UUID,
    properties: ['notify'],
    onSubscribe: () => {},
    onUnsubscribe: () => {},
  });

  const rxCharacteristic = new Characteristic({
    uuid: RX_UUID,
    properties: ['write', 'writeWithoutResponse'],
    onWrite: (data) => {
      handleBleChunk(data.toString('utf8'));
    },
  });

  blePeripheral = {
    uuid: SERVICE_UUID,
    characteristics: [rxCharacteristic, bleTxCharacteristic],
  };

  bleno.on('stateChange', (state) => {
    if (state === 'poweredOn') {
      bleno.startAdvertising('Chat2Chat', [SERVICE_UUID], (err) => {
        if (err) console.error('BLE advertise error', err);
      });
    }
  });

  bleno.on('advertisingStart', (err) => {
    if (err) {
      console.error('BLE advertisingStart', err);
      return;
    }
    bleno.setServices([blePeripheral], (setErr) => {
      if (setErr) console.error('BLE setServices', setErr);
    });
  });

  bleno.on('accept', () => {
    paired = true;
    broadcast('desktop-link:phone-online', true);
  });

  bleno.on('disconnect', () => {
    paired = false;
    markPhoneOffline();
  });
}

function stopBle() {
  if (!bleno) return;
  try {
    bleno.stopAdvertising();
  } catch {
    /* ignore */
  }
  blePeripheral = null;
  bleTxCharacteristic = null;
  bleRxBuffer = [];
}

function stopServers(force = false) {
  if (linkSessionActive && !force) return;
  if (wss) {
    wss.close();
    wss = null;
  }
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
  activeToken = null;
  linkSessionActive = false;
  paired = false;
  linkClients.phone = null;
  linkClients.desktop = null;
  clearPhoneHeartbeat();
  stopBle();
}

function startServers(offer, { pairing = true } = {}) {
  if (linkSessionActive && httpServer) {
    return Promise.resolve({ host: lanIp(), port: offer.port });
  }
  stopServers(true);
  activeToken = offer.token;
  if (!pairing) linkSessionActive = true;

  httpServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/pair') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (!parsed.token || parsed.token !== activeToken) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Invalid or expired link token' }));
            return;
          }
          broadcast('desktop-link:paired', { token: parsed.token, bundle: parsed.bundle });
          linkSessionActive = true;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: e instanceof Error ? e.message : 'Bad request' }));
        }
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  wss = new WebSocketServer({ server: httpServer });
  wss.on('connection', (socket) => {
    socket.on('message', (data) => {
      const frame = decodeFrame(String(data));
      if (!frame) return;
      if (frame.type === 'link_register') {
        if (frame.token !== activeToken) return;
        if (frame.role === 'phone') {
          linkClients.phone = socket;
          phoneLastPong = Date.now();
          startPhoneHeartbeat(socket);
          broadcast('desktop-link:phone-online', true);
        }
        return;
      }
      if (frame.type === 'pong') {
        phoneLastPong = Date.now();
        return;
      }
      if (frame.type === 'link_frame') {
        if (frame.from === 'phone') {
          broadcast('desktop-link:ble-message', frame.payload);
          if (linkClients.desktop?.readyState === 1) {
            linkClients.desktop.send(JSON.stringify({ type: 'link_frame', payload: frame.payload }));
          }
        }
        return;
      }
      if (frame.type === 'ping') socket.send(JSON.stringify({ type: 'pong' }));
    });
    socket.on('close', () => {
      if (linkClients.phone === socket) {
        markPhoneOffline();
      }
    });
  });

  return new Promise((resolve, reject) => {
    httpServer.listen(offer.port, '0.0.0.0', () => {
      startBle();
      resolve({ host: lanIp(), port: offer.port });
    });
    httpServer.on('error', reject);
  });
}

function registerDesktopLinkIpc() {
  ipcMain.handle('desktop-link:start', async (_event, offer) => {
    const started = await startServers(offer, { pairing: true });
    return started;
  });

  ipcMain.handle('desktop-link:start-session', async (_event, offer) => {
    const started = await startServers(offer, { pairing: false });
    return started;
  });

  ipcMain.handle('desktop-link:stop', async (_event, options) => {
    stopServers(Boolean(options?.force));
    return { ok: true };
  });

  ipcMain.handle('desktop-link:send-ble', async (_event, frame) => {
    notifyBle(frame);
    if (linkClients.phone?.readyState === 1) {
      linkClients.phone.send(JSON.stringify({ type: 'link_frame', payload: frame }));
    }
    return { ok: true };
  });
}

module.exports = {
  registerDesktopLinkIpc,
  stopServers,
};
