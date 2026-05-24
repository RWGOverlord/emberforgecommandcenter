# EMBERFORGE COMMAND CENTER — TASKS

## In Progress
### // MAIL — Gmail Integration

- [ ] Gmail OAuth — authentication flow
      - Install dependencies:
          npm install googleapis @google-cloud/local-auth
      - Credentials file: electron/gmail-credentials.json
        (already in place — do not commit this to git)
        Add to .gitignore immediately:
          electron/gmail-credentials.json
          electron/gmail-token.json
      - Token storage: electron/gmail-token.json
        Written after first successful auth
        Persists so user only logs in once

      - Auth flow:
          On app start, check if gmail-token.json exists
          If yes: load token, initialize Gmail client
          If no: trigger OAuth flow
            Open system browser to Google consent screen
            Use a local redirect server on port 3535 to
            catch the OAuth callback:
              http://localhost:3535/oauth2callback
            On successful auth: write token to
              electron/gmail-token.json
            Send auth status to renderer:
              win.webContents.send('gmail:status', status)
          Status values:
            'LOADING'         — checking token on startup
            'AUTH_REQUIRED'   — no token, needs login
            'AUTHENTICATED'   — ready
            'ERROR'           — auth failed

      - Scopes required:
          https://www.googleapis.com/auth/gmail.readonly
          https://www.googleapis.com/auth/gmail.send
          https://www.googleapis.com/auth/gmail.modify

      - Add to preload bridge:
          gmailAPI: {
            getStatus:      () => ipcRenderer.invoke('gmail:getStatus'),
            authorize:      () => ipcRenderer.invoke('gmail:authorize'),
            getThreads:     (pageToken?) => ipcRenderer.invoke('gmail:getThreads', { pageToken }),
            getThread:      (threadId) => ipcRenderer.invoke('gmail:getThread', { threadId }),
            sendEmail:      (to, subject, body, threadId?) => ipcRenderer.invoke('gmail:sendEmail', { to, subject, body, threadId }),
            markRead:       (threadId) => ipcRenderer.invoke('gmail:markRead', { threadId }),
            onStatus:       (cb) => ipcRenderer.on('gmail:status', cb),
          }

- [ ] Gmail IPC handlers
      - Register in main.cjs after auth is initialized:

          gmail:getStatus
          - Returns current auth status string

          gmail:authorize
          - Triggers OAuth browser flow if not authenticated
          - Returns { success: boolean }

          gmail:getThreads
          - Args: { pageToken?: string }
          - Fetches inbox threads via Gmail API:
              gmail.users.threads.list({
                userId: 'me',
                maxResults: 30,
                pageToken,
                labelIds: ['INBOX']
              })
          - For each thread fetch snippet + headers:
              gmail.users.threads.get({
                userId: 'me',
                id: thread.id,
                format: 'metadata',
                metadataHeaders: ['From', 'Subject', 'Date']
              })
          - Returns array:
              {
                id: string,
                subject: string,
                from: string,       ← sender name/email
                snippet: string,    ← preview text
                timestamp: number,  ← epoch ms
                unread: boolean,    ← has UNREAD label
              }
          - Sort: newest first

          gmail:getThread
          - Args: { threadId: string }
          - Fetches full thread with all messages:
              gmail.users.threads.get({
                userId: 'me',
                id: threadId,
                format: 'full'
              })
          - For each message extract:
              {
                id: string,
                from: string,
                to: string,
                subject: string,
                body: string,       ← decoded from base64
                timestamp: number,
                fromMe: boolean,    ← matches authenticated email
              }
          - Body extraction:
              Check parts for text/plain first
              Fall back to text/html, strip tags if needed
              Decode from base64url:
                Buffer.from(data, 'base64').toString('utf8')
          - Also call gmail:markRead for this thread

          gmail:sendEmail
          - Args: { to, subject, body, threadId? }
          - Compose RFC 2822 message:
              From: me
              To: {to}
              Subject: {subject}
              Content-Type: text/plain; charset=utf-8

              {body}
          - Encode as base64url
          - Call gmail.users.messages.send({
              userId: 'me',
              requestBody: {
                raw: encodedMessage,
                threadId: threadId  ← if replying
              }
            })
          - Returns { success: boolean, error?: string }

          gmail:markRead
          - Args: { threadId: string }
          - Removes UNREAD label:
              gmail.users.threads.modify({
                userId: 'me',
                id: threadId,
                requestBody: {
                  removeLabelIds: ['UNREAD']
                }
              })

