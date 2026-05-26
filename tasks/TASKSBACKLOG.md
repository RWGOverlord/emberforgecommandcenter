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

- [x] Refactor — split App.tsx into component files
      - IMPORTANT: this is a refactor only
        Zero functional changes — UI must look and
        behave identically before and after
        Do not add features during this refactor

      - Create src/components/ folder structure:
          src/components/
            Sidebar.tsx
            StatusBar.tsx
            NodePanel.tsx
            projects/
              ProjectList.tsx
              ProjectDetail.tsx
              ProjectOverview.tsx
              ProjectArchMap.tsx    ← stub, empty for now
              ProjectAgent.tsx
              ProjectLogs.tsx
              StatCard.tsx
            vault/
              VaultSidebar.tsx
              VaultFileList.tsx
              VaultEditor.tsx
            mail/
              MailList.tsx
              MailDetail.tsx
              MailCompose.tsx
            comms/
              CommsList.tsx
              CommsThread.tsx
            system/
              SystemDisplay.tsx
              SystemConnections.tsx
              SystemQuickLaunch.tsx
              SystemVaultPath.tsx
              SystemAbout.tsx
            shared/
              ImageModal.tsx
              EmptyState.tsx

      - Move each component out of App.tsx into
        its own file
        Props and state interfaces move with the component
        Local state stays local where possible
        Shared state (activeSection, selectedProject, etc.)
        stays in App.tsx and passed as props

      - App.tsx after refactor should contain only:
          - Global state (activeSection, selectedItem, etc.)
          - Boot animation logic
          - Root layout (sidebar + main content area)
          - Conditional rendering based on activeSection
          - Global useEffects (brightness, font size,
            text contrast on mount)
          - Nothing else

      - After each component is extracted:
          Verify app still compiles: npm run build
          Fix any type errors before moving to next
          component
          Do one component at a time — do not extract
          everything at once

      - Order to extract (least risky first):
          1. StatusBar
          2. EmptyState (shared)
          3. Sidebar
          4. NodePanel
          5. StatCard
          6. ProjectLogs
          7. ProjectAgent
          8. ProjectOverview (overview tab)
          9. ProjectDetail (wrapper)
          10. ProjectList
          11. VaultFileList
          12. VaultEditor
          13. MailList + MailDetail + MailCompose
          14. CommsList + CommsThread
          15. SystemDisplay + other system panels
          16. ImageModal (shared)
          17. ProjectArchMap stub (empty component,
              returns placeholder div only)

      - Build must pass clean after every extraction
        tsc + vite build, 0 errors, 0 warnings
- [x] Architecture map — per project visual dependency graph
      - PLANNED FEATURE — full spec to be written after
        JSDoc commenting is complete across all projects
      - Concept: interactive visual map of a project's
        file structure and dependencies, rendered in the
        right panel of // PROJECTS
      - Each file is a node, imports/calls are edges
        Color coded by layer:
          Pages:      var(--accent)   cyan
          Components: var(--accent2)  teal
          API Routes: #ffc200         gold
          Utils/Lib:  var(--dim)      muted
          External:   #b44dff         purple
      - Clicking a node shows file summary panel
        populated from @fileoverview JSDoc block
        and @depends tags
      - Right panel with zoom, pan, horizontal +
        vertical scroll
      - Tech: D3.js for graph rendering, Node.js
        import parser to build dependency JSON
        from local repo files on disk
      - DO NOT BUILD YET — placeholder only
