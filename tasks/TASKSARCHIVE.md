
### Shell / Infrastructure

- [x] Add // VAULT to NAV_ITEMS
      - id: 'vault', label: '// VAULT', icon: '≡'
      - Position: index 1 (after // NODE, before // PROJECTS)
      - No divider

- [x] Update boot sequence lines
      - Replace generic lines with accurate ones:
          > INIT EMBERFORGE COMMAND CENTER v0.1.0...
          > LOADING CORE MODULES...
          > MOUNTING VAULT: RISING WARRIOR GAMES...
          > INDEXING FILES...
          > CONNECTING PROJECT REGISTRY...
          > ALL SYSTEMS NOMINAL.
          > WELCOME BACK, OPERATOR.

- [x] Update status bar
      - Replace "⬡ PROJECTS: 4" with
        dynamic vault file count once vault loads:
          ⬡ VAULT: [N] FILES
        Show 0 until vault loads

- [x] electron-store setup
      - Install: npm install electron-store
      - Initialize in main.cjs with defaults:
          vaultPath: '/Users/risingwarriorgames/Documents/11_Vault/Rising Warrior Games'
      - Used by vault:getPath and vault:choosePath handlers



### // VAULT — Obsidian Integration

- [x] Electron IPC — vault filesystem bridge
      - All file system access happens in main process (main.cjs)
        never in the renderer — contextIsolation is ON
      - Register these IPC handlers in main.cjs:

          vault:readTree
          - Reads vault root recursively (max 3 levels deep)
          - Returns JSON tree:
              {
                name: string,
                path: string,       ← absolute path
                type: 'folder' | 'file',
                ext: string,        ← '.md', '.txt', etc.
                modified: number,   ← epoch ms
                children?: Node[]   ← folders only
              }
          - Sort: folders first, then files, both alpha
          - Skip hidden files/folders (. prefix)
          - Skip .obsidian system folder entirely

          vault:readFile
          - Args: { path: string }
          - Returns: { content: string, modified: number }
          - Reads file as UTF-8

          vault:writeFile
          - Args: { path: string, content: string }
          - Writes UTF-8, overwrites existing
          - Returns: { success: boolean, error?: string }

          vault:getPath
          - Returns currently configured vault path
            from electron-store (or hardcoded default
            if store is empty)

          vault:choosePath
          - Opens native folder picker dialog
            (dialog.showOpenDialog with properties:
             ['openDirectory'])
          - Saves chosen path to electron-store
          - Returns: { path: string } or null if cancelled

      - Vault default path (hardcoded fallback):
          /Users/risingwarriorgames/Documents/11_Vault/Rising Warrior Games
      - Persist chosen path in electron-store
        key: 'vaultPath'
      - Install electron-store:
          npm install electron-store

- [x] Electron IPC — file watcher
      - Use chokidar to watch vault root for changes
      - Install: npm install chokidar
      - Watch for: add, change, unlink events
      - On any change: send 'vault:changed' event
        to renderer via win.webContents.send()
      - Renderer listens via preload bridge and
        re-fetches the affected folder tree
      - Only watch .md and .txt files
      - Debounce: 300ms to avoid rapid-fire reloads

- [x] Preload bridge — expose vault IPC to renderer
      - Add to electron/preload.cjs:

          vaultAPI: {
            readTree:   () => ipcRenderer.invoke('vault:readTree'),
            readFile:   (path) => ipcRenderer.invoke('vault:readFile', { path }),
            writeFile:  (path, content) => ipcRenderer.invoke('vault:writeFile', { path, content }),
            getPath:    () => ipcRenderer.invoke('vault:getPath'),
            choosePath: () => ipcRenderer.invoke('vault:choosePath'),
            onChange:   (cb) => ipcRenderer.on('vault:changed', cb),
            offChange:  (cb) => ipcRenderer.removeListener('vault:changed', cb),
          }

      - Extend the existing window.electronAPI exposure
        do not replace it

- [x] Sidebar — vault section wired to real data
      - Add // VAULT nav item to NAV_ITEMS in App.tsx
        Position: between // NODE and // PROJECTS
        Icon: ≡
        id: 'vault'
      - When // VAULT is active:
        sidebar shows the game folder list
        replacing the generic nav item list
        for that section only
      - Game folders render as nav items:
          // ZOMBIE OVERLORD
          // ETHEREAL DEPTHS
          // FARMSTEAD ALLIANCE
          etc.
      - Folder names uppercased, // prefix
      - Active game: left border accent + accent2 color
        (same active style as existing nav items)
      - Scroll: sidebar scrolls if vault has many games
      - Loading state: show "// READING VAULT..."
        with blink cursor while tree loads
      - Error state: show "// VAULT NOT FOUND"
        with [ CHOOSE FOLDER ] button below
        Clicking opens vault:choosePath dialog

- [x] Middle panel — file/subfolder list
      - When a game folder is selected in sidebar:
        middle panel shows its contents
      - Panel header: selected game name in accent color
        + blinking cursor (matches existing header style)
      - Contents layout:

        SUBFOLDERS (if any):
        - Render with -- prefix (matches .OS subcategory style)
        - Example: -- Story Line
        - Click to expand inline (chevron ▶ / ▼)
        - Expanded subfolder shows its files indented below
          with 16px left padding
        - Subfolders sort to top of list

        FILES:
        - Filename without .md extension
        - Last modified date on second line:
            Execution Plan
            // modified 3 days ago
          Use relative time (today/yesterday/X days ago/
          X weeks ago) — not raw timestamp
        - .md files only — skip .canvas, .json, etc.

      - Selected file: left border accent, bg-hover
        (same selected style as project list)
      - Empty folder: show ⬡ + "// NO FILES" centered
      - Animate items in with fade-up + staggered delay
        (matches existing list animation pattern)

- [x] Right panel — markdown viewer + editor





- [x] Project scaffolded — Electron + React + Vite + TypeScript
- [x] Electron main process (frameless window, Mac traffic lights)
- [x] Preload bridge (contextIsolation, electronAPI exposed)
- [x] Three-column shell layout (sidebar + middle + right)
- [x] Boot animation (typewriter sequence, fade-up lines)
- [x] Scanline overlay
- [x] Animated grid background
- [x] CSS variable color system (ICY BLUE default)
- [x] Share Tech Mono + Rajdhani fonts
- [x] // prefix nav style with active left border
- [x] Middle panel — project list with status badges
- [x] Right panel — detail view with stat cards + agent stub
- [x] Status bar with live clock
- [x] Build verified clean (tsc + vite build, 0 errors)


### // NODE — Dashboard

- [x] NODE layout — full-width panel, no middle column
      - When activeSection === 'node', the layout changes:
        DO NOT render the middle panel at all
        The NODE panel takes flex: 1 filling the full
        content area to the right of the sidebar
      - All other sections keep the standard
        three-column layout unchanged
      - This is a conditional in App.tsx root layout:
          if activeSection === 'node':
            render <Sidebar> + <NodePanel>
          else:
            render <Sidebar> + <MiddlePanel> + <DetailPanel>
      - NodePanel is a new component: src/NodePanel.tsx

- [x] NodePanel — overall layout
      - Full height, fills available space
      - Background: var(--bg) with GridBg overlay
        (same animated grid as rest of app)
      - Scanline already applied at root level — no duplicate
      - Divided into zones using CSS grid:
          grid-template-columns: 1fr 1fr
          grid-template-rows: auto 1fr auto
          Top-left:    THE WORD
          Top-right:   TIME
          Middle-left: WEATHER
          Middle-right: MARKETS
          Bottom:      QUICK LAUNCH (spans full width)
      - All zone borders: 1px solid var(--border)
      - No rounded corners anywhere
- [x] NodePanel — // WEATHER zone
      - Middle-left, flex: 1 height
      - Border-right: 1px solid var(--border)
      - Padding: 18px 20px
      - Overflow: hidden (no scroll in this zone)

      DATA SOURCE:
      - Open-Meteo API — no API key required
      - Coordinates for Chattanooga, TN:
          lat: 35.0456, lon: -85.3097
      - Fetch URL:
          https://api.open-meteo.com/v1/forecast
            ?latitude=35.0456
            &longitude=-85.3097
            &current=temperature_2m,weathercode,windspeed_10m,relativehumidity_2m
            &hourly=temperature_2m,weathercode,precipitation_probability
            &daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max
            &temperature_unit=fahrenheit
            &wind_speed_unit=mph
            &forecast_days=2
            &timezone=America/Chicago
      - Fetch on component mount
      - Refresh every 30 minutes via setInterval
      - Loading state: show "// FETCHING WEATHER..."
        with blink cursor
      - Error state: show "// WEATHER UNAVAILABLE"
        in var(--dimmer)

      WMO WEATHER CODE → CONDITION + ICON mapping:
        0        → CLEAR           ○
        1        → MOSTLY CLEAR    ○
        2        → PARTLY CLOUDY   ◑
        3        → OVERCAST        ●
        45,48    → FOGGY           ≋
        51,53    → DRIZZLE         ·▼
        55,61    → RAIN            ▼
        63,65    → HEAVY RAIN      ▼▼
        80,81    → RAIN SHOWERS    ▼◦
        95       → THUNDERSTORM    ↯▼
        96,99    → HEAVY TSTORM    ↯▼▼
        71,73,75 → SNOW            ❄
        77,85,86 → SNOW SHOWERS    ❄▼
        66,67    → SLEET           ❄▼▼

      PERIOD MAPPING from hourly data:
        Use today's hourly data (index 0–23)
        Morning:   average of hours 6–11
        Afternoon: average of hours 12–17
        Evening:   average of hours 18–22
        Use most common weathercode in each range

      LAYOUT:
      - Section label: "// WEATHER — CHATTANOOGA, TN"
        font-size 8px, color var(--dim), letter-spacing 3px
        margin-bottom 12px
      - Current conditions row:
        Large temp: Rajdhani 700, font-size 36px,
          color var(--accent), line-height 1
        Condition right of temp:
          Icon + condition label: font-size 10px,
            color #c8e8ff, letter-spacing 1px
          Humidity + wind: font-size 9px, color var(--dim)
            "Humidity 62% · Wind 8mph"
      - Divider: border-top 1px solid #00d4ff12, margin 10px 0
      - Period rows (Morning / Afternoon / Evening):
        Grid: 80px label | 20px icon | 1fr conditions
        Label: font-size 9px, color var(--dim), letter-spacing 1px
        Icon:  font-size 10px, color var(--accent)
        Temp + condition: font-size 10px, color #c8e8ffaa
        Gap between rows: 5px
      - Tomorrow row:
        Thin divider above: border-top 1px solid #00d4ff0f
        padding-top 6px, margin-top 4px
        Format: "TOMORROW  ↯▼  High 81°F  Low 66°F"
        Label: var(--dim), temp values: #c8e8ffaa
- [x] NodePanel — // QUICK LAUNCH zone
      - Full-width bottom strip (grid-column: 1 / -1)
      - [ VS CODE ] and [ BRAVE ] launch via shell.openPath IPC
      - app:open handler in main.cjs, openApp bridge in preload.cjs
      - Hover: border/color accent, background bg-hover

- [x] NodePanel — // THE WORD zone
      - Top-left quadrant, border-right + border-bottom
      - Day-of-week selects theme from verses.json
      - useState(0) passage index, [NEXT] wraps at passages.length
      - Fade transition: opacity 0 → 150ms → update → opacity 1
      - Layout: section label, theme label, verse text, reference, [NEXT] button

- [x] NodePanel — // MARKETS zone
      - Middle-right, flex: 1 height
      - Padding: 18px 20px

      DATA SOURCE:
      - Use Yahoo Finance unofficial endpoint (no API key):
          Crypto:
            https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD
            https://query1.finance.yahoo.com/v8/finance/chart/XRP-USD
          Metals (oz prices):
            https://query1.finance.yahoo.com/v8/finance/chart/GC=F
            https://query1.finance.yahoo.com/v8/finance/chart/SI=F
      - From each response extract:
          chart.result[0].meta.regularMarketPrice   ← current price
          chart.result[0].meta.previousClose        ← prev close
          delta % = ((current - prevClose) / prevClose) * 100
      - Fetch all 4 in parallel: Promise.all([...])
      - Fetch on mount, refresh every 60 seconds
      - Loading state per row: show "------" for price
        and "......" for delta while fetching
      - Error state per row: show "// UNAVAILABLE"

      LAYOUT:
      - Section label: "// MARKETS"
        font-size 8px, color var(--dim), letter-spacing 3px
        margin-bottom 12px
      - Market rows — raw terminal style, no $ signs,
        no comma separators:
          Grid: 56px ticker | 1fr price | auto delta
          Gap: 8px between columns, 10px between rows

          TICKER:
          font-family Rajdhani, font-weight 700
          font-size 10px, color var(--accent2)
          letter-spacing 1px

          PRICE:
          font-family Share Tech Mono
          font-size 10px, color #c8e8ffcc
          Format:
            BTC/XRP: toFixed(2)  → 97420.00 / 2.18
            GOLD:    toFixed(2)  → 3284.50
            SILVER:  toFixed(2)  → 32.41

          DELTA:
          font-size 9px, letter-spacing 0.5px
          Positive: color var(--accent2) — "▲ +2.41%"
          Negative: color #ff4444        — "▼ -0.82%"
          Zero:     color var(--dim)     — "— 0.00%"

      - Thin divider between crypto and metals rows:
          height 1px, background #00d4ff12, margin: 4px 0

      - Last updated line below rows:
          "// LAST UPDATED HH:MM:SS · REFRESHES EVERY 60s"
          font-size 8px, color var(--dimmer), letter-spacing 1px
          margin-top 8px


### // PROJECTS — Agent + Git Integration

- [x] projects.json config file
      - Create src/assets/projects.json
      - This is the source of truth for all projects
      - Structure:
          [
            {
              "id": "doulaflow",
              "label": "DoulaFlow",
              "repoPath": "/Users/risingwarriorgames/Documents/07_TechProjects/DoulaFlow/doulaflow",
              "claudeMd": "CLAUDE.md",
              "tasksFile": "TASKS.md",
              "bugsFile": "BUGS.md",
              "vercelProject": "doulaflow-m42z",
              "status": "LIVE",
              "statusColor": "#00ffcc"
            },
            {
              "id": "emberforgeos",
              "label": "Emberforge.OS",
              "repoPath": "/Users/risingwarriorgames/Documents/07_TechProjects/EmberforgeOS",
              "claudeMd": "EMBERFORGE.md",
              "tasksFile": "TASKS.md",
              "bugsFile": "BUGS.md",
              "vercelProject": null,
              "status": "REPO",
              "statusColor": "#00d4ff"
            }
          ]
      - Import in App.tsx:
          import projects from './assets/projects.json'
      - Replace hardcoded PROJECTS array with this import
      - claudeMd field: name of the context file at repo root
        (DoulaFlow uses CLAUDE.md, EmberforgeOS uses EMBERFORGE.md)

- [x] Electron IPC — project file operations
      - Register these IPC handlers in main.cjs:

          project:readFile
          - Args: { repoPath: string, filename: string }
          - Returns: { content: string } or { error: string }
          - Reads file as UTF-8 from repoPath/filename
          - Used to load CLAUDE.md, TASKS.md, BUGS.md

          project:appendEntry
          - Args: { repoPath: string, filename: string, entry: string }
          - Reads existing file content
          - Appends entry under the correct section:
              TASKS.md → appends under "## Backlog" section
                         if no Backlog section, appends at end
              BUGS.md  → appends under "## Active" section
                         if no Active section, appends at end
          - Writes file back to disk
          - Returns: { success: boolean, error?: string }

          project:gitPush
          - Args: { repoPath: string, filename: string, message: string }
          - Runs these shell commands in sequence via child_process.execSync:
              git -C {repoPath} add {filename}
              git -C {repoPath} commit -m "{message}"
              git -C {repoPath} push
          - Returns: { success: boolean, output: string, error?: string }
          - If git not found or push fails: return error, do not throw
          - Commit message format:
              "chore: add [task|bug] entry via Command Center"

      - Add to preload.cjs bridge:
          projectAPI: {
            readFile:    (repoPath, filename) => ipcRenderer.invoke('project:readFile', { repoPath, filename }),
            appendEntry: (repoPath, filename, entry) => ipcRenderer.invoke('project:appendEntry', { repoPath, filename, entry }),
            gitPush:     (repoPath, filename, message) => ipcRenderer.invoke('project:gitPush', { repoPath, filename, message }),
          }

- [x] Right panel — project agent UI
      - Replaces existing stat cards + agent stub
        in the project detail panel
      - Layout: three zones stacked vertically

        ZONE 1 — PROJECT HEADER (unchanged from current):
        - Project name, status badge, sub label
        - Keep existing header row exactly as-is

        ZONE 2 — STAT CARDS ROW:
        - Keep existing 3-card row (VERCEL / GITHUB / SUPABASE)
        - These remain stubs for now (V2 will wire live data)

        ZONE 3 — AGENT PANEL:
        - Takes remaining flex space
        - Internal layout:

            AGENT HEADER:
            "// PROJECT AGENT — [PROJECT NAME]"
            font-size 9px, color var(--dim), letter-spacing 3px
            border-bottom: 1px solid var(--border)
            padding: 10px 16px

            MODE SELECTOR (3 toggle buttons):
            [ BUG ENTRY ]  [ TASK ENTRY ]  [ GENERAL ]
            Default: TASK ENTRY
            Active mode: border var(--accent), color var(--accent)
            Inactive: border var(--border-md), color var(--dim)
            padding: 5px 12px, font-size 9px, letter-spacing 2px
            Displayed in a row, padding 10px 16px,
            border-bottom: 1px solid var(--border)

            INPUT AREA:
            textarea
            - flex: 1, min-height 80px
            - font: Share Tech Mono, 11px
            - color: var(--text)
            - background: var(--bg-panel)
            - border: none, border-bottom: 1px solid var(--border)
            - padding: 12px 16px
            - resize: none
            - placeholder: "describe the bug or task..."
              color var(--dimmer)
            - No border on sides — flush with panel

            ACTION ROW:
            [ GENERATE ]  button right-aligned
            padding: 6px 16px, font-size 9px, letter-spacing 2px
            border: 1px solid var(--accent), color var(--accent)
            background: transparent
            hover: background var(--bg-hover)
            Disabled + greyed while generating

            OUTPUT AREA:
            - Shows after generation
            - Scrollable, max-height ~200px
            - font: Share Tech Mono, 11px
            - color: var(--accent2)
            - background: var(--bg)
            - border-top: 1px solid var(--border)
            - padding: 12px 16px
            - Pre-formatted text (whitespace preserved)

            OUTPUT ACTION ROW (shown after generation):
            [ APPEND TO TASKS.md ]  or  [ APPEND TO BUGS.md ]
            depending on active mode
            [ PUSH TO GITHUB ] — runs append then git push
            Both buttons side by side, right-aligned
            [ PUSH TO GITHUB ] uses accent2 border/color
            Status message below buttons after action:
              Success: "// APPENDED + PUSHED ✓" in accent2
              Append only: "// APPENDED TO FILE ✓" in accent2
              Error: "// FAILED — [error message]" in #ff4444

- [x] Agent — Anthropic API call
      - API call happens in the renderer (fetch from React)
      - Use the existing Anthropic API pattern from artifacts
      - Endpoint: https://api.anthropic.com/v1/messages
      - Model: claude-sonnet-4-20250514
      - max_tokens: 1024

      SYSTEM PROMPT (assembled at call time):
      - Load project's claudeMd file via project:readFile IPC
      - If file not found: use generic fallback:
          "You are a project assistant for {project.label}.
           Stack: refer to project conventions."
      - Append formatting instructions to system prompt:

          For BUG ENTRY mode append:
          "The user will describe a bug. Respond with ONLY
           a formatted BUGS.md entry matching this exact style:

           - [ ] [short bug title]
                 - Trigger: [when it happens]
                 - Expected: [what should happen]
                 - Actual: [what actually happens]
                 - Suspected cause: [if inferable]
                 - Fix: [suggested fix if clear]
                 - Test: [how to verify fix]

           No preamble, no explanation. Only the entry block."

          For TASK ENTRY mode append:
          "The user will describe a feature or task. Respond
           with ONLY a formatted TASKS.md entry matching this
           exact style:

           - [ ] [short task title]
                 - [implementation detail line 1]
                 - [implementation detail line 2]
                 - [etc — as many as needed]
                 - Be specific to the project stack and conventions
                   described in the system prompt above

           No preamble, no explanation. Only the entry block."

          For GENERAL mode append:
          "Answer the user's question about this project
           concisely and in plain text. You may reference
           the project context above."

      - USER MESSAGE: contents of the textarea
      - Show loading state while awaiting response:
          Output area shows "// GENERATING..."
          with blink cursor
          [ GENERATE ] button disabled


- [x] NodePanel — // TIME zone
      - Top-right quadrant of NODE
      - Border-bottom: 1px solid var(--border)
      - Padding: 18px 20px
      - Display: flex, flex-direction column,
        justify-content space-between

      LAYOUT:
      - Section label: "// TIME"
        font-size 8px, color var(--dim), letter-spacing 3px
      - Large clock:
        font-family Rajdhani, font-weight 700
        font-size 52px, line-height 1
        color var(--accent)
        letter-spacing 2px
        Updates every second via useEffect + setInterval
        Format: 24hr HH:MM:SS
        (no 12hr toggle for now — V2 setting)
      - Date row below clock:
        Day abbreviation: Rajdhani, font-size 14px,
          font-weight 600, color var(--accent2), letter-spacing 2px
        Full date: "23 MAY 2025"
          font-size 11px, color var(--dim), letter-spacing 1px
          margin-left 8px


  ### // MESSAGES — Pushbullet SMS
  - [x] // PROJECTS — "open in VS Code" button per project
      - Add [ OPEN IN VSCODE ] button to the project
        detail panel header row, right side
        next to the project name and status badge
      - Button style:
          font-size 8px, letter-spacing 2px
          border: 1px solid var(--border-md)
          color: var(--dimmer)
          padding: 4px 10px
          hover: border var(--accent), color var(--accent)
          transition: all 0.15s ease

      - Behavior:
          Calls existing electronAPI.openApp with:
            command: 'code {repoPath}'
          Use child_process.execSync in main process:
            execSync(`code "${project.repoPath}"`)
          This opens VSCode directly to the project folder
          'code' CLI must be installed — VSCode installs
          it via Command Palette:
            "Shell Command: Install 'code' command in PATH"

      - Add new IPC handler in main.cjs:
          ipcMain.handle('app:openInVSCode', (_, repoPath) => {
            execSync(`code "${repoPath}"`)
            return { success: true }
          })
      - Add to preload bridge:
          openInVSCode: (repoPath) =>
            ipcRenderer.invoke('app:openInVSCode', repoPath)
      - repoPath comes from projects.json config
        for the currently selected project
- [x] // SYSTEM → DISPLAY — replace text contrast slider
      with three preset text modes
      - Remove the existing text contrast slider entirely
      - Replace with a three-button toggle:
          [ DIM ]  [ MID ]  [ BRIGHT ]
          Default: MID
          Active button: border var(--accent), color var(--accent)
          Inactive: border var(--border-md), color var(--dimmer)
          Same button style as mode selectors elsewhere in app

      - Each mode sets these CSS variables on :root
        via document.documentElement.style.setProperty:

          DIM (current default feel):
            --text:   #7ab3d4
            --dim:    #3d7a99
            --dimmer: #1f4d66

          MID (comfortable reading):
            --text:   #a8d4ee
            --dim:    #6aadcc
            --dimmer: #3d7a99

          BRIGHT (maximum readability):
            --text:   #d4eeff
            --dim:    #99d4ee
            --dimmer: #6aadcc

        --accent (#00d4ff) and --accent2 (#00ffcc)
        never change across any mode

      - Persist to electron-store key: 'textMode'
        values: 'dim' | 'mid' | 'bright'
        using existing settingsAPI.set IPC
      - On app load: read 'textMode' from store
        apply immediately before boot animation
        default to 'mid' if not set
- [x] // SYSTEM → DISPLAY — text contrast slider
      - Add a second slider below the brightness slider
      - Label: "// TEXT CONTRAST"
        Same layout pattern as brightness slider
        Value display: "85%" in var(--accent), Rajdhani 700
      - Range: min 50, max 100, step 1, default 75
      - Effect: scales opacity/brightness of muted text
        variables dynamically on the root element
        via CSS variables set on :root inline style:
          --dim:    rgba(0, 212, 255, {0.4 + (value/100 * 0.6)})
          --dimmer: rgba(0, 212, 255, {0.2 + (value/100 * 0.4)})
          --text:   rgba(200, 232, 255, {0.6 + (value/100 * 0.4)})
        Applied via:
          document.documentElement.style.setProperty('--dim', ...)
          document.documentElement.style.setProperty('--dimmer', ...)
          document.documentElement.style.setProperty('--text', ...)
        Updates live as slider drags
      - Persist to electron-store key: 'textContrast'
        using existing settingsAPI.set IPC
      - On app load: read 'textContrast' from store
        apply immediately before boot animation
        default to 75 if not set
      - Note: --accent and --accent2 are never touched
        by this slider — highlighted values stay as-is
- [x] Add new What's app option to // COMMS (messages)
      - Update NAV_ITEMS in App.tsx:
          label: '// MATRIX', id: 'matrix'
      - // MATRIX houses all external messaging services
        as sub-tabs within the section
      - Middle panel gets a tab bar at the top:
          [ SMS ]  [ WHATSAPP ]
          Active tab: bottom border var(--accent),
            color var(--accent)
          Inactive: color var(--dimmer)
          Tab bar border-bottom: 1px solid var(--border)
      - [ SMS ] tab loads existing thread list
        (all current // MESSAGES functionality moves here)
      - [ WHATSAPP ] tab is a stub for now:
          Centered icon, "// WHATSAPP — COMING SOON"
          same placeholder pattern as other stubs
      - All existing messagesAPI IPC handlers and
        preload bridge stay unchanged — just re-routed
        under the SMS tab


- [x] Pushbullet API — IPC bridge
      - All Pushbullet API calls happen in main process
        never in the renderer — contextIsolation is ON
      - Install node-fetch if not already present:
          npm install node-fetch
      - API base URL: https://api.pushbullet.com/v2
      - API key read from electron-store key: 'pushbullet.apiKey'
        (set via // SYSTEM → CONNECTIONS later)
      - For now hardcode a placeholder check:
          if no API key in store, return { error: 'NO_API_KEY' }

      - Register these IPC handlers in main.cjs:

          messages:getThreads
          - Fetches SMS threads from Pushbullet
          - GET /v2/permanents
          - Returns array of threads sorted by most recent:
              {
                id: string,
                name: string,         ← contact name
                number: string,       ← phone number
                snippet: string,      ← last message preview
                timestamp: number,    ← epoch ms
                unread: boolean,
              }
          - Limit: 40 threads max

          messages:getThread
          - Args: { threadId: string }
          - Fetches messages for a specific thread
          - GET /v2/permanents/{threadId}
          - Returns array of messages:
              {
                id: string,
                body: string,
                timestamp: number,
                direction: 'inbound' | 'outbound'
              }
          - Sort: oldest first (ascending timestamp)

          messages:sendMessage
          - Args: { number: string, body: string }
          - POST /v2/texts
          - Body: {
              data: {
                target_device_iden: string,  ← device ID
                addresses: [number],
                message: body,
                guid: uuid
              }
            }
          - Device iden: fetched from GET /v2/devices
            pick first device where has_sms === true
            cache device iden in memory after first fetch
          - Returns: { success: boolean, error?: string }

          messages:getDevices
          - GET /v2/devices
          - Returns first device where has_sms === true:
              { iden: string, nickname: string }
          - Used internally by messages:sendMessage
          - Cache result in main process memory variable
            so it's not refetched every send

      - Add to preload.cjs bridge:
          messagesAPI: {
            getThreads:   () => ipcRenderer.invoke('messages:getThreads'),
            getThread:    (threadId) => ipcRenderer.invoke('messages:getThread', { threadId }),
            sendMessage:  (number, body) => ipcRenderer.invoke('messages:sendMessage', { number, body }),
          }

- [x] // MESSAGES — layout and routing
      - Follows standard three-column layout:
          Sidebar + Middle (thread list) + Right (conversation)
      - When // MESSAGES selected in sidebar:
          Middle panel shows thread list
          Right panel shows empty state until thread selected
      - // MESSAGES is NOT full-width like // NODE
      - Add // MESSAGES to NAV_ITEMS in App.tsx:
          id: 'messages', label: '// MESSAGES', icon: '✉'
          Position: after // MAIL, before // VAULT

- [x] // MESSAGES — middle panel thread list
      - Panel header: "// MESSAGES"
        accent color + blinking cursor
      - On mount: call messagesAPI.getThreads()
      - Loading state:
          Show "// LOADING THREADS..." with blink cursor
          centered in panel
      - Error state — no API key:
          Show "// API KEY NOT SET"
          font-size 9px, color var(--dimmer), letter-spacing 3px
          "Configure in // SYSTEM → CONNECTIONS"
          font-size 8px, color var(--dimmer), margin-top 8px
          centered in panel
      - Error state — fetch failed:
          Show "// FAILED TO LOAD" + [ RETRY ] button
      - Thread list — each row:
          padding: 10px 14px
          border-bottom: 1px solid var(--border)
          cursor: pointer
          selected: left border var(--accent), bg var(--bg-hover)
          hover: bg var(--bg-hover)
          animation: fade-up staggered (matches existing lists)

          ROW LAYOUT:
          Top row: contact name (left) + timestamp (right)
            Name:
              font: Rajdhani 600, font-size 11px
              color: var(--text)
              unread: color var(--accent), font-weight 700
            Timestamp:
              font-size 8px, color var(--dimmer)
              relative time: "2 min ago" / "1hr ago" / "yesterday"
          Bottom row: message snippet
            font-size 9px, color var(--dim)
            letter-spacing 0.5px
            truncate with ellipsis at 1 line
            unread: color var(--text)

          Unread indicator:
            Small dot left of contact name
            width/height 5px, border-radius 50%
            background var(--accent)
            Only shown when unread === true

      - Auto-refresh threads every 30 seconds via setInterval
      - Search bar at top of thread list:
          height 32px, border-bottom 1px solid var(--border)
          input: full width, bg transparent, no border,
                 font Share Tech Mono 10px, color var(--text)
                 padding 0 12px
          placeholder: "// SEARCH..." color var(--dimmer)
          Filters thread list client-side by name or snippet

- [x] // MESSAGES — right panel conversation view
      - Empty state (no thread selected):
          Centered ✉ icon, font-size 28px, color var(--dimmer)
          "// SELECT A CONVERSATION"
          font-size 9px, color var(--dimmer), letter-spacing 4px

      - When thread selected: call messagesAPI.getThread(id)

      - Panel header:
          Contact name in accent2, Rajdhani 700, font-size 13px
          Phone number in dim, font-size 9px, margin-left 8px
          border-bottom: 1px solid var(--border)
          padding: 0 20px, height 44px

      - Message list:
          flex: 1, overflow-y auto, padding 16px
          Scroll to bottom on load and on new message
          Auto-refresh every 15 seconds via setInterval

          Each message bubble:
            max-width: 65%
            padding: 8px 12px
            margin-bottom: 8px
            font: Share Tech Mono, 11px
            line-height: 1.6

            INBOUND (received):
              align-self: flex-start
              background: var(--bg-panel)
              border: 1px solid var(--border-md)
              color: var(--text)
              border-radius: 0 4px 4px 4px

            OUTBOUND (sent):
              align-self: flex-end
              background: transparent
              border: 1px solid var(--accent)44
              color: var(--accent)
              border-radius: 4px 0 4px 4px

            Timestamp below each bubble:
              font-size 8px, color var(--dimmer)
              text-align matches bubble alignment

      - Reply area (bottom of panel):
          border-top: 1px solid var(--border)
          padding: 12px 16px
          display: flex, gap 10px, align-items flex-end

          Textarea:
            flex: 1
            min-height: 36px, max-height: 120px
            font: Share Tech Mono, 11px
            color: var(--text)
            background: var(--bg-panel)
            border: 1px solid var(--border-md)
            padding: 8px 12px
            resize: none
            placeholder: "> TYPE A MESSAGE..."
              color var(--dimmer)
            focus: border-color var(--accent)
            Enter key sends (Shift+Enter for new line)

          [ SEND ] button:
            padding: 8px 16px
            font-size 9px, letter-spacing 2px
            border: 1px solid var(--accent)
            color: var(--accent)
            background: transparent
            hover: background var(--bg-hover)
            disabled + greyed while sending
            After send success:
              clear textarea
              append outbound message to thread locally
                (optimistic update, no need to refetch)
            After send fail:
              show "// FAILED" in #ff4444 below textarea
              re-enable button

- [x] // SYSTEM → CONNECTIONS — Pushbullet API key field


- [x] // SYSTEM layout — two-column, no full-width override
      - Follows standard three-column layout:
          Sidebar + Middle (category list) + Right (active setting)
      - Middle panel shows settings categories
      - Right panel shows the selected category content
      - This is NOT a full-width panel like // NODE

- [x] // SYSTEM — middle panel category list
      - Panel header: "// SYSTEM" in accent color
        + blinking cursor (matches existing header style)
      - Category rows (all stubs except DISPLAY):
          -- DISPLAY
          -- CONNECTIONS
          -- QUICK LAUNCH
          -- VAULT
          -- ABOUT
      - Each row:
          padding: 12px 16px
          font-size 10px, color var(--dim), letter-spacing 1px
          border-bottom: 1px solid var(--border)
          cursor: pointer
          -- prefix in var(--dimmer), label in var(--dim)
          hover: background var(--bg-hover), color var(--accent)
          active: left border accent, color var(--accent2),
                  background var(--bg-hover)
      - Default selected: -- DISPLAY on first open

- [x] // SYSTEM — DISPLAY settings (active, build this one)
      - Right panel header:
          "-- DISPLAY" in accent2, font Rajdhani 700
          letter-spacing 1px
          border-bottom: 1px solid var(--border)
          padding: 14px 20px
      - Brightness control:
          Label: "// BRIGHTNESS"
            font-size 8px, color var(--dim), letter-spacing 3px
            margin-bottom 12px
          Slider:
            type="range" min=40 max=100 step=1
            Default value: 85
            Width: 100%, styled to match aesthetic:
              accent-color: var(--accent)
              background: var(--bg-panel)
              border: 1px solid var(--border-md)
            Current value display right of label:
              "85%" in var(--accent), font Rajdhani 700,
              font-size 14px, updates live as slider moves
          Effect:
            Apply as CSS filter on the #root element:
              document.getElementById('root').style.filter =
                `brightness(${value / 100})`
            Updates live as slider drags (no confirm needed)
          Persist:
            Save to electron-store key: 'brightness'
            via new IPC handler:
              settings:set — Args: { key, value }
              settings:get — Args: { key }
            Add to preload bridge:
              settingsAPI: {
                set: (key, value) => ipcRenderer.invoke('settings:set', { key, value }),
                get: (key) => ipcRenderer.invoke('settings:get', { key }),
              }
            On app load (App.tsx useEffect on mount):
              read 'brightness' from settingsAPI.get
              apply filter immediately before boot animation
              default to 85 if not set
          padding: 20px

- [x] // SYSTEM — CONNECTIONS stub
      - Right panel shows centered placeholder:
          ⚙ icon, font-size 28px, color var(--dimmer)
          "// CONNECTIONS" font-size 10px, color var(--dim),
          letter-spacing 4px, margin-top 12px
          "— COMING SOON —" font-size 8px, color var(--dimmer),
          letter-spacing 2px, margin-top 8px
      - No functionality yet

- [x] // SYSTEM — QUICK LAUNCH stub
      - Same centered placeholder pattern as CONNECTIONS
      - Label: "// QUICK LAUNCH"
      - No functionality yet

- [x] // SYSTEM — VAULT stub
      - Same centered placeholder pattern as CONNECTIONS
      - Label: "// VAULT PATH"
      - Note below label:
          current vault path in var(--dimmer), font-size 9px
          (read from electron-store 'vaultPath')
      - No edit functionality yet — just display

- [x] // SYSTEM — ABOUT stub

- [x] // COMMS SMS — inline image rendering (MMS)
      - Currently MMS images may not be rendering
        depending on how Pushbullet/bridge returns them
      - When message has an image attachment:
          Render inline below message text bubble
          Same container width as bubble (max 65%)
          img style:
            width: 100%
            height: auto
            border: 1px solid var(--border-md)
            border-radius: 0 4px 4px 4px (inbound)
            border-radius: 4px 0 4px 4px (outbound)
            margin-top: 4px if body text also present
          Tap/click to expand:
            Opens image full size in a modal overlay:
              background: rgba(2, 8, 16, 0.95)
              image centered, max 90vw / 90vh
              click anywhere outside to dismiss
              border: 1px solid var(--border-md)

- [x] // SYSTEM → DISPLAY — font size preset toggle
      - Add below the text contrast toggle
      - Label: "// FONT SIZE"
        font-size 8px, color var(--dim), letter-spacing 3px
      - Three buttons: [ S ]  [ M ]  [ L ]
        Same mode button style as text contrast toggle
        Default: S (current size)

      - Each mode sets a --font-scale CSS variable
        on :root and scales all font-size values
        by overriding the base font size on root:

          S (current):
            document.documentElement.style
              .setProperty('--font-scale', '1')
            font-size on html element: 13px (unchanged)

          M:
            --font-scale: 1.15
            html font-size: 15px

          L:
            --font-scale: 1.3
            html font-size: 17px

      - Implementation:
          Set font-size on the html element directly:
            document.documentElement.style.fontSize =
              size === 'S' ? '13px' :
              size === 'M' ? '15px' : '17px'
          All rem/em units scale automatically
          For px-based font sizes in the app:
            Update these CSS variables on :root:
              --fs-xs:   size S: 8px  | M: 9px  | L: 10px
              --fs-sm:   size S: 9px  | M: 10px | L: 12px
              --fs-base: size S: 10px | M: 12px | L: 14px
              --fs-md:   size S: 11px | M: 13px | L: 15px
              --fs-lg:   size S: 12px | M: 14px | L: 16px
              --fs-xl:   size S: 13px | M: 15px | L: 17px
              --fs-head: size S: 14px | M: 16px | L: 18px
            CC should audit all hardcoded font-size values
            in the app and replace with these variables
            where appropriate
          Status bar, nav labels, panel headers,
          thread lists, email body, vault content,
          market prices, weather — all should scale

      - Persist to electron-store key: 'fontSize'
        values: 'S' | 'M' | 'L'
        using existing settingsAPI.set IPC
      - On app load: read 'fontSize' from store
        apply immediately before boot animation
        default to 'S' if not set
- [x] // PROJECTS — edit project settings
      - Add [ SETTINGS ] button to the project
        detail panel header row, next to [ OPEN IN VSCODE ]
        Style:
          font-size 8px, letter-spacing 2px
          border: 1px solid var(--border-md)
          color: var(--dimmer), padding: 4px 10px
          hover: border var(--accent), color var(--accent)

      - Clicking [ SETTINGS ] replaces the right panel
        content with the project settings form
        Same form as [ + NEW PROJECT ] but pre-populated
        with current project values

      - Form fields (all pre-filled):
          // LABEL
          // REPO PATH
          // CONTEXT FILE
          // TASKS FILE
          // BUGS FILE
          // VERCEL ID
          // STATUS toggle

      - Header changes to:
          "// EDIT — [PROJECT NAME]"
          Rajdhani 700, accent color

      - Buttons row right-aligned:
          [ SAVE CHANGES ]  [ CANCEL ]
          [ SAVE CHANGES ]: border/color var(--accent)
          [ CANCEL ]: border/color var(--dimmer)

      - SAVE CHANGES behavior:
          Update project in electron-store 'projects' array
          Match by project id
          On save: return to normal project detail view
            with updated values reflected immediately
          Refresh stat cards if Vercel ID changed

      - CANCEL: return to normal project detail view
        no changes saved
- [x] Bug — GitHub stat card returning same repo
      for all projects regardless of repoPath
      - Root cause: git remote get-url origin command
        result may be cached or not scoped correctly
        to each project's repoPath
      - Fix in github:getStatus and github:getCommits
        IPC handlers:
          Ensure execSync uses the correct working dir:
            execSync('git remote get-url origin', {
              cwd: repoPath    ← this is the critical part
            })
          Without cwd, git falls back to the Command
          Center's own directory and always returns
          the same remote
      - After fix, verify both projects return their
        correct GitHub repo URLs:
          DoulaFlow:
            /Users/risingwarriorgames/Documents/
            07_TechProjects/DoulaFlow/doulaflow
            → should resolve to RWGOverlord/doulaflow
          EmberforgeCommandCenter:
            /Users/risingwarriorgames/Documents/
            07_TechProjects/EmberforgeCommandCenter
            → should resolve to correct ECC repo
- [x] // PROJECTS — dynamic logs panel
      - Replace static "// NO LOGS YET" empty state
        with a dynamic log viewer
      - Add [ LOGS ] button to both VERCEL and GITHUB
        stat cards, bottom-left of each card:
          font-size 8px, letter-spacing 2px
          border: 1px solid var(--border-md)
          color: var(--dimmer), padding: 3px 8px
          hover: border var(--accent), color var(--accent)
          Active (logs panel showing this source):
            border var(--accent2), color var(--accent2)

      LOGS PANEL HEADER:
      - Shows which source is active:
          "// VERCEL LOGS" or "// GITHUB COMMITS"
          accent color, Rajdhani 700, letter-spacing 1px
      - [ REFRESH ] button right-aligned:
          same small button style as [ LOGS ]
      - border-bottom: 1px solid var(--border)
        padding: 8px 12px

      VERCEL LOGS:
      - New IPC handler: vercel:getLogs
          Args: { projectId, deploymentId, token }
          Step 1: get latest deployment ID if not cached
            GET https://api.vercel.com/v9/projects/
              {projectId}/deployments?limit=1
            Headers: { Authorization: `Bearer ${token}` }
            Extract deployments[0].uid as deploymentId
          Step 2: fetch runtime logs
            GET https://api.vercel.com/v1/projects/
              {projectId}/deployments/{deploymentId}/
              runtime-logs
            Headers: { Authorization: `Bearer ${token}` }
          Returns array of log entries:
            {
              timestamp: number,
              level: 'info'|'error'|'warning',
              message: string,
              source: string,
              requestPath?: string,
              responseStatusCode?: number,
            }
          Limit to last 50 entries
          Sort: newest first

      - Log entry rendering:
          Timestamp: HH:MM:SS, font-size 8px,
            color var(--dimmer), width 52px, flex-shrink 0
          Level badge:
            error:   "ERR" color #ff4444
            warning: "WRN" color #ffc200
            info:    "INF" color var(--dim)
            font-size 7px, width 24px, flex-shrink 0
          Message: font-size 9px, color var(--dim)
            error messages: color #ff4444
            word-break: break-all
          Request path if present:
            font-size 8px, color var(--dimmer)
            below message, left-padded 76px
          Status code if present:
            inline after path,
            2xx: color var(--accent2)
            4xx/5xx: color #ff4444

      GITHUB COMMITS:
      - New IPC handler: github:getCommits
          Args: { repoPath, token, limit? }
          GET https://api.github.com/repos/
            {owner}/{repo}/commits?per_page=20
          Headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json'
          }
          Returns array:
            {
              sha: string,        ← first 7 chars only
              message: string,    ← first line only
              author: string,
              timestamp: number,
              url: string,
            }

      - Commit entry rendering:
          Timestamp: relative time, font-size 8px,
            color var(--dimmer), width 64px, flex-shrink 0
          SHA: first 7 chars, font-size 8px,
            color var(--accent), width 52px,
            font-family Share Tech Mono
          Message: font-size 9px, color var(--dim)
            truncate at 1 line with ellipsis
          Author: font-size 8px, color var(--dimmer)
            below message, left-padded 116px

      EMPTY / LOADING / ERROR STATES:
      - Default (no [ LOGS ] clicked):
          "// SELECT VERCEL OR GITHUB LOGS"
          centered, color var(--dimmer), font-size 9px
          letter-spacing 2px
      - Loading: "// FETCHING LOGS..."
          with blink cursor
      - Error: "// FAILED TO LOAD LOGS"
          color #ff4444, [ RETRY ] button below
      - Note: Vercel runtime logs only retained
          3 days — show notice at top of log list:
          "// LOGS AVAILABLE FOR LAST 3 DAYS ONLY"
          font-size 8px, color var(--dimmer)
          border-bottom: 1px solid var(--border)
          padding: 6px 12px
- [x] Fix Supabase health check returning false DEGRADED
      - Current check hits: {projectUrl}/rest/v1/
        This returns non-200 on many projects even
        when healthy — unreliable health signal
      - Replace with:
          GET {projectUrl}/rest/v1/?apikey={anonKey}
          or better:
          GET {projectUrl}/rest/v1/
          Headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`
          }
          Consider healthy if response status is
          200 OR 400 OR 404 — any response means
          the server is reachable and responding
          Only show OFFLINE if fetch throws entirely
          (network error, DNS failure, timeout)
      - DEGRADED state can be removed entirely
        for now — just CONNECTED ✓ or OFFLINE ✗
- [x] VERCEL stat card — live data
      - On project select: fetch Vercel data if
        API token + project ID are configured
      - Fetch via main process IPC new handler:
          ipcMain.handle('vercel:getStatus', async (_, { projectId, token }) => {
            GET https://api.vercel.com/v9/projects/{projectId}/deployments
              ?limit=1
            Headers: { Authorization: `Bearer ${token}` }
            Returns latest deployment:
              {
                state: string,     ← READY/BUILDING/ERROR
                createdAt: number, ← epoch ms
                meta: {
                  githubCommitMessage: string,
                  githubCommitRef: string,   ← branch
                }
              }
          })
      - Add to preload bridge:
          vercelAPI: {
            getStatus: (projectId, token) =>
              ipcRenderer.invoke('vercel:getStatus', { projectId, token })
          }
      - Stat card display (replaces — / not connected):
          Top: state badge
            READY:    "READY ✓"   color var(--accent2)
            BUILDING: "BUILDING"  color #ffc200
            ERROR:    "FAILED ✗"  color #ff4444
          Middle: relative deploy time
            "deployed 2hrs ago"
            font-size 9px, color var(--dim)
          Bottom: branch + commit message truncated
            "main — fix intake form token"
            font-size 8px, color var(--dimmer)
      - Loading state: "// FETCHING..." in var(--dimmer)
      - Error state: "// API ERROR" in #ff4444
      - Refresh every 60 seconds

- [x] GITHUB stat card — live data
      - New IPC handler:
          ipcMain.handle('github:getStatus', async (_, { repoPath, token }) => {
            Extract owner/repo from repoPath:
              run: git -C repoPath remote get-url origin
              parse github.com/{owner}/{repo} from output
            Fetch via GitHub API:
              GET https://api.github.com/repos/{owner}/{repo}/commits?per_page=1
              GET https://api.github.com/repos/{owner}/{repo}/issues?state=open
            Headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json'
            }
            Returns:
              {
                lastCommit: {
                  message: string,
                  author: string,
                  timestamp: number,
                  branch: string,
                },
                openIssues: number,
              }
          })
      - Add to preload bridge:
          githubAPI: {
            getStatus: (repoPath, token) =>
              ipcRenderer.invoke('github:getStatus', { repoPath, token })
          }
      - Stat card display:
          Top: last commit message truncated to 1 line
            font-size 9px, color var(--text)
          Middle: author + relative time
            "erick · 3hrs ago"
            font-size 9px, color var(--dim)
          Bottom: branch + open issues count
            "main · 2 open issues"
            font-size 8px, color var(--dimmer)
            0 issues: "main · no open issues"
              color var(--dimmer)
            1+ issues: color #ffc200
      - Loading state: "// FETCHING..." in var(--dimmer)
      - Error state: "// API ERROR" in #ff4444
      - Refresh every 60 seconds

- [x] SUPABASE stat card — live data

### // MAIL — Gmail Integration

- [x] Gmail OAuth — authentication flow
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

- [x] Gmail IPC handlers
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

- [x] // MAIL — layout and UI