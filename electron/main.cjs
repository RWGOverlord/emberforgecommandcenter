const { app, BrowserWindow, globalShortcut, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');
const { randomUUID } = require('crypto');
const Store = require('electron-store');
const chokidar = require('chokidar');

// ─── WhatsApp state ───────────────────────────────────────────────────────────
let waSocket   = null;
let waStatus   = 'disconnected'; // 'disconnected' | 'qr' | 'connecting' | 'connected'
let waChats    = [];
let waMessages = {};  // jid → Message[]
let waAuthDir  = null;

const waLogger = {
  level: 'silent',
  trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {},
  child() { return waLogger; },
};

function mapWaChat(c) {
  return {
    id: c.id,
    name: c.name || c.id.split('@')[0] || 'Unknown',
    snippet: c.lastMessage?.message?.conversation
          || c.lastMessage?.message?.extendedTextMessage?.text
          || '',
    timestamp: (c.conversationTimestamp || 0) * 1000,
    unread: (c.unreadCount || 0) > 0,
  };
}

function mapWaMessage(m) {
  const body = m.message?.conversation
            || m.message?.extendedTextMessage?.text
            || m.message?.imageMessage?.caption
            || '[media]';
  return {
    id: m.key.id,
    body,
    timestamp: (m.messageTimestamp || 0) * 1000,
    direction: m.key.fromMe ? 'outbound' : 'inbound',
  };
}

async function startWhatsApp() {
  if (waSocket) return;
  waStatus = 'connecting';
  if (win && !win.isDestroyed()) win.webContents.send('wa:status', 'connecting');

  try {
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = await import('@whiskeysockets/baileys');
    const QRCode = await import('qrcode');

    const { state, saveCreds } = await useMultiFileAuthState(waAuthDir);
    let version;
    try { ({ version } = await fetchLatestBaileysVersion()); } catch { version = [2, 3000, 1015901307]; }

    waSocket = makeWASocket({
      version,
      auth: state,
      logger: waLogger,
      printQRInTerminal: false,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
    });

    waSocket.ev.on('creds.update', saveCreds);

    waSocket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        waStatus = 'qr';
        const dataUrl = await QRCode.default.toDataURL(qr, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
        if (win && !win.isDestroyed()) {
          win.webContents.send('wa:status', 'qr');
          win.webContents.send('wa:qr', dataUrl);
        }
      }
      if (connection === 'open') {
        waStatus = 'connected';
        if (win && !win.isDestroyed()) win.webContents.send('wa:status', 'connected');
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason?.loggedOut;
        waSocket = null;
        waStatus = 'disconnected';
        if (win && !win.isDestroyed()) win.webContents.send('wa:status', 'disconnected');
        if (!loggedOut) setTimeout(startWhatsApp, 5000);
      }
    });

    waSocket.ev.on('messaging-history.set', ({ chats }) => {
      waChats = chats.map(mapWaChat).sort((a, b) => b.timestamp - a.timestamp).slice(0, 60);
      if (win && !win.isDestroyed()) win.webContents.send('wa:chatsUpdated', waChats);
    });

    waSocket.ev.on('chats.upsert', (newChats) => {
      for (const c of newChats) {
        const idx = waChats.findIndex(x => x.id === c.id);
        const mapped = mapWaChat(c);
        if (idx >= 0) waChats[idx] = mapped;
        else waChats.unshift(mapped);
      }
      waChats.sort((a, b) => b.timestamp - a.timestamp);
      if (win && !win.isDestroyed()) win.webContents.send('wa:chatsUpdated', waChats);
    });

    waSocket.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const m of messages) {
        const jid = m.key.remoteJid;
        if (!jid) continue;
        if (!waMessages[jid]) waMessages[jid] = [];
        waMessages[jid].push(mapWaMessage(m));
        if (win && !win.isDestroyed()) win.webContents.send('wa:messagesUpdated', { jid, messages: waMessages[jid] });
        // Update snippet in chat list
        const chat = waChats.find(c => c.id === jid);
        if (chat) { chat.snippet = mapWaMessage(m).body; chat.timestamp = Date.now(); }
        waChats.sort((a, b) => b.timestamp - a.timestamp);
        if (win && !win.isDestroyed()) win.webContents.send('wa:chatsUpdated', waChats);
      }
    });
  } catch (err) {
    console.log('[WA] startWhatsApp error:', err.message);
    waSocket = null;
    waStatus = 'disconnected';
    if (win && !win.isDestroyed()) win.webContents.send('wa:status', 'disconnected');
  }
}

// ─── Gmail state ─────────────────────────────────────────────────────────────
const GMAIL_CREDENTIALS_PATH = path.join(__dirname, 'gmail-credentials.json');
const GMAIL_TOKEN_PATH        = path.join(__dirname, 'gmail-token.json');
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];
const GMAIL_REDIRECT_PORT = 3535;
const GMAIL_REDIRECT_URI  = `http://localhost:${GMAIL_REDIRECT_PORT}`;

let gmailStatus = 'LOADING'; // 'LOADING' | 'AUTH_REQUIRED' | 'AUTHENTICATED' | 'ERROR'
let gmailClient = null;      // google.auth.OAuth2 instance
let gmailService = null;     // googleapis gmail service

function setGmailStatus(status) {
  gmailStatus = status;
  if (win && !win.isDestroyed()) win.webContents.send('gmail:status', status);
}