- [x] // NODE — personal reminders strip
      - New full-width row above // QUICK LAUNCH
        spanning both columns (grid-column: 1 / -1)
        border-top: 1px solid var(--border)
        border-bottom: 1px solid var(--border)
        min-height: 80px, max-height: 140px
        padding: 10px 20px
        display: flex, flex-direction: column, gap: 6px

      REMINDERS FILE:
      - Path: /Users/risingwarriorgames/Documents/
          07_TechProjects/EmberforgeCommandCenter/
          REMINDERS.md
      - Read/write via existing project:readFile
        and project:writeFile IPC handlers
        repoPath: EmberforgeCommandCenter folder
        filename: REMINDERS.md
      - File format:
          # REMINDERS

          - [ ] Design ZO2 box art | due:2026-06-01
          - [ ] Fix DoulaFlow intake bug | due:2026-05-26
          - [x] Update TASKS.md | due:2026-05-20 | archived
          - [ ] Call vendor about components | due:none

        Rules:
          Active:   - [ ] title | due:YYYY-MM-DD
          Done:     - [x] title | due:YYYY-MM-DD | archived
          No date:  - [ ] title | due:none
      - Parse on mount, re-parse after every save
      - Create file with empty # REMINDERS header
        if it doesn't exist yet

      HEADER ROW:
      - Left: "// REMINDERS"
          font-size 8px, color var(--dim), letter-spacing 3px
      - Right: [ + ADD ] button
          font-size 8px, letter-spacing 2px
          border: 1px solid var(--border-md)
          color: var(--dimmer), padding: 3px 8px
          hover: border var(--accent), color var(--accent)

      REMINDER LIST:
      - Horizontal scrolling row of reminder items
        display: flex, flex-direction: row, gap: 12px
        overflow-x: auto, padding-bottom: 4px
        scrollbar height 2px
      - Sort order:
          1. Overdue (past due date) — first, color #ff4444
          2. Due today — second, color #ffc200
          3. Upcoming — by due date ascending
          4. No due date — after dated items
          5. Archived — last, dimmed

      EACH REMINDER CARD:
        min-width: 180px, max-width: 220px
        border: 1px solid var(--border-md)
        background: var(--bg-panel)
        padding: 8px 10px
        flex-shrink: 0
        position: relative

        Top row:
          Checkbox: custom styled
            □ unchecked: border 1px solid var(--dim)
            ✓ checked: border + color var(--accent2)
            width/height: 10px, margin-right 6px
          Title: font-size 9px, color var(--text)
            letter-spacing 0.5px
            max 2 lines, overflow hidden
            checked/archived: color var(--dimmer)
              text-decoration: line-through

        Due date row:
          font-size 8px, letter-spacing 1px
          Overdue:  color #ff4444  "⚠ DUE MAY 20"
          Today:    color #ffc200  "⚠ DUE TODAY"
          Upcoming: color var(--dim) "DUE JUN 1"
          No date:  color var(--dimmer) "NO DUE DATE"
          Archived: color var(--dimmer) "ARCHIVED"

        [ × ] remove button top-right corner:
          position: absolute, top: 4px, right: 6px
          font-size 8px, color var(--dimmer)
          hover: color #ff4444
          On click: remove from REMINDERS.md entirely
          No confirmation (file is recoverable manually)

        Click on card (not checkbox, not ×):
          Opens inline edit mode for that card
          (see ADD/EDIT FORM below)

        Click checkbox:
          Toggle [ ] ↔ [x] + archived tag
          Write back to REMINDERS.md immediately

      ADD/EDIT FORM:
      - Opens as an overlay card in the reminders strip
        or inline replacing the clicked card
        same card dimensions, slightly taller
        border-color: var(--accent)

        Title input:
          font: Share Tech Mono, 10px
          color: var(--text), background: transparent
          border: none, border-bottom: 1px solid var(--border-md)
          width: 100%, padding: 2px 0
          placeholder: "reminder title..."
          auto-focus on open

        Due date input:
          type="date"
          font: Share Tech Mono, 9px
          color: var(--dim), background: var(--bg)
          border: 1px solid var(--border-md)
          padding: 3px 6px, margin-top: 6px
          width: 100%
          accent-color: var(--accent)
          Optional — can be left empty (saves as due:none)

        Button row:
          [ SAVE ]  [ CANCEL ]
          font-size 8px, padding: 3px 8px
          [ SAVE ]: border/color var(--accent)
          [ CANCEL ]: border/color var(--dimmer)

        SAVE behavior:
          Append new line to REMINDERS.md
            or update existing line in place
          Re-parse and re-render reminder list
          Close form

      EMPTY STATE:
        If no reminders yet:
          "// NO REMINDERS — [ + ADD ]"
          font-size 9px, color var(--dimmer)
          letter-spacing 2px, centered vertically
          [ + ADD ] inline clickable, color var(--accent)