- [ ] // MAIL — layout and UI
      - Follows standard three-column layout:
          Sidebar + Middle (thread list) + Right (email view)
      - NOT full-width like // NODE

      AUTH REQUIRED STATE:
      - When status is AUTH_REQUIRED:
        Middle and right panels show centered state:
          ✉ icon, font-size 28px, color var(--dimmer)
          "// GMAIL — NOT CONNECTED"
          font-size 9px, color var(--dim), letter-spacing 4px
          margin-top 12px
          [ CONNECT GMAIL ] button below:
            padding: 8px 20px
            border: 1px solid var(--accent)
            color: var(--accent)
            font-size 9px, letter-spacing 2px
            hover: background var(--bg-hover)
          On click: calls gmailAPI.authorize()
          After auth: reloads thread list automatically

      MIDDLE PANEL — thread list:
      - Panel header: "// MAIL"
        accent color + blinking cursor
      - Search bar at top:
          Same style as // COMMS search bar
          placeholder: "// SEARCH..."
          Filters client-side by subject or sender
      - Loading state: "// LOADING MAIL..." with blink cursor
      - Each thread row:
          padding: 10px 14px
          border-bottom: 1px solid var(--border)
          cursor: pointer
          selected: left border var(--accent), bg var(--bg-hover)
          hover: bg var(--bg-hover)
          animation: fade-up staggered

          ROW LAYOUT:
          Top row: sender name (left) + timestamp (right)
            Sender:
              font: Rajdhani 600, font-size 11px
              color: var(--text)
              unread: color var(--accent), font-weight 700
            Timestamp:
              font-size 8px, color var(--dimmer)
              relative time format
          Second row: subject line
            font-size 10px, color var(--dim)
            unread: color var(--text)
            truncate with ellipsis
          Third row: snippet
            font-size 9px, color var(--dimmer)
            truncate with ellipsis

          Unread dot: same as // COMMS
            5px circle, color var(--accent)
            left of sender name, unread only

      - Load more: [ LOAD MORE ] button at bottom of list
        Calls getThreads with nextPageToken

      RIGHT PANEL — email view:
      - Empty state:
          Centered ✉ + "// SELECT AN EMAIL"
          same pattern as other empty states

      - Email header section:
          border-bottom: 1px solid var(--border)
          padding: 16px 20px
          Subject: Rajdhani 700, font-size 14px,
            color var(--accent2), letter-spacing 0.5px
          From row: "FROM  name@email.com"
            label: font-size 8px, color var(--dimmer),
                   letter-spacing 3px, margin-right 8px
            value: font-size 10px, color var(--dim)
          Date row: same label/value pattern
          [ REPLY ] button top-right of header:
            padding: 5px 14px, font-size 9px
            border: 1px solid var(--accent)
            color: var(--accent), letter-spacing 2px
            hover: background var(--bg-hover)

      - Email body:
          flex: 1, overflow-y auto, padding: 20px
          font: Share Tech Mono, 12px
          color: var(--text), line-height 1.8
          Plain text rendering — no HTML
          If HTML email: strip all tags, show plain text only

      - Reply composer (hidden until [ REPLY ] clicked):
          Slides in from bottom, pushes email body up
          border-top: 1px solid var(--border-md)
          padding: 14px 20px
          "// REPLY" label: font-size 8px, color var(--dim),
            letter-spacing 3px, margin-bottom 8px
          Textarea:
            width: 100%, min-height: 80px
            font: Share Tech Mono, 11px
            color: var(--text), background: var(--bg-panel)
            border: 1px solid var(--border-md)
            padding: 10px 12px, resize: none
            focus: border-color var(--accent)
          Button row right-aligned:
            [ SEND REPLY ]  [ CANCEL ]
            [ SEND REPLY ]: border/color var(--accent)
            [ CANCEL ]: border/color var(--dimmer)
            Disabled while sending
          On send success:
            Hide composer
            Show "// REPLY SENT ✓" briefly in accent2
            then fade out after 2 seconds
          On send fail:
            "// SEND FAILED" in #ff4444
            [ RETRY ] button
      - Add to the CONNECTIONS settings stub:
          Label: "// PUSHBULLET"
          Input: API key field (password masked)
          Hint text: "get your key at pushbullet.com/account"
            font-size 8px, color var(--dimmer)
          [ SAVE ] writes to electron-store key: 'pushbullet.apiKey'
          After save: show "CONFIGURED ✓" in var(--accent2)
      - This unblocks // MESSAGES from the NO_API_KEY error state