# EMBERFORGE COMMAND CENTER — TASKS

## In Progress


## Backlog

- [ ] // COMMS — WhatsApp integration via whatsapp-web.js
      - Install: npm install whatsapp-web.js qrcode-terminal
      - All WhatsApp logic runs in main process (main.cjs)
        never in renderer
      - Uses whatsapp-web.js Client with LocalAuth strategy
        so QR scan only needed once — session persists
        via electron-store path

      INITIALIZATION:
      - Client initializes on app start in background
      - Auth states:
          LOADING:        client spinning up
          QR_REQUIRED:    needs QR scan to link
          AUTHENTICATED:  ready, session restored
          DISCONNECTED:   lost connection
      - Send auth state to renderer via:
          win.webContents.send('whatsapp:status', state)
      - Add to preload bridge:
          whatsappAPI: {
            getStatus:    () => ipcRenderer.invoke('whatsapp:getStatus'),
            getChats:     () => ipcRenderer.invoke('whatsapp:getChats'),
            getMessages:  (chatId) => ipcRenderer.invoke('whatsapp:getMessages', { chatId }),
            sendMessage:  (chatId, body) => ipcRenderer.invoke('whatsapp:sendMessage', { chatId, body }),
            onStatus:     (cb) => ipcRenderer.on('whatsapp:status', cb),
            onMessage:    (cb) => ipcRenderer.on('whatsapp:message', cb),
          }

      IPC HANDLERS:
          whatsapp:getStatus
          - Returns current auth state string

          whatsapp:getChats
          - Returns array of chats sorted by most recent:
              {
                id: string,
                name: string,
                snippet: string,    ← last message preview
                timestamp: number,
                unread: number,     ← unread count
                isGroup: boolean,
              }
          - Limit: 40 chats

          whatsapp:getMessages
          - Args: { chatId: string }
          - Returns last 30 messages for chat:
              {
                id: string,
                body: string,
                timestamp: number,
                fromMe: boolean,
              }

          whatsapp:sendMessage
          - Args: { chatId: string, body: string }
          - Returns: { success: boolean, error?: string }

      REAL TIME:
      - On incoming message: emit 'whatsapp:message'
        to renderer with { chatId, message }
      - Renderer updates active thread if chatId matches
        or increments unread count in chat list

      UI — QR STATE:
      - When [ WHATSAPP ] tab active and status
        is QR_REQUIRED:
          Show QR code in right panel
          "// SCAN WITH WHATSAPP ON YOUR PHONE"
          font-size 9px, color var(--dim), letter-spacing 3px
          QR rendered as ASCII or canvas in panel center
          Auto-refreshes if QR expires

      UI — AUTHENTICATED STATE:
      - Identical layout to SMS tab:
          Middle panel: chat list with search bar
          Right panel: conversation view + reply area
          Same bubble styles, same send behavior
          Group chats: show group name, sender name
            above each inbound bubble in var(--dimmer)

      UI — DISCONNECTED STATE:
      - Show "// WHATSAPP DISCONNECTED"
        [ RECONNECT ] button below



### // NODE — Dashboard

### // SYSTEM — Settings Panel

      - Same centered placeholder pattern as CONNECTIONS
      - Label: "// ABOUT"
      - Show version: "v0.1.0 // ALPHA"
          font-size 9px, color var(--dimmer), letter-spacing 2px
      - No functionality yet


### // MAIL — Gmail Integration

- [ ] Stub — 
      - Nav item exists in sidebar (already present
        as placeholder)
      - Clicking shows: 
        centered in middle panel
      - No code beyond the stub