async function initGmail() {
  try {
    const { google } = await import('googleapis');
    const creds = JSON.parse(fs.readFileSync(GMAIL_CREDENTIALS_PATH, 'utf-8'));
    const { client_id, client_secret } = creds.installed || creds.web;

    gmailClient = new google.auth.OAuth2(client_id, client_secret, GMAIL_REDIRECT_URI);

    if (fs.existsSync(GMAIL_TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(GMAIL_TOKEN_PATH, 'utf-8'));
      gmailClient.setCredentials(token);
      gmailService = google.gmail({ version: 'v1', auth: gmailClient });
      setGmailStatus('AUTHENTICATED');
    } else {
      setGmailStatus('AUTH_REQUIRED');
    }
  } catch (err) {
    console.log('[Gmail] initGmail error:', err.message);
    setGmailStatus('ERROR');
  }
}

async function authorizeGmail() {
  try {
    const { google } = await import('googleapis');
    const creds = JSON.parse(fs.readFileSync(GMAIL_CREDENTIALS_PATH, 'utf-8'));
    const { client_id, client_secret } = creds.installed || creds.web;

    gmailClient = new google.auth.OAuth2(client_id, client_secret, GMAIL_REDIRECT_URI);

    const authUrl = gmailClient.generateAuthUrl({
      access_type: 'offline',
      scope: GMAIL_SCOPES,
      prompt: 'consent',
    });

    shell.openExternal(authUrl);
    setGmailStatus('LOADING');

    const code = await new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const url = new URL(req.url, `http://localhost:${GMAIL_REDIRECT_PORT}`);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body style="background:#020810;color:#00ff9d;font-family:monospace;padding:40px"><h2>// GMAIL AUTHORIZED</h2><p>You can close this tab.</p></body></html>');
        server.close();
        if (error) reject(new Error(error));
        else if (code) resolve(code);
        else reject(new Error('No code returned'));
      });
      server.listen(GMAIL_REDIRECT_PORT, () => {
        console.log(`[Gmail] OAuth callback server listening on port ${GMAIL_REDIRECT_PORT}`);
      });
      server.on('error', reject);
      setTimeout(() => { server.close(); reject(new Error('OAuth timeout')); }, 5 * 60 * 1000);
    });

    const { tokens } = await gmailClient.getToken(code);
    gmailClient.setCredentials(tokens);
    fs.writeFileSync(GMAIL_TOKEN_PATH, JSON.stringify(tokens, null, 2), 'utf-8');

    gmailService = google.gmail({ version: 'v1', auth: gmailClient });
    setGmailStatus('AUTHENTICATED');
    return { success: true };
  } catch (err) {
    console.log('[Gmail] authorizeGmail error:', err.message);
    setGmailStatus('ERROR');
    return { success: false, error: err.message };
  }
}

function parseGmailHeaders(headers, ...names) {
  const result = {};
  for (const name of names) {
    const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    result[name.toLowerCase()] = h?.value || '';
  }
  return result;
}

function decodeBase64Body(data) {
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function stripHtmlTags(html) {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
             .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
             .replace(/<[^>]+>/g, '')
             .replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/\n{3,}/g, '\n\n')
             .trim();
}

function extractBodyFromParts(parts) {
  if (!parts) return '';
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) return decodeBase64Body(part.body.data);
  }
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) return stripHtmlTags(decodeBase64Body(part.body.data));
    if (part.parts) {
      const nested = extractBodyFromParts(part.parts);
      if (nested) return nested;
    }
  }
  return '';
}

function extractHtmlFromParts(parts) {
  if (!parts) return '';
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) return decodeBase64Body(part.body.data);
    if (part.parts) {
      const nested = extractHtmlFromParts(part.parts);
      if (nested) return nested;
    }
  }
  return '';
}

function collectInlineImages(parts, result = []) {
  if (!parts) return result;
  for (const part of parts) {
    if (part.mimeType?.startsWith('image/') && part.body?.attachmentId) {
      const cidHeader = (part.headers || []).find(h => h.name.toLowerCase() === 'content-id');
      if (cidHeader) {
        result.push({
          cid: cidHeader.value.replace(/[<>]/g, '').trim(),
          attachmentId: part.body.attachmentId,
          mimeType: part.mimeType,
        });
      }
    }
    if (part.parts) collectInlineImages(part.parts, result);
  }
  return result;
}

// ─── Pushbullet constants and state ──────────────────────────────────────────
const PB_BASE = 'https://api.pushbullet.com/v2';

function pbHeaders(apiKey) {
  return { 'Access-Token': apiKey, 'Content-Type': 'application/json' };
}

let cachedDeviceIden = null;
let pbApiKey = null;
let pbSocket = null;
let pbReconnectTimer = null;
let pbThreads = [];
let pbMessages = {};
let pbLastModified = Math.floor(Date.now() / 1000);

async function getDeviceIden(apiKey) {
  if (cachedDeviceIden) return cachedDeviceIden;
  const res = await fetch(`${PB_BASE}/devices`, { headers: pbHeaders(apiKey) });
  const json = await res.json();
  const device = (json.devices || []).find(d => d.has_sms && d.active);
  if (device) cachedDeviceIden = device.iden;
  return cachedDeviceIden;
}

function mapPbThreads(threads) {
  return (threads || []).map(t => ({
    id: String(t.id),
    name: t.recipients?.[0]?.name || t.recipients?.[0]?.address || '',
    number: t.recipients?.[0]?.address || '',
    snippet: t.latest?.body || '',
    timestamp: (t.latest?.timestamp || t.timestamp || 0) * 1000,
    unread: (t.unread_count || 0) > 0,
  }))
  .sort((a, b) => b.timestamp - a.timestamp)
  .slice(0, 40);
}

function mapPbMessages(msgs) {
  return (msgs || []).map(m => ({
    id: String(m.id || m.guid || m.timestamp),
    body: m.body || '',
    timestamp: (m.timestamp || 0) * 1000,
    direction: m.direction === 'outgoing' ? 'outbound' : 'inbound',
    imageUrl: m.image_url || null,
  })).sort((a, b) => a.timestamp - b.timestamp);
}