- [x] Image modal — shared component

      - Create src/components/ImageModal.tsx
        Used by both // MAIL and // COMMS
      - Props:
          src: string
          onClose: () => void
      - Full screen overlay:
          position: fixed, inset: 0, zIndex: 100
          background: rgba(2, 8, 16, 0.95)
          display: flex, align-items center,
          justify-content center
          onClick on overlay: calls onClose
      - Image:
          max-width: 90vw, max-height: 90vh
          object-fit: contain
          border: 1px solid var(--border-md)
          onClick: stopPropagation (don't close on img click)
      - Close button top-right:
          "[ CLOSE ]" font-size 9px, letter-spacing 2px
          color var(--dim), position absolute
          top: 20px, right: 20px
          hover: color var(--accent)
      - Escape key also closes modal
      - Animate in: fade + slight scale up
          opacity 0 scale(0.95) →
          opacity 1 scale(1), duration 150ms
      - Replace current stub placeholder with
        functional settings view
      - Layout:
          Header: "// VAULT PATH"
            Rajdhani 700, accent color, letter-spacing 1px
            border-bottom: 1px solid var(--border)
            padding: 14px 20px

          Current path field:
            Label: "// CURRENT PATH"
              font-size 8px, color var(--dim),
              letter-spacing 3px, margin-bottom 6px
            Text input pre-filled with current vault path
              read from electron-store 'vaultPath'
            Full width, same input style as rest of app
            hint below: "absolute path to your vault folder"
              font-size 8px, color var(--dimmer)

          OR:
            [ CHOOSE FOLDER ] button below input
              opens native folder picker dialog
              same as vault:choosePath IPC handler
              auto-fills the input on selection

          Buttons row right-aligned:
            [ SAVE ]  [ CANCEL ]
            [ SAVE ]: writes to electron-store 'vaultPath'
              triggers vault sidebar to reload tree
              show "// SAVED ✓" briefly in accent2
              then return to normal display
            [ CANCEL ]: discard changes

          padding: 20px

- [x] // SYSTEM → QUICK LAUNCH — manage pinned apps
      - Replace current stub placeholder with
        functional settings view
      - Layout:
          Header: "// QUICK LAUNCH"
            Rajdhani 700, accent color, letter-spacing 1px
            border-bottom: 1px solid var(--border)
            padding: 14px 20px

          App list — current pinned apps:
            Read from electron-store 'quickLaunch'
            Default if not set:
              [
                { label: 'VS CODE', path: '/Applications/Visual Studio Code.app' },
                { label: 'BRAVE',   path: '/Applications/Brave Browser.app' }
              ]
            Max 6 entries — [ + ADD APP ] hidden when 6 reached

          Each app row:
            display: flex, align-items center, gap 10px
            padding: 10px 0
            border-bottom: 1px solid var(--border)

            Label input:
              width: 100px, flex-shrink 0
              font: Share Tech Mono, same input style
              placeholder: "LABEL"
              all caps enforced: toUpperCase() on change

            Path input:
              flex: 1
              font: Share Tech Mono, same input style
              placeholder: "/Applications/App.app"

            [ REMOVE ] button:
              font-size 8px, letter-spacing 1px
              color: #ff444466
              border: 1px solid #ff444422
              padding: 3px 8px
              hover: color #ff4444, border-color #ff4444
              On click: remove row immediately
              No confirmation needed (not destructive
              since nothing on disk is touched)

          [ + ADD APP ] button below list:
            width: 100%, padding: 8px
            border: 1px solid var(--border-md)
            color: var(--dimmer), background: transparent
            hover: border var(--accent), color var(--accent)
            Adds new empty row to list
            Disabled + greyed when 6 apps reached
            Show "// MAX 6 APPS" note when at limit
              font-size 8px, color var(--dimmer)

          Buttons row right-aligned:
            [ SAVE ]  [ CANCEL ]
            [ SAVE ]:
              Validates all rows have both label and path
              If invalid: "// ALL FIELDS REQUIRED"
                in #ff4444 below list
              On valid: writes array to electron-store
                key: 'quickLaunch'
              Updates // NODE Quick Launch buttons
                immediately without restart
              Show "// SAVED ✓" briefly in accent2
            [ CANCEL ]: discard all changes,
              restore original values

          padding: 20px

      - // NODE Quick Launch zone:
          Read from electron-store 'quickLaunch'
          on mount instead of hardcoded VS CODE / BRAVE
          Re-reads when settings are saved so it
          updates live without needing app restart

      - New IPC handler:
          ipcMain.handle('supabase:getStatus', async (_, { projectUrl, anonKey }) => {
            Health check:
              GET {projectUrl}/rest/v1/
              Headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`
              }
            Returns:
              { healthy: boolean }
          })
      - Stat card display:
          Top: connection status
            Healthy:    "CONNECTED ✓"  color var(--accent2)
            Unhealthy:  "DEGRADED"     color #ffc200
            Unreachable: "OFFLINE ✗"  color #ff4444
          Middle: project URL truncated
            font-size 8px, color var(--dimmer)
          Bottom: "// last checked HH:MM:SS"
            font-size 8px, color var(--dimmer)
      - Note: deeper table stats (row counts etc.)
        are project-specific and deferred to V2
        since table names differ per project
      - Refresh every 120 seconds
- [x] // MAIL — inline image rendering in email body
      - Currently strips HTML and shows plain text only
        Need to handle emails that contain images

      - Update gmail:getThread IPC handler in main.cjs:
          When extracting message body:
            Check message parts for multipart/related
            or multipart/mixed content types
            Extract inline images (Content-ID attachments):
              parts where mimeType starts with 'image/'
              get the attachment data:
                gmail.users.messages.attachments.get({
                  userId: 'me',
                  messageId: messageId,
                  id: part.body.attachmentId
                })
              Convert to base64 data URL:
                `data:${mimeType};base64,${data}`
              Map Content-ID to data URL:
                { [contentId]: dataUrl }
            Replace cid: references in HTML body:
              html.replace(/src="cid:([^"]+)"/g,
                (_, cid) => `src="${cidMap[cid] ?? ''}"`)

      - Update email body rendering in right panel:
          Switch from plain text to sanitized HTML
          rendering when email has HTML content
          Use DOMParser to sanitize:
            strip <script>, <style>, on* attributes
            keep <img>, <a>, <p>, <br>, <table> etc.
          Render via dangerouslySetInnerHTML on a
          div with class 'email-body'
          Scoped styles for .email-body:
            img:
              max-width: 100%
              height: auto
              border: 1px solid var(--border-md)
              margin: 8px 0
            a:
              color: var(--accent)
              text-decoration: none
              border-bottom: 1px solid var(--accent)44
            p, div:
              color: var(--text)
              font-family: var(--font-mono)
              font-size: 12px
              line-height: 1.8
            table:
              max-width: 100%
              border-collapse: collapse

- [x] Image modal — shared component

      - Create src/components/ImageModal.tsx
        Used by both // MAIL and // COMMS
      - Props:
          src: string
          onClose: () => void
      - Full screen overlay:
          position: fixed, inset: 0, zIndex: 100
          background: rgba(2, 8, 16, 0.95)
          display: flex, align-items center,
          justify-content center
          onClick on overlay: calls onClose
      - Image:
          max-width: 90vw, max-height: 90vh
          object-fit: contain
          border: 1px solid var(--border-md)
          onClick: stopPropagation (don't close on img click)
      - Close button top-right:
          "[ CLOSE ]" font-size 9px, letter-spacing 2px
          color var(--dim), position absolute
          top: 20px, right: 20px
          hover: color var(--accent)
      - Escape key also closes modal
      - Animate in: fade + slight scale up
          opacity 0 scale(0.95) →
          opacity 1 scale(1), duration 150ms

- [x] // PROJECTS — add and manage projects

- [x] Refactor — split App.tsx into component files
      - IMPORTANT: this is a refactor only
        Zero functional changes — UI must look and
        behave identically before and after
        Do not add features during this refactor

      - Create src/components/ folder structure:
          src/components/
            Sidebar.tsx
            StatusBar.tsx
            NodePanel.tsx
            projects/
              ProjectList.tsx
              ProjectDetail.tsx
              ProjectOverview.tsx
              ProjectArchMap.tsx    ← stub, empty for now
              ProjectAgent.tsx
              ProjectLogs.tsx
              StatCard.tsx
            vault/
              VaultSidebar.tsx
              VaultFileList.tsx
              VaultEditor.tsx
            mail/
              MailList.tsx
              MailDetail.tsx
              MailCompose.tsx
            comms/
              CommsList.tsx
              CommsThread.tsx
            system/
              SystemDisplay.tsx
              SystemConnections.tsx
              SystemQuickLaunch.tsx
              SystemVaultPath.tsx
              SystemAbout.tsx
            shared/
              ImageModal.tsx
              EmptyState.tsx

      - Move each component out of App.tsx into
        its own file
        Props and state interfaces move with the component
        Local state stays local where possible
        Shared state (activeSection, selectedProject, etc.)
        stays in App.tsx and passed as props

      - App.tsx after refactor should contain only:
          - Global state (activeSection, selectedItem, etc.)
          - Boot animation logic
          - Root layout (sidebar + main content area)
          - Conditional rendering based on activeSection
          - Global useEffects (brightness, font size,
            text contrast on mount)
          - Nothing else

      - After each component is extracted:
          Verify app still compiles: npm run build
          Fix any type errors before moving to next
          component
          Do one component at a time — do not extract
          everything at once

      - Order to extract (least risky first):
          1. StatusBar
          2. EmptyState (shared)
          3. Sidebar
          4. NodePanel
          5. StatCard
          6. ProjectLogs
          7. ProjectAgent
          8. ProjectOverview (overview tab)
          9. ProjectDetail (wrapper)
          10. ProjectList
          11. VaultFileList
          12. VaultEditor
          13. MailList + MailDetail + MailCompose
          14. CommsList + CommsThread
          15. SystemDisplay + other system panels
          16. ImageModal (shared)
          17. ProjectArchMap stub (empty component,
              returns placeholder div only)

      - Build must pass clean after every extraction
        tsc + vite build, 0 errors, 0 warnings
- [x] Architecture map — per project visual dependency graph
      - PLANNED FEATURE — full spec to be written after
        JSDoc commenting is complete across all projects
      - Concept: interactive visual map of a project's
        file structure and dependencies, rendered in the
        right panel of // PROJECTS
      - Each file is a node, imports/calls are edges
        Color coded by layer:
          Pages:      var(--accent)   cyan
          Components: var(--accent2)  teal
          API Routes: #ffc200         gold
          Utils/Lib:  var(--dim)      muted
          External:   #b44dff         purple
      - Clicking a node shows file summary panel
        populated from @fileoverview JSDoc block
        and @depends tags
      - Right panel with zoom, pan, horizontal +
        vertical scroll
      - Tech: D3.js for graph rendering, Node.js
        import parser to build dependency JSON
        from local repo files on disk
      - DO NOT BUILD YET — placeholder only
- [x] // NODE — personal reminders strip
      - New full-width row above // QUICK LAUNCH
        spanning both columns (grid-column: 1 / -1)
        border-top: 1px solid var(--border)
        border-bottom: 1px solid var(--border)
        min-height: 80px, max-height: 140px
        padding: 10px 20px
        display: flex, flex-direction: column, gap: 6px

      REMINDERS FILE:
      - Path: /Users/risingwarriorgames/Documents/
          07_TechProjects/EmberforgeCommandCenter/
          REMINDERS.md
      - Read/write via existing project:readFile
        and project:writeFile IPC handlers
        repoPath: EmberforgeCommandCenter folder
        filename: REMINDERS.md
      - File format:
          # REMINDERS

          - [ ] Design ZO2 box art | due:2026-06-01
          - [ ] Fix DoulaFlow intake bug | due:2026-05-26
          - [x] Update TASKS.md | due:2026-05-20 | archived
          - [ ] Call vendor about components | due:none

        Rules:
          Active:   - [ ] title | due:YYYY-MM-DD
          Done:     - [x] title | due:YYYY-MM-DD | archived
          No date:  - [ ] title | due:none
      - Parse on mount, re-parse after every save
      - Create file with empty # REMINDERS header
        if it doesn't exist yet

      HEADER ROW:
      - Left: "// REMINDERS"
          font-size 8px, color var(--dim), letter-spacing 3px
      - Right: [ + ADD ] button
          font-size 8px, letter-spacing 2px
          border: 1px solid var(--border-md)
          color: var(--dimmer), padding: 3px 8px
          hover: border var(--accent), color var(--accent)

      REMINDER LIST:
      - Horizontal scrolling row of reminder items
        display: flex, flex-direction: row, gap: 12px
        overflow-x: auto, padding-bottom: 4px
        scrollbar height 2px
      - Sort order:
          1. Overdue (past due date) — first, color #ff4444
          2. Due today — second, color #ffc200
          3. Upcoming — by due date ascending
          4. No due date — after dated items
          5. Archived — last, dimmed

      EACH REMINDER CARD:
        min-width: 180px, max-width: 220px
        border: 1px solid var(--border-md)
        background: var(--bg-panel)
        padding: 8px 10px
        flex-shrink: 0
        position: relative

        Top row:
          Checkbox: custom styled
            □ unchecked: border 1px solid var(--dim)
            ✓ checked: border + color var(--accent2)
            width/height: 10px, margin-right 6px
          Title: font-size 9px, color var(--text)
            letter-spacing 0.5px
            max 2 lines, overflow hidden
            checked/archived: color var(--dimmer)
              text-decoration: line-through

        Due date row:
          font-size 8px, letter-spacing 1px
          Overdue:  color #ff4444  "⚠ DUE MAY 20"
          Today:    color #ffc200  "⚠ DUE TODAY"
          Upcoming: color var(--dim) "DUE JUN 1"
          No date:  color var(--dimmer) "NO DUE DATE"
          Archived: color var(--dimmer) "ARCHIVED"

        [ × ] remove button top-right corner:
          position: absolute, top: 4px, right: 6px
          font-size 8px, color var(--dimmer)
          hover: color #ff4444
          On click: remove from REMINDERS.md entirely
          No confirmation (file is recoverable manually)

        Click on card (not checkbox, not ×):
          Opens inline edit mode for that card
          (see ADD/EDIT FORM below)

        Click checkbox:
          Toggle [ ] ↔ [x] + archived tag
          Write back to REMINDERS.md immediately

      ADD/EDIT FORM:
      - Opens as an overlay card in the reminders strip
        or inline replacing the clicked card
        same card dimensions, slightly taller
        border-color: var(--accent)

        Title input:
          font: Share Tech Mono, 10px
          color: var(--text), background: transparent
          border: none, border-bottom: 1px solid var(--border-md)
          width: 100%, padding: 2px 0
          placeholder: "reminder title..."
          auto-focus on open

        Due date input:
          type="date"
          font: Share Tech Mono, 9px
          color: var(--dim), background: var(--bg)
          border: 1px solid var(--border-md)
          padding: 3px 6px, margin-top: 6px
          width: 100%
          accent-color: var(--accent)
          Optional — can be left empty (saves as due:none)

        Button row:
          [ SAVE ]  [ CANCEL ]
          font-size 8px, padding: 3px 8px
          [ SAVE ]: border/color var(--accent)
          [ CANCEL ]: border/color var(--dimmer)

        SAVE behavior:
          Append new line to REMINDERS.md
            or update existing line in place
          Re-parse and re-render reminder list
          Close form

      EMPTY STATE:
        If no reminders yet:
          "// NO REMINDERS — [ + ADD ]"
          font-size 9px, color var(--dimmer)
          letter-spacing 2px, centered vertically
          [ + ADD ] inline clickable, color var(--accent)

- [x] Image modal — shared component

      - Create src/components/ImageModal.tsx
        Used by both // MAIL and // COMMS
      - Props:
          src: string
          onClose: () => void
      - Full screen overlay:
          position: fixed, inset: 0, zIndex: 100
          background: rgba(2, 8, 16, 0.95)
          display: flex, align-items center,
          justify-content center
          onClick on overlay: calls onClose
      - Image:
          max-width: 90vw, max-height: 90vh
          object-fit: contain
          border: 1px solid var(--border-md)
          onClick: stopPropagation (don't close on img click)
      - Close button top-right:
          "[ CLOSE ]" font-size 9px, letter-spacing 2px
          color var(--dim), position absolute
          top: 20px, right: 20px
          hover: color var(--accent)
      - Escape key also closes modal
      - Animate in: fade + slight scale up
          opacity 0 scale(0.95) →
          opacity 1 scale(1), duration 150ms
      - Replace current stub placeholder with
        functional settings view
      - Layout:
          Header: "// VAULT PATH"
            Rajdhani 700, accent color, letter-spacing 1px
            border-bottom: 1px solid var(--border)
            padding: 14px 20px

          Current path field:
            Label: "// CURRENT PATH"
              font-size 8px, color var(--dim),
              letter-spacing 3px, margin-bottom 6px
            Text input pre-filled with current vault path
              read from electron-store 'vaultPath'
            Full width, same input style as rest of app
            hint below: "absolute path to your vault folder"
              font-size 8px, color var(--dimmer)

          OR:
            [ CHOOSE FOLDER ] button below input
              opens native folder picker dialog
              same as vault:choosePath IPC handler
              auto-fills the input on selection

          Buttons row right-aligned:
            [ SAVE ]  [ CANCEL ]
            [ SAVE ]: writes to electron-store 'vaultPath'
              triggers vault sidebar to reload tree
              show "// SAVED ✓" briefly in accent2
              then return to normal display
            [ CANCEL ]: discard changes

          padding: 20px

- [x] // SYSTEM → QUICK LAUNCH — manage pinned apps
      - Replace current stub placeholder with
        functional settings view
      - Layout:
          Header: "// QUICK LAUNCH"
            Rajdhani 700, accent color, letter-spacing 1px
            border-bottom: 1px solid var(--border)
            padding: 14px 20px

          App list — current pinned apps:
            Read from electron-store 'quickLaunch'
            Default if not set:
              [
                { label: 'VS CODE', path: '/Applications/Visual Studio Code.app' },
                { label: 'BRAVE',   path: '/Applications/Brave Browser.app' }
              ]
            Max 6 entries — [ + ADD APP ] hidden when 6 reached

          Each app row:
            display: flex, align-items center, gap 10px
            padding: 10px 0
            border-bottom: 1px solid var(--border)

            Label input:
              width: 100px, flex-shrink 0
              font: Share Tech Mono, same input style
              placeholder: "LABEL"
              all caps enforced: toUpperCase() on change

            Path input:
              flex: 1
              font: Share Tech Mono, same input style
              placeholder: "/Applications/App.app"

            [ REMOVE ] button:
              font-size 8px, letter-spacing 1px
              color: #ff444466
              border: 1px solid #ff444422
              padding: 3px 8px
              hover: color #ff4444, border-color #ff4444
              On click: remove row immediately
              No confirmation needed (not destructive
              since nothing on disk is touched)

          [ + ADD APP ] button below list:
            width: 100%, padding: 8px
            border: 1px solid var(--border-md)
            color: var(--dimmer), background: transparent
            hover: border var(--accent), color var(--accent)
            Adds new empty row to list
            Disabled + greyed when 6 apps reached
            Show "// MAX 6 APPS" note when at limit
              font-size 8px, color var(--dimmer)

          Buttons row right-aligned:
            [ SAVE ]  [ CANCEL ]
            [ SAVE ]:
              Validates all rows have both label and path
              If invalid: "// ALL FIELDS REQUIRED"
                in #ff4444 below list
              On valid: writes array to electron-store
                key: 'quickLaunch'
              Updates // NODE Quick Launch buttons
                immediately without restart
              Show "// SAVED ✓" briefly in accent2
            [ CANCEL ]: discard all changes,
              restore original values

          padding: 20px

      - // NODE Quick Launch zone:
          Read from electron-store 'quickLaunch'
          on mount instead of hardcoded VS CODE / BRAVE
          Re-reads when settings are saved so it
          updates live without needing app restart

      - New IPC handler:
          ipcMain.handle('supabase:getStatus', async (_, { projectUrl, anonKey }) => {
            Health check:
              GET {projectUrl}/rest/v1/
              Headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`
              }
            Returns:
              { healthy: boolean }
          })
      - Stat card display:
          Top: connection status
            Healthy:    "CONNECTED ✓"  color var(--accent2)
            Unhealthy:  "DEGRADED"     color #ffc200
            Unreachable: "OFFLINE ✗"  color #ff4444
          Middle: project URL truncated
            font-size 8px, color var(--dimmer)
          Bottom: "// last checked HH:MM:SS"
            font-size 8px, color var(--dimmer)
      - Note: deeper table stats (row counts etc.)
        are project-specific and deferred to V2
        since table names differ per project
      - Refresh every 120 seconds
