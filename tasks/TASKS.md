# EMBERFORGE COMMAND CENTER — TASKS

## In Progress
- [ ] Architecture map — per project visual dependency graph
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
      - Add [ + NEW PROJECT ] button at the bottom
        of the middle panel project list
        Style:
          width: calc(100% - 32px), margin: 12px 16px
          padding: 8px, font-size 9px, letter-spacing 2px
          border: 1px solid var(--border-md)
          color: var(--dimmer), background: transparent
          hover: border var(--accent), color var(--accent)
          transition: all 0.15s ease

      - Clicking [ + NEW PROJECT ] opens a form in the
        right panel replacing the empty state:
          Header: "// NEW PROJECT"
            Rajdhani 700, accent color, letter-spacing 1px
            border-bottom: 1px solid var(--border)
            padding: 14px 20px

          FORM FIELDS (each field same input style as
          SYSTEM → DISPLAY settings inputs):
            Label:        text input  — e.g. "DoulaFlow"
            Repo Path:    text input  — full local path
                          hint: "/Users/risingwarriorgames/
                                 Documents/07_TechProjects/..."
            Context File: text input  — e.g. "CLAUDE.md"
                          hint: "name of AI context file
                                 at repo root"
            Tasks File:   text input  — default "TASKS.md"
            Bugs File:    text input  — default "BUGS.md"
            Vercel ID:    text input  — optional
            Status:       single select toggle:
                          [ LIVE ] [ LOCAL ] [ REPO ] [ PLANNED ]
                          same mode button style as text contrast

          Buttons row right-aligned:
            [ CREATE PROJECT ]  [ CANCEL ]
            [ CREATE PROJECT ]: border/color var(--accent)
            [ CANCEL ]: border/color var(--dimmer)

      - CREATE PROJECT behavior:
          Validate: Label and Repo Path are required
          If missing: show "// LABEL AND REPO PATH REQUIRED"
            in #ff4444 below the form fields
          On valid submit:
            Read existing projects from electron-store
              key: 'projects'
              (migrate from projects.json import to
               electron-store if not already done)
            Generate id from label:
              label.toLowerCase().replace(/\s+/g, '-')
            Append new project object to array
            Write back to electron-store
            Close form, select new project in list,
            show its detail panel

      - Project list reads from electron-store 'projects'
        key on mount and whenever a project is added
        Falls back to projects.json defaults if store
        is empty (first launch migration)

      - Also add [ REMOVE ] to existing project detail
        panel header — far right, small, destructive:
          font-size 8px, color #ff444466
          border: 1px solid #ff444433
          padding: 3px 8px, letter-spacing 2px
          hover: color #ff4444, border-color #ff4444
        On click: show inline confirmation in header:
          "// REMOVE PROJECT?  [ CONFIRM ]  [ ABORT ]"
          [ CONFIRM ] removes from electron-store array,
            navigates back to empty state
          [ ABORT ] dismisses confirmation
        Note: only removes from Command Center —
          never touches files on disk

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