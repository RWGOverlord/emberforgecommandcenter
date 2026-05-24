
## Backlog



- [ ] NodePanel — // THE WORD zone
      - Top-left quadrant of NODE
      - Border-right: 1px solid var(--border)
      - Border-bottom: 1px solid var(--border)
      - Padding: 18px 20px

      DATA SOURCE:
      - Import verses.json from src/assets/verses.json
          import verses from './assets/verses.json'
      - JSON structure:
          Array of theme objects:
          {
            theme: string,
            day: number,      ← 1–7
            passages: [
              { verse: string, reference: string }
            ]
          }
      - Theme selection: use day of week to pick theme
          const dayIndex = new Date().getDay()
          const theme = verses[dayIndex % verses.length]
          Sunday=0 → verses[0], Monday=1 → verses[1], etc.
      - Passage selection: useState(0) for current index
        [ NEXT ] increments index, wraps at passages.length

      LAYOUT:
      - Section label top: "// THE WORD"
        font-size 8px, color var(--dim), letter-spacing 3px
      - Theme label below section label:
        "// [THEME NAME]" in var(--dimmer), font-size 9px
        letter-spacing 2px, margin-bottom 10px
      - Verse text:
        font-size 12px, color #c8e8ffcc
        font-family var(--font-mono)
        line-height 1.8, font-style italic
        margin-bottom 8px
      - Reference line:
        font-size 9px, color var(--dim)
        letter-spacing 1px
        format: "— Romans 8:28"
      - [ NEXT ] button bottom-right of zone:
        padding 4px 10px
        font-size 9px, letter-spacing 2px
        border: 1px solid var(--border-md)
        color: var(--dim)
        background: transparent
        hover: border-color var(--accent), color var(--accent)
        On click: increment passage index (wrap around)
        Transition: fade verse text on change
          opacity 0 → wait 150ms → update text → opacity 1

- [ ] NodePanel — // TIME zone
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

- [ ] NodePanel — // WEATHER zone
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

- [ ] NodePanel — // MARKETS zone
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

- [ ] NodePanel — // QUICK LAUNCH zone
      - Bottom strip, spans full width (grid-column: 1 / -1)
      - Border-top: 1px solid var(--border)
      - Padding: 12px 20px
      - Display: flex, align-items center, gap 16px

      LAYOUT:
      - Section label left: "// QUICK LAUNCH"
        font-size 8px, color var(--dim), letter-spacing 3px
      - Buttons:
          [ VS CODE ]  [ BRAVE ]
          Each button:
            padding: 6px 14px
            font-size 9px, letter-spacing 2px
            border: 1px solid var(--border-md)
            color: var(--dim)
            background: transparent
            cursor: pointer
            hover: border-color var(--accent),
                   color var(--accent),
                   background var(--bg-hover)
            transition: all 0.15s ease

      LAUNCH BEHAVIOR:
      - Add openApp handler to preload.cjs:
          openApp: (path) => ipcRenderer.invoke('app:open', path)
      - Add IPC handler in main.cjs:
          ipcMain.handle('app:open', (_, appPath) => {
            shell.openPath(appPath)
          })
      - Import shell from electron in main.cjs
      - App paths:
          VS Code: '/Applications/Visual Studio Code.app'
          Brave:   '/Applications/Brave Browser.app'


### // PROJECTS — Agent + Git Integration

- [ ] projects.json config file
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

- [ ] Electron IPC — project file operations
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

- [ ] Right panel — project agent UI
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

- [ ] Agent — Anthropic API call
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


      - Panel header row:
          Left:  filename (no extension) in accent2
          Right: action buttons
        View mode:   [ EDIT ]
        Edit mode:   [ SAVE ]  [ CANCEL ]
        Saving:      [ SAVING... ] greyed out, disabled
        Save error:  [ RETRY ] in error red

      - VIEW MODE (default):
        Render markdown as styled HTML using marked.js
        (already installed)
        Markdown styles — apply inline via a <style> block
        scoped to .vault-content class:

            h1, h2, h3
            - font: Rajdhani, weight 700
            - color: var(--accent2)
            - letter-spacing: 1px
            - border-bottom: 1px solid var(--border)
              on h1 only
            - prepend "// " to all headers automatically
              via CSS ::before content

            p
            - font: Share Tech Mono
            - color: var(--text)
            - line-height: 1.8
            - font-size: 12px

            code (inline)
            - background: var(--bg-panel)
            - color: var(--accent)
            - border: 1px solid var(--border-md)
            - padding: 1px 5px
            - border-radius: 2px

            pre / code block
            - background: var(--bg-panel)
            - border: 1px solid var(--border-md)
            - border-left: 3px solid var(--accent)
            - padding: 12px 16px
            - color: var(--accent)
            - font: Share Tech Mono, 11px

            ul / ol
            - color: var(--text)
            - padding-left: 20px
            - line-height: 1.8

            li::marker
            - color: var(--accent)

            blockquote
            - border-left: 3px solid var(--accent2)
            - padding-left: 12px
            - color: var(--dim)
            - font-style: italic

            table
            - border-collapse: collapse
            - width: 100%
            th
            - background: var(--bg-panel)
            - color: var(--accent)
            - border: 1px solid var(--border-md)
            - padding: 8px 12px
            - font: Rajdhani, weight 600
            td
            - border: 1px solid var(--border)
            - padding: 8px 12px
            - color: var(--text)

            input[type=checkbox] (task list)
            - accent-color: var(--accent)

            a
            - color: var(--accent)
            - text-decoration: none
            - border-bottom: 1px solid var(--accent)44

            hr
            - border: none
            - border-top: 1px solid var(--border-md)
            - margin: 16px 0

        Scrollable — right panel scrolls independently
        Animate in with slide-in on file change

      - EDIT MODE:
        Full-height textarea — fills remaining panel space
        Font: Share Tech Mono, 12px
        Color: var(--text)
        Background: var(--bg-panel)
        Border: 1px solid var(--border-md)
        No resize handle (resize: none)
        Padding: 16px
        Line height: 1.8
        Tab key inserts 2 spaces (prevent focus loss)
        Auto-focus textarea when edit mode activates
        Pre-populate with raw markdown content

      - SAVE behavior:
        Calls vault:writeFile with current path + textarea content
        On success: exit edit mode, re-render view mode
          with updated content
        On fail: show error message below header:
          "// SAVE FAILED — check file permissions"
          in error red (#ff4444)
          [ RETRY ] button

      - UNSAVED CHANGES guard:
        If user clicks away to different file while
        in edit mode with unsaved changes:
        Show inline warning in panel header area:
          "// UNSAVED CHANGES  [ DISCARD ]  [ KEEP EDITING ]"
        Do not navigate away until resolved
        [ DISCARD ] exits edit mode, loads new file
        [ KEEP EDITING ] cancels navigation

      - Empty state (no file selected):
        Show centered ◈ + "// SELECT A FILE"
        Same pattern as existing empty detail panel


### // MAIL — Gmail Integration

- [ ] Stub — planned for V2
      - Nav item exists in sidebar (already present
        as placeholder)
      - Clicking shows: "// GMAIL — COMING IN V2"
        centered in middle panel
      - No code beyond the stub


