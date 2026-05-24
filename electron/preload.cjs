const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  vaultAPI: {
    readTree:   ()             => ipcRenderer.invoke('vault:readTree'),
    readFile:   (path)         => ipcRenderer.invoke('vault:readFile', { path }),
    writeFile:  (path, content)=> ipcRenderer.invoke('vault:writeFile', { path, content }),
    getPath:    ()             => ipcRenderer.invoke('vault:getPath'),
    choosePath: ()             => ipcRenderer.invoke('vault:choosePath'),
    onChange:   (cb)           => ipcRenderer.on('vault:changed', cb),
    offChange:  (cb)           => ipcRenderer.removeListener('vault:changed', cb),
  },

  openApp: (appPath) => ipcRenderer.invoke('app:open', appPath),
  openInVSCode: (repoPath) => ipcRenderer.invoke('app:openInVSCode', repoPath),

  settingsAPI: {
    set: (key, value) => ipcRenderer.invoke('settings:set', { key, value }),
    get: (key)        => ipcRenderer.invoke('settings:get', { key }),
  },

  projectAPI: {
    readFile:    (repoPath, filename)        => ipcRenderer.invoke('project:readFile',    { repoPath, filename }),
    appendEntry: (repoPath, filename, entry) => ipcRenderer.invoke('project:appendEntry', { repoPath, filename, entry }),
    gitPush:     (repoPath, filename, message) => ipcRenderer.invoke('project:gitPush',   { repoPath, filename, message }),
  },

  waAPI: {
    connect:      ()           => ipcRenderer.invoke('wa:connect'),
    disconnect:   ()           => ipcRenderer.invoke('wa:disconnect'),
    getChats:     ()           => ipcRenderer.invoke('wa:getChats'),
    getMessages:  (jid)        => ipcRenderer.invoke('wa:getMessages',  { jid }),
    sendMessage:  (jid, text)  => ipcRenderer.invoke('wa:sendMessage',  { jid, text }),
    onStatus:         (cb) => ipcRenderer.on('wa:status',          (_e, s)  => cb(s)),
    onQR:             (cb) => ipcRenderer.on('wa:qr',              (_e, qr) => cb(qr)),
    onChatsUpdated:   (cb) => ipcRenderer.on('wa:chatsUpdated',    (_e, c)  => cb(c)),
    onMessagesUpdated:(cb) => ipcRenderer.on('wa:messagesUpdated', (_e, d)  => cb(d)),
    offAll: () => {
      ipcRenderer.removeAllListeners('wa:status');
      ipcRenderer.removeAllListeners('wa:qr');
      ipcRenderer.removeAllListeners('wa:chatsUpdated');
      ipcRenderer.removeAllListeners('wa:messagesUpdated');
    },
  },

  gmailAPI: {
    getStatus:  ()                              => ipcRenderer.invoke('gmail:getStatus'),
    authorize:  ()                              => ipcRenderer.invoke('gmail:authorize'),
    getThreads: (pageToken)                     => ipcRenderer.invoke('gmail:getThreads', { pageToken }),
    getThread:  (threadId)                      => ipcRenderer.invoke('gmail:getThread',  { threadId }),
    sendEmail:  (to, subject, body, threadId)   => ipcRenderer.invoke('gmail:sendEmail',  { to, subject, body, threadId }),
    markRead:   (threadId)                      => ipcRenderer.invoke('gmail:markRead',   { threadId }),
    onStatus:   (cb)                            => ipcRenderer.on('gmail:status', (_e, s) => cb(s)),
    offStatus:  ()                              => ipcRenderer.removeAllListeners('gmail:status'),
  },

  messagesAPI: {
    connect:     ()               => ipcRenderer.invoke('messages:connect'),
    getThreads:  ()               => ipcRenderer.invoke('messages:getThreads'),
    getThread:   (threadId)       => ipcRenderer.invoke('messages:getThread',   { threadId }),
    sendMessage: (number, body)   => ipcRenderer.invoke('messages:sendMessage', { number, body }),
    getDevices:  ()               => ipcRenderer.invoke('messages:getDevices'),
    onThreadsUpdated: (cb)        => ipcRenderer.on('messages:threadsUpdated', (_e, threads) => cb(threads)),
    onThreadUpdated:  (cb)        => ipcRenderer.on('messages:threadUpdated',  (_e, data)    => cb(data)),
    offThreadsUpdated:(cb)        => ipcRenderer.removeAllListeners('messages:threadsUpdated'),
    offThreadUpdated: (cb)        => ipcRenderer.removeAllListeners('messages:threadUpdated'),
  },
});