- [x] // MAIL — inline image rendering in email body
      - Currently strips HTML and shows plain text only
        Need to handle emails that contain images

      - Update gmail:getThread IPC handler in main.cjs:
          When extracting message body:
            Check message parts for multipart/related
            or multipart/mixed content types
            Extract inline images (Content-ID attachments):
              parts where mimeType starts with 'image/'
              get the attachment data:
                gmail.users.messages.attachments.get({
                  userId: 'me',
                  messageId: messageId,
                  id: part.body.attachmentId
                })
              Convert to base64 data URL:
                `data:${mimeType};base64,${data}`
              Map Content-ID to data URL:
                { [contentId]: dataUrl }
            Replace cid: references in HTML body:
              html.replace(/src="cid:([^"]+)"/g,
                (_, cid) => `src="${cidMap[cid] ?? ''}"`)

      - Update email body rendering in right panel:
          Switch from plain text to sanitized HTML
          rendering when email has HTML content
          Use DOMParser to sanitize:
            strip <script>, <style>, on* attributes
            keep <img>, <a>, <p>, <br>, <table> etc.
          Render via dangerouslySetInnerHTML on a
          div with class 'email-body'
          Scoped styles for .email-body:
            img:
              max-width: 100%
              height: auto
              border: 1px solid var(--border-md)
              margin: 8px 0
            a:
              color: var(--accent)
              text-decoration: none
              border-bottom: 1px solid var(--accent)44
            p, div:
              color: var(--text)
              font-family: var(--font-mono)
              font-size: 12px
              line-height: 1.8
            table:
              max-width: 100%
              border-collapse: collapse

- [x] Image modal — shared component

      - Create src/components/ImageModal.tsx
        Used by both // MAIL and // COMMS
      - Props:
          src: string
          onClose: () => void
      - Full screen overlay:
          position: fixed, inset: 0, zIndex: 100
          background: rgba(2, 8, 16, 0.95)
          display: flex, align-items center,
          justify-content center
          onClick on overlay: calls onClose
      - Image:
          max-width: 90vw, max-height: 90vh
          object-fit: contain
          border: 1px solid var(--border-md)
          onClick: stopPropagation (don't close on img click)
      - Close button top-right:
          "[ CLOSE ]" font-size 9px, letter-spacing 2px
          color var(--dim), position absolute
          top: 20px, right: 20px
          hover: color var(--accent)
      - Escape key also closes modal
      - Animate in: fade + slight scale up
          opacity 0 scale(0.95) →
          opacity 1 scale(1), duration 150ms

- [x] // PROJECTS — add and manage projects