function processPushbulletPush(push) {
  if (!push || !push.type) return;
  // Ignore our own outgoing requests echoed back on the stream
  if (push.type === 'messaging_extension_request') return;
  console.log('[PB push]', push.type, JSON.stringify(push).slice(0, 400));

  const data = push.data || {};

  if (push.type === 'messaging_extension_reply') {
    if (data.request_type === 'thread_list' && data.threads) {
      pbThreads = mapPbThreads(data.threads);
      if (win && !win.isDestroyed()) win.webContents.send('messages:threadsUpdated', pbThreads);
    }
    if (data.request_type === 'thread' && data.thread_id) {
      const msgs = mapPbMessages(data.thread || []);
      pbMessages[data.thread_id] = msgs;
      if (win && !win.isDestroyed()) win.webContents.send('messages:threadUpdated', { threadId: data.thread_id, messages: msgs });
    }
  }

  if (push.type === 'sms_changed') void refreshThreadsViaRest();
}

async function refreshThreadsViaRest() {
  if (!pbApiKey) return;
  try {
    const iden = await getDeviceIden(pbApiKey);
    if (!iden) return;
    const res = await fetch(`${PB_BASE}/permanents/${iden}_threads`, { headers: pbHeaders(pbApiKey) });
    const json = await res.json();
    if (json.error || !json.threads) return;
    pbThreads = mapPbThreads(json.threads);
    if (win && !win.isDestroyed()) win.webContents.send('messages:threadsUpdated', pbThreads);
  } catch (e) {
    console.log('[PB refreshThreads error]', e.message);
  }
}

let cachedUserIden = null;
let cachedDesktopDeviceIden = null;

async function getUserIden(apiKey) {
  if (cachedUserIden) return cachedUserIden;
  try {
    const res = await fetch(`${PB_BASE}/users/me`, { headers: pbHeaders(apiKey) });
    const json = await res.json();
    cachedUserIden = json.iden || null;
  } catch {}
  return cachedUserIden;
}

// Register Emberforge as a Pushbullet device so the phone knows where to send replies
async function ensureDesktopDevice(apiKey) {
  if (cachedDesktopDeviceIden) return cachedDesktopDeviceIden;
  try {
    // Check if we already registered
    const listRes = await fetch(`${PB_BASE}/devices`, { headers: pbHeaders(apiKey) });
    const listJson = await listRes.json();
    const existing = (listJson.devices || []).find(d => d.nickname === 'Emberforge Command Center' && d.active);
    if (existing) { cachedDesktopDeviceIden = existing.iden; return existing.iden; }

    // Register as a desktop device
    const res = await fetch(`${PB_BASE}/devices`, {
      method: 'POST',
      headers: pbHeaders(apiKey),
      body: JSON.stringify({ nickname: 'Emberforge Command Center', model: 'desktop', manufacturer: 'Emberforge', app_version: 1 }),
    });
    const json = await res.json();
    cachedDesktopDeviceIden = json.iden || null;
    console.log('[PB] registered desktop device:', cachedDesktopDeviceIden);
  } catch (e) {
    console.log('[PB ensureDesktopDevice error]', e.message);
  }
  return cachedDesktopDeviceIden;
}

async function sendEphemeral(apiKey, phoneIden, data) {
  try {
    const [userIden, desktopIden] = await Promise.all([getUserIden(apiKey), ensureDesktopDevice(apiKey)]);
    const res = await fetch(`${PB_BASE}/ephemerals`, {
      method: 'POST',
      headers: pbHeaders(apiKey),
      body: JSON.stringify({
        type: 'push',
        push: {
          type: 'messaging_extension_request',
          package_name: 'com.pushbullet.android',
          source_user_iden: userIden,
          source_device_iden: desktopIden,
          target_device_iden: phoneIden,
          data,
        },
      }),
    });
    const json = await res.json();
    console.log('[PB ephemeral]', JSON.stringify(json).slice(0, 200));
  } catch (e) {
    console.log('[PB sendEphemeral error]', e.message);
  }
}

function startPushbulletSocket(apiKey) {
  pbApiKey = apiKey;

  if (pbSocket) { try { pbSocket.close(); } catch {} pbSocket = null; }
  if (pbReconnectTimer) { clearTimeout(pbReconnectTimer); pbReconnectTimer = null; }

  const ws = new globalThis.WebSocket(`wss://stream.pushbullet.com/websocket/${apiKey}`);
  pbSocket = ws;

  ws.addEventListener('open', async () => {
    console.log('[PB] WebSocket connected');
    const iden = await getDeviceIden(apiKey);
    if (iden) void sendEphemeral(apiKey, iden, { request_type: 'thread_list' });
  });

  ws.addEventListener('message', (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.type === 'nop') return;
    console.log('[PB WS]', JSON.stringify(msg).slice(0, 200));
    if (msg.type === 'tickle' && msg.subtype === 'push') void refreshThreadsViaRest();
    if (msg.type === 'push') processPushbulletPush(msg.push || {});
  });

  ws.addEventListener('close', () => {
    console.log('[PB] WebSocket closed, reconnecting in 5s...');
    pbSocket = null;
    if (pbApiKey === apiKey) {
      pbReconnectTimer = setTimeout(() => startPushbulletSocket(apiKey), 5000);
    }
  });

  ws.addEventListener('error', (e) => {
    console.log('[PB] WebSocket error:', e.message || String(e));
  });
}

// ─── Vault helpers ────────────────────────────────────────────────────────────
function readTreeNode(dirPath, depth = 0) {
  if (depth >= 3) return [];
  let entries;
  try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); }
  catch { return []; }

  const nodes = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dirPath, entry.name);
    let stat;
    try { stat = fs.statSync(fullPath); }
    catch { continue; }

    if (entry.isDirectory()) {
      nodes.push({ name: entry.name, path: fullPath, type: 'folder', ext: '', modified: stat.mtimeMs, children: readTreeNode(fullPath, depth + 1) });
    } else {
      nodes.push({ name: entry.name, path: fullPath, type: 'file', ext: path.extname(entry.name), modified: stat.mtimeMs });
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

// ─── Window ───────────────────────────────────────────────────────────────────
const isDev = process.env.VITE_DEV === 'true' || !app.isPackaged;
let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    fullscreen: false,      // start windowed so dev is easier; set true for prod
    frame: false,           // frameless — Emberforge draws its own titlebar
    transparent: false,
    backgroundColor: '#020810',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    // win.webContents.openDevTools();  // uncomment to debug
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.once('ready-to-show', () => win.show());

  // F11 / Cmd+Ctrl+F to toggle fullscreen
  win.on('focus', () => {
    globalShortcut.register('F11', () => win.setFullScreen(!win.isFullScreen()));
  });
  win.on('blur', () => globalShortcut.unregister('F11'));
}

app.whenReady().then(() => {
  const store = new Store({
    defaults: {
      vaultPath: '/Users/risingwarriorgames/Documents/11_Vault/Rising Warrior Games',
    },
  });

  createWindow();

  // ─── Vault IPC handlers ──────────────────────────────────────────────────
  ipcMain.handle('vault:getPath', () => store.get('vaultPath'));

  ipcMain.handle('vault:readTree', () => {
    const vaultPath = store.get('vaultPath');
    return readTreeNode(vaultPath, 0);
  });

  ipcMain.handle('vault:readFile', (_e, { path: filePath }) => {
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    return { content, modified: stat.mtimeMs };
  });

  ipcMain.handle('vault:writeFile', (_e, { path: filePath, content }) => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('vault:choosePath', async () => {
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    if (result.canceled || !result.filePaths.length) return null;
    const chosen = result.filePaths[0];
    store.set('vaultPath', chosen);
    return { path: chosen };
  });

  // ─── App launcher ────────────────────────────────────────────────────────
  ipcMain.handle('app:open', (_e, appPath) => shell.openPath(appPath));
  ipcMain.handle('app:openInVSCode', (_e, repoPath) => { execSync(`code "${repoPath}"`); return { success: true }; });

  // ─── Settings ────────────────────────────────────────────────────────────
  ipcMain.handle('settings:set', (_e, { key, value }) => { store.set(key, value); });
  ipcMain.handle('settings:get', (_e, { key }) => store.get(key));
  ipcMain.handle('settings:writeEnv', (_e, { key, value }) => {
    const envPath = path.join(__dirname, '../.env');
    let content = '';
    try { content = fs.readFileSync(envPath, 'utf8'); } catch {}
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content = content + (content.endsWith('\n') ? '' : '\n') + `${key}=${value}\n`;
    }
    fs.writeFileSync(envPath, content);
    return { success: true };
  });

  // ─── Reminders ───────────────────────────────────────────────────────────
  const REMINDERS_PATH = path.resolve(__dirname, '..', 'REMINDERS.md');

  ipcMain.handle('reminders:read', () => {
    try {
      const content = fs.readFileSync(REMINDERS_PATH, 'utf-8');
      return { content };
    } catch {
      const empty = '# REMINDERS\n';
      fs.writeFileSync(REMINDERS_PATH, empty, 'utf-8');
      return { content: empty };
    }
  });

  ipcMain.handle('reminders:write', (_e, { content }) => {
    try {
      fs.writeFileSync(REMINDERS_PATH, content, 'utf-8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── Project file operations ─────────────────────────────────────────────
  ipcMain.handle('project:readFile', (_e, { repoPath, filename }) => {
    try {
      const content = fs.readFileSync(path.join(repoPath, filename), 'utf-8');
      return { content };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('project:appendEntry', (_e, { repoPath, filename, entry }) => {
    try {
      const filePath = path.join(repoPath, filename);
      let content = '';
      try { content = fs.readFileSync(filePath, 'utf-8'); } catch { /* new file */ }

      const section = filename === 'BUGS.md' ? '## Active' : '## Backlog';
      const idx = content.indexOf(section);
      if (idx !== -1) {
        // insert after the section heading line
        const insertAt = content.indexOf('\n', idx) + 1;
        content = content.slice(0, insertAt) + '\n' + entry + '\n' + content.slice(insertAt);
      } else {
        content = content.trimEnd() + '\n\n' + entry + '\n';
      }

      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('project:gitPush', (_e, { repoPath, filename, message }) => {
    try {
      const out = [];
      out.push(execSync(`git -C "${repoPath}" add "${filename}"`, { encoding: 'utf-8' }));
      out.push(execSync(`git -C "${repoPath}" commit -m "${message}"`, { encoding: 'utf-8' }));
      out.push(execSync(`git -C "${repoPath}" push`, { encoding: 'utf-8' }));
      return { success: true, output: out.join('\n') };
    } catch (err) {
      return { success: false, output: '', error: err.message };
    }
  });

  // ─── Vercel IPC ──────────────────────────────────────────────────────────
  ipcMain.handle('vercel:getStatus', async (_e, { projectId, teamId, token }) => {
    try {
      const params = new URLSearchParams({ projectId, limit: '1', target: 'production' });
      if (teamId) params.set('teamId', teamId);
      const res = await fetch(
        `https://api.vercel.com/v6/deployments?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (!res.ok) return { error: json.error?.message ?? `HTTP ${res.status}` };
      const d = json.deployments?.[0];
      if (!d) return { error: 'NO_DEPLOYMENT' };
      return {
        state:     d.state,
        createdAt: d.createdAt ?? d.created,
        meta: {
          githubCommitMessage: d.meta?.githubCommitMessage ?? '',
          githubCommitRef:     d.meta?.githubCommitRef     ?? '',
        },
      };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('vercel:getLogs', async (_e, { projectId, teamId, token }) => {
    try {
      const deplParams = new URLSearchParams({ projectId, limit: '1', target: 'production' });
      if (teamId) deplParams.set('teamId', teamId);
      const deplRes = await fetch(`https://api.vercel.com/v6/deployments?${deplParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const deplJson = await deplRes.json();
      if (!deplRes.ok) return { error: deplJson.error?.message ?? `HTTP ${deplRes.status}` };
      const uid = deplJson.deployments?.[0]?.uid;
      if (!uid) return { error: 'NO_DEPLOYMENT' };

      const eventsParams = new URLSearchParams({ limit: '50', direction: 'backward' });
      if (teamId) eventsParams.set('teamId', teamId);
      const logsRes = await fetch(`https://api.vercel.com/v2/deployments/${uid}/events?${eventsParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const logsRaw = await logsRes.json();
      if (!logsRes.ok) return { error: logsRaw.error?.message ?? `HTTP ${logsRes.status}` };
      const events = Array.isArray(logsRaw) ? logsRaw : (logsRaw.events ?? []);
      const logs = events
        .filter(e => e.type === 'stdout' || e.type === 'stderr' || e.type === 'command')
        .slice(0, 50)
        .map(e => ({
          timestamp: e.created ?? e.createdAt ?? Date.now(),
          level: e.type === 'stderr' ? 'error' : 'info',
          message: (e.payload?.text ?? e.text ?? '').trim(),
          source: e.source ?? 'build',
        }))
        .filter(e => e.message);
      return { logs };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('github:getCommits', async (_e, { repoPath, token }) => {
    try {
      const remote = execSync('git remote get-url origin', { encoding: 'utf8', cwd: repoPath }).trim();
      const match = remote.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
      if (!match) return { error: 'CANNOT_PARSE_REMOTE' };
      const [, owner, repo] = match;
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=20`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'EmberforgeCommandCenter',
        },
      });
      const json = await res.json();
      if (!res.ok) return { error: json.message ?? `HTTP ${res.status}` };
      const commits = (Array.isArray(json) ? json : []).map(c => ({
        sha:       c.sha?.slice(0, 7) ?? '',
        message:   c.commit?.message?.split('\n')[0] ?? '',
        author:    c.commit?.author?.name ?? '',
        timestamp: new Date(c.commit?.author?.date ?? 0).getTime(),
        url:       c.html_url ?? '',
      }));
      return { commits };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('github:getStatus', async (_e, { repoPath, token }) => {
    try {
      const remote = execSync('git remote get-url origin', { encoding: 'utf8', cwd: repoPath }).trim();
      const match = remote.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
      if (!match) return { error: 'CANNOT_PARSE_REMOTE' };
      const [, owner, repo] = match;
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'EmberforgeCommandCenter',
      };
      const [commitsRes, issuesRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, { headers }),
        fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=1`, { headers }),
      ]);
      const commits = await commitsRes.json();
      const issues  = await issuesRes.json();
      const c = Array.isArray(commits) ? commits[0] : null;
      if (!c) return { error: 'NO_COMMITS' };
      const issueCount = issuesRes.headers.get('link')
        ? (() => {
            const link = issuesRes.headers.get('link') ?? '';
            const lastMatch = link.match(/page=(\d+)>; rel="last"/);
            return lastMatch ? parseInt(lastMatch[1], 10) : (Array.isArray(issues) ? issues.length : 0);
          })()
        : (Array.isArray(issues) ? issues.length : 0);
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', cwd: repoPath }).trim();
      return {
        lastCommit: {
          message:   c.commit.message.split('\n')[0],
          author:    c.commit.author.name,
          timestamp: new Date(c.commit.author.date).getTime(),
          branch,
        },
        openIssues: issueCount,
      };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('supabase:getStatus', async (_e, { projectUrl, anonKey }) => {
    try {
      const base = projectUrl.startsWith('http') ? projectUrl.replace(/\/$/, '') : `https://${projectUrl.replace(/\/$/, '')}`;
      await fetch(`${base}/rest/v1/`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(8000),
      });
      return { healthy: true };
    } catch (err) {
      return { healthy: false, errorMessage: err.message };
    }
  });

  // ─── Market quotes IPC ───────────────────────────────────────────────────
  ipcMain.handle('market:getQuotes', async () => {
    const TICKERS = [
      { symbol: 'BTC-USD', label: 'BTC',    group: 'crypto' },
      { symbol: 'XRP-USD', label: 'XRP',    group: 'crypto' },
      { symbol: 'GC=F',    label: 'GOLD',   group: 'metal'  },
      { symbol: 'SI=F',    label: 'SILVER', group: 'metal'  },
    ];
    const YF_HEADERS = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    const results = await Promise.all(TICKERS.map(async t => {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t.symbol)}`,
          { headers: YF_HEADERS, signal: AbortSignal.timeout(10000) }
        );
        if (!res.ok) return null;
        const json = await res.json();
        const meta = json?.chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice) return null;
        return { price: meta.regularMarketPrice, prevClose: meta.previousClose ?? meta.regularMarketPrice };
      } catch { return null; }
    }));
    return TICKERS.map((t, i) => ({
      label: t.label, group: t.group,
      price:     results[i]?.price     ?? null,
      prevClose: results[i]?.prevClose ?? null,
      error:     results[i] === null,
    }));
  });

  // ─── Pushbullet / Messages IPC ───────────────────────────────────────────

  // Auto-start WebSocket if API key already stored (for real-time tickle events)
  const existingPbKey = store.get('pushbullet.apiKey');
  if (existingPbKey) startPushbulletSocket(existingPbKey);

  ipcMain.handle('messages:connect', () => {
    const apiKey = store.get('pushbullet.apiKey');
    if (!apiKey) return { error: 'NO_API_KEY' };
    startPushbulletSocket(apiKey);
    return { success: true };
  });

  ipcMain.handle('messages:getDevices', async () => {
    const apiKey = store.get('pushbullet.apiKey');
    if (!apiKey) return { error: 'NO_API_KEY' };
    try {
      cachedDeviceIden = null;
      const iden = await getDeviceIden(apiKey);
      if (!iden) return { error: 'NO_SMS_DEVICE' };
      return { iden };
    } catch (err) {
      return { error: err.message };
    }
  });

  // Fetch thread list directly from REST — GET /v2/permanents/{device_iden}_threads
  ipcMain.handle('messages:getThreads', async () => {
    const apiKey = store.get('pushbullet.apiKey');
    if (!apiKey) return { error: 'NO_API_KEY' };
    try {
      const iden = await getDeviceIden(apiKey);
      if (!iden) return { error: 'NO_SMS_DEVICE' };
      const res = await fetch(`${PB_BASE}/permanents/${iden}_threads`, { headers: pbHeaders(apiKey) });
      const json = await res.json();
      if (json.error) return { error: json.error.message || 'fetch failed' };
      pbThreads = mapPbThreads(json.threads || []);
      return { threads: pbThreads };
    } catch (err) {
      return { error: err.message };
    }
  });

  // Fetch individual thread messages — GET /v2/permanents/{device_iden}_thread_{threadId}
  ipcMain.handle('messages:getThread', async (_e, { threadId }) => {
    const apiKey = store.get('pushbullet.apiKey');
    if (!apiKey) return { error: 'NO_API_KEY' };
    try {
      const iden = await getDeviceIden(apiKey);
      if (!iden) return { error: 'NO_SMS_DEVICE' };
      const res = await fetch(`${PB_BASE}/permanents/${iden}_thread_${threadId}`, { headers: pbHeaders(apiKey) });
      const json = await res.json();
      if (json.error) return { error: json.error.message || 'fetch failed' };
      const msgs = mapPbMessages(json.thread || []);
      pbMessages[threadId] = msgs;
      return { messages: msgs };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('messages:sendMessage', async (_e, { number, body }) => {
    const apiKey = store.get('pushbullet.apiKey');
    if (!apiKey) return { error: 'NO_API_KEY' };
    try {
      const deviceIden = await getDeviceIden(apiKey);
      if (!deviceIden) return { success: false, error: 'NO_SMS_DEVICE' };
      const res = await fetch(`${PB_BASE}/texts`, {
        method: 'POST',
        headers: pbHeaders(apiKey),
        body: JSON.stringify({
          data: {
            target_device_iden: deviceIden,
            addresses: [number],
            message: body,
            guid: randomUUID(),
          },
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        return { success: false, error: txt };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── Gmail IPC ───────────────────────────────────────────────────────────
  void initGmail();

  ipcMain.handle('gmail:getStatus', () => gmailStatus);

  ipcMain.handle('gmail:authorize', () => authorizeGmail());

  ipcMain.handle('gmail:getThreads', async (_e, { pageToken } = {}) => {
    if (!gmailService) return { error: 'NOT_AUTHENTICATED' };
    try {
      const listRes = await gmailService.users.threads.list({
        userId: 'me',
        maxResults: 30,
        pageToken: pageToken || undefined,
        labelIds: ['INBOX'],
      });
      const threadItems = listRes.data.threads || [];
      const nextPageToken = listRes.data.nextPageToken || null;

      const threads = await Promise.all(threadItems.map(async (t) => {
        const detail = await gmailService.users.threads.get({
          userId: 'me',
          id: t.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });
        const msg = detail.data.messages?.[detail.data.messages.length - 1];
        const headers = msg?.payload?.headers || [];
        const { from, subject, date } = parseGmailHeaders(headers, 'From', 'Subject', 'Date');
        const labelIds = msg?.labelIds || [];
        return {
          id: t.id,
          subject: subject || '(no subject)',
          from,
          snippet: detail.data.snippet || '',
          timestamp: date ? new Date(date).getTime() : 0,
          unread: labelIds.includes('UNREAD'),
        };
      }));

      threads.sort((a, b) => b.timestamp - a.timestamp);
      return { threads, nextPageToken };
    } catch (err) {
      console.log('[Gmail] getThreads error:', err.message);
      return { error: err.message };
    }
  });

  ipcMain.handle('gmail:getThread', async (_e, { threadId }) => {
    if (!gmailService) return { error: 'NOT_AUTHENTICATED' };
    try {
      const res = await gmailService.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full',
      });

      let myEmail = '';
      try {
        const profile = await gmailService.users.getProfile({ userId: 'me' });
        myEmail = profile.data.emailAddress || '';
      } catch {}

      const messages = await Promise.all((res.data.messages || []).map(async (msg) => {
        const headers = msg.payload?.headers || [];
        const { from, to, subject, date } = parseGmailHeaders(headers, 'From', 'To', 'Subject', 'Date');
        const body = msg.payload?.parts
          ? extractBodyFromParts(msg.payload.parts)
          : decodeBase64Body(msg.payload?.body?.data);

        let htmlBody = '';
        const htmlRaw = msg.payload?.parts
          ? extractHtmlFromParts(msg.payload.parts)
          : (msg.payload?.mimeType === 'text/html' ? decodeBase64Body(msg.payload?.body?.data) : '');
        if (htmlRaw) {
          const inlineImages = collectInlineImages(msg.payload?.parts || []);
          const cidMap = {};
          await Promise.all(inlineImages.map(async img => {
            try {
              const att = await gmailService.users.messages.attachments.get({
                userId: 'me', messageId: msg.id, id: img.attachmentId,
              });
              const data = att.data.data?.replace(/-/g, '+').replace(/_/g, '/') ?? '';
              cidMap[img.cid] = `data:${img.mimeType};base64,${data}`;
            } catch {}
          }));
          htmlBody = htmlRaw.replace(/src="cid:([^"]+)"/g, (_, cid) => `src="${cidMap[cid] ?? ''}"`);
        }

        return {
          id: msg.id,
          from,
          to,
          subject,
          body,
          htmlBody,
          timestamp: date ? new Date(date).getTime() : 0,
          fromMe: from.includes(myEmail) && myEmail !== '',
        };
      }));

      void gmailService.users.threads.modify({
        userId: 'me',
        id: threadId,
        requestBody: { removeLabelIds: ['UNREAD'] },
      }).catch(() => {});

      return { messages };
    } catch (err) {
      console.log('[Gmail] getThread error:', err.message);
      return { error: err.message };
    }
  });

  ipcMain.handle('gmail:sendEmail', async (_e, { to, subject, body, threadId }) => {
    if (!gmailService) return { success: false, error: 'NOT_AUTHENTICATED' };
    try {
      const raw = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        body,
      ].join('\r\n');

      const encoded = Buffer.from(raw).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      await gmailService.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encoded,
          ...(threadId ? { threadId } : {}),
        },
      });
      return { success: true };
    } catch (err) {
      console.log('[Gmail] sendEmail error:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('gmail:markRead', async (_e, { threadId }) => {
    if (!gmailService) return { success: false, error: 'NOT_AUTHENTICATED' };
    try {
      await gmailService.users.threads.modify({
        userId: 'me',
        id: threadId,
        requestBody: { removeLabelIds: ['UNREAD'] },
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── WhatsApp IPC ────────────────────────────────────────────────────────
  waAuthDir = path.join(app.getPath('userData'), 'wa-auth');
  fs.mkdirSync(waAuthDir, { recursive: true });

  ipcMain.handle('wa:connect',    () => { void startWhatsApp(); return { success: true }; });
  ipcMain.handle('wa:disconnect', async () => {
    if (waSocket) { try { await waSocket.logout(); } catch {} waSocket = null; }
    waStatus = 'disconnected';
    waChats = []; waMessages = {};
    if (win && !win.isDestroyed()) win.webContents.send('wa:status', 'disconnected');
    return { success: true };
  });
  ipcMain.handle('wa:getChats',   () => ({ chats: waChats, status: waStatus }));
  ipcMain.handle('wa:getMessages', (_e, { jid }) => ({ messages: waMessages[jid] || [] }));
  ipcMain.handle('wa:sendMessage', async (_e, { jid, text }) => {
    if (!waSocket) return { success: false, error: 'not connected' };
    try {
      await waSocket.sendMessage(jid, { text });
      const msg = { id: `local-${Date.now()}`, body: text, timestamp: Date.now(), direction: 'outbound' };
      if (!waMessages[jid]) waMessages[jid] = [];
      waMessages[jid].push(msg);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── Architecture Map IPC ────────────────────────────────────────────────

  const ARCHMAP_CACHE = new Map();
  const SKIP_DIRS     = new Set(['node_modules', '.git', '.next', 'dist', 'out', '.turbo', 'coverage', '.cache', 'public', 'styles']);
  const INCLUDE_EXTS  = new Set(['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs']);
  const EXTERNAL_PKGS = [/^@supabase\//, /^next\//, /^react$/, /^react-dom/, /^stripe/, /^resend/, /^@anthropic-sdk\//];

  function getLayer(filePath, repoPath) {
    const rel = filePath.replace(repoPath, '').replace(/^[/\\]/, '').replace(/\\/g, '/');
    // handle both app/ at root and src/app/ structure
    if (/(?:^|src\/)app\/.+\/page\.[tj]sx?$/.test(rel))   return 'page';
    if (/(?:^|src\/)app\/(?:.+\/)?layout\.[tj]sx?$/.test(rel)) return 'page';
    if (/(?:^|src\/)app\/api\//.test(rel))                return 'api';
    if (/(?:^|src\/)middleware\.[tj]sx?$/.test(rel))       return 'api';
    if (/(?:^|src\/)components?\//.test(rel))              return 'component';
    if (/(?:^|src\/)(lib|utils?|hooks?|types?)\//.test(rel)) return 'util';
    return 'other';
  }

  function extractJSDoc(content) {
    let overview = '';
    let label    = '';
    const depends = [];
    const blockRe = /\/\*\*([\s\S]*?)\*\//g;
    let m;
    while ((m = blockRe.exec(content)) !== null) {
      const block = m[1];
      const ovMatch = block.match(/@fileoverview\s+([\s\S]*?)(?=@\w|\*\/|$)/);
      if (ovMatch) {
        overview = ovMatch[1].split('\n')
          .map(l => l.replace(/^\s*\*\s?/, '').trim()).filter(Boolean).join(' ').trim();
      }
      const lblMatch = block.match(/@label\s+(.+?)(?=\s*(?:\*\/|@\w|$))/m);
      if (lblMatch) label = lblMatch[1].replace(/^\s*\*\s?/, '').trim();
      const depRe = /@depends\s+(\S+)/g;
      let d;
      while ((d = depRe.exec(block)) !== null) depends.push(d[1]);
    }
    return { overview, depends, label };
  }

  function resolveAliases(repoPath) {
    const aliases = {};
    const candidates = ['tsconfig.json', 'tsconfig.app.json', 'jsconfig.json'];
    for (const name of candidates) {
      const tscPath = path.join(repoPath, name);
      if (!fs.existsSync(tscPath)) continue;
      try {
        const raw = fs.readFileSync(tscPath, 'utf-8');
        // Strip // comments only when not inside a quoted string, leave /* */ alone
        // (block-comment stripping trips on paths like "@/*" and "**/*.ts")
        const stripped = raw.replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*/g, (m, str) => str ?? '');
        const tsconfig = JSON.parse(stripped);
        const opts = tsconfig.compilerOptions ?? {};
        const baseUrl = opts.baseUrl ? path.resolve(repoPath, opts.baseUrl) : repoPath;
        if (opts.paths) {
          for (const [alias, targets] of Object.entries(opts.paths)) {
            const target = Array.isArray(targets) ? targets[0] : null;
            if (!target) continue;
            // "@/*" → prefix "@/", base = resolve(baseUrl, "src")
            const prefix  = alias.endsWith('/*') ? alias.slice(0, -2) + '/' : alias;
            const baseRel = target.endsWith('/*') ? target.slice(0, -2) : target;
            aliases[prefix] = path.resolve(baseUrl, baseRel);
          }
        }
        break;
      } catch { /* ignore */ }
    }
    // Common-convention fallback: @/ and ~/ → src/ if src dir exists
    if (!('@/' in aliases)) {
      const src = path.join(repoPath, 'src');
      if (fs.existsSync(src)) { aliases['@/'] = src; aliases['~/'] = src; }
    }
    return aliases;
  }

  function resolveWithExts(base) {
    if (path.extname(base)) return fs.existsSync(base) ? base : null;
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      if (fs.existsSync(base + ext)) return base + ext;
      const idx = path.join(base, 'index' + ext);
      if (fs.existsSync(idx)) return idx;
    }
    return null;
  }

  function extractImports(content, filePath, repoPath, aliases) {
    const internal = new Set();
    const external = new Set();
    const dir = path.dirname(filePath);
    const patterns = [
      /import\s+(?:type\s+)?(?:[\w*{}[\]\s,]+from\s+)?['"]([^'"]+)['"]/g,
      /require\(['"]([^'"]+)['"]\)/g,
    ];
    for (const re of patterns) {
      let match;
      while ((match = re.exec(content)) !== null) {
        const imp = match[1];
        if (imp.startsWith('.')) {
          // relative import
          const resolved = resolveWithExts(path.resolve(dir, imp));
          if (resolved && resolved.startsWith(repoPath)) internal.add(resolved);
        } else {
          // try path aliases first
          let aliasMatched = false;
          for (const [prefix, basePath] of Object.entries(aliases)) {
            if (!imp.startsWith(prefix)) continue;
            const rest     = imp.slice(prefix.length);
            const resolved = resolveWithExts(path.join(basePath, rest));
            if (resolved && resolved.startsWith(repoPath)) internal.add(resolved);
            aliasMatched = true;
            break;
          }
          // then check known external packages
          if (!aliasMatched && EXTERNAL_PKGS.some(p => p.test(imp))) {
            const pkg = imp.startsWith('@') ? imp.split('/').slice(0, 2).join('/') : imp.split('/')[0];
            external.add(pkg);
          }
        }
      }
    }
    return { internal: [...internal], external: [...external] };
  }

  function walkDir(dir, files = []) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return files; }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkDir(full, files);
      else if (entry.isFile() && INCLUDE_EXTS.has(path.extname(entry.name))) files.push(full);
    }
    return files;
  }

  function scanRepo(repoPath) {
    const aliases = resolveAliases(repoPath);
    const files   = walkDir(repoPath);
    const nodes   = [];
    const edges   = [];
    for (const filePath of files) {
      let content;
      try { content = fs.readFileSync(filePath, 'utf-8'); } catch { continue; }
      const { overview, depends, label } = extractJSDoc(content);
      const { internal, external }      = extractImports(content, filePath, repoPath, aliases);
      nodes.push({
        id:       filePath,
        label:    label || path.basename(filePath),
        path:     filePath.replace(repoPath, '').replace(/^[/\\]/, '').replace(/\\/g, '/'),
        layer:    getLayer(filePath, repoPath),
        overview,
        depends,
        externals: external,
      });
      for (const target of internal) edges.push({ source: filePath, target });
    }
    return {
      nodes,
      edges,
      meta: { projectName: path.basename(repoPath), repoPath, scannedAt: Date.now(), totalFiles: nodes.length, totalEdges: edges.length },
    };
  }

  ipcMain.handle('archmap:scan', (_e, { repoPath }) => {
    try {
      if (ARCHMAP_CACHE.has(repoPath)) return ARCHMAP_CACHE.get(repoPath);
      const result = scanRepo(repoPath);
      ARCHMAP_CACHE.set(repoPath, result);
      return result;
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('archmap:rescan', (_e, { repoPath }) => {
    try {
      ARCHMAP_CACHE.delete(repoPath);
      const result = scanRepo(repoPath);
      ARCHMAP_CACHE.set(repoPath, result);
      return result;
    } catch (err) {
      return { error: err.message };
    }
  });

  // ─── Vault file watcher ──────────────────────────────────────────────────
  let debounceTimer = null;
  function startWatcher() {
    const vaultPath = store.get('vaultPath');
    const watcher = chokidar.watch(vaultPath, {
      ignored: /(^|[/\\])\../,   // skip hidden files/folders
      ignoreInitial: true,
      depth: 3,
    });
    const notify = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (win && !win.isDestroyed()) win.webContents.send('vault:changed');
      }, 300);
    };
    watcher.on('add', (p) => { if (/\.(md|txt)$/.test(p)) notify(); });
    watcher.on('change', (p) => { if (/\.(md|txt)$/.test(p)) notify(); });
    watcher.on('unlink', (p) => { if (/\.(md|txt)$/.test(p)) notify(); });
    return watcher;
  }
  startWatcher();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
