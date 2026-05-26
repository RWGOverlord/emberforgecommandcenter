# EMBERFORGE COMMAND CENTER — TASKS

## In Progress
- [ ] Refactor — reorganize src/ into proper folder
      structure for arch map layer detection
      IMPORTANT: this is a structural refactor only
      Zero functional changes — UI must look and
      behave identically before and after
      Do not add or change any features
      Build must pass clean after every file move

      CURRENT FLAT STRUCTURE (src/):
        App.tsx
        App.css
        BootScreen.tsx
        helpers.ts
        ImageModal.tsx
        index.css
        main.tsx
        MailPanel.tsx
        MessagesPanel.tsx
        MiddlePanel.tsx
        NodePanel.tsx
        ProjectArchMap.tsx
        ProjectPanel.tsx
        Shared.tsx
        Sidebar.tsx
        StatusBar.tsx
        SystemPanel.tsx
        types.ts
        VaultPanel.tsx

      TARGET STRUCTURE:
        src/
          App.tsx              ← stays at root
          App.css              ← stays at root
          index.css            ← stays at root
          main.tsx             ← stays at root
          types.ts             ← stays at root

          utils/
            helpers.ts         ← moved from src/

          components/
            BootScreen.tsx     ← moved
            ImageModal.tsx     ← moved
            Shared.tsx         ← moved
            Sidebar.tsx        ← moved
            StatusBar.tsx      ← moved
            MiddlePanel.tsx    ← moved

            node/
              NodePanel.tsx    ← moved

            mail/
              MailPanel.tsx    ← moved

            comms/
              MessagesPanel.tsx ← moved

            vault/
              VaultPanel.tsx   ← moved

            projects/
              ProjectPanel.tsx  ← moved
              ProjectArchMap.tsx ← moved

            system/
              SystemPanel.tsx  ← moved

      PROCESS — do in this exact order:
        1. Create all target folders first
        2. Move files one at a time
        3. After each move:
             Update all import paths that reference
             the moved file — check every file in
             the project that imports it
             Run: npm run build
             Fix any import errors before next move
        4. Move order (safest first — least imported):
             a. helpers.ts → utils/helpers.ts
             b. BootScreen.tsx → components/BootScreen.tsx
             c. ImageModal.tsx → components/ImageModal.tsx
             d. Shared.tsx → components/Shared.tsx
             e. StatusBar.tsx → components/StatusBar.tsx
             f. MiddlePanel.tsx → components/MiddlePanel.tsx
             g. Sidebar.tsx → components/Sidebar.tsx
             h. NodePanel.tsx → components/node/NodePanel.tsx
             i. MailPanel.tsx → components/mail/MailPanel.tsx
             j. MessagesPanel.tsx → components/comms/MessagesPanel.tsx
             k. VaultPanel.tsx → components/vault/VaultPanel.tsx
             l. SystemPanel.tsx → components/system/SystemPanel.tsx
             m. ProjectArchMap.tsx → components/projects/ProjectArchMap.tsx
             n. ProjectPanel.tsx → components/projects/ProjectPanel.tsx
        5. Final build check after all moves:
             npm run build — must show 0 errors
             0 warnings related to imports
        6. Do not proceed to next file until
           current file builds clean

      ARCH MAP LAYER DETECTION after refactor:
        src/components/**          → component
        src/components/node/**     → component
        src/components/mail/**     → component
        src/components/comms/**    → component
        src/components/vault/**    → component
        src/components/projects/** → component
        src/components/system/**   → component
        src/utils/**               → util
        src/types.ts               → util
        src/App.tsx                → component
        electron/main.cjs          → api
        electron/preload.cjs       → util

      VERIFY after refactor:
        Open Command Center arch map
        Click RESCAN
        All nodes should now show correct layers:
          No nodes labeled "OTHER" for known files
          Panel files → COMPONENT (teal)
          helpers.ts, types.ts → UTIL (muted)
          electron/main.cjs → API (gold)
          electron/preload.cjs → UTIL (muted)
- [x] Arch Map — @label tag support for node display names
      - Update archmap:scan IPC handler in main.cjs:
          When extracting JSDoc tags from each file,
          also extract @label tag if present:
            /**
             * @label Edit Client
             */
          Add to node object:
            label: string  ← @label value if found,
                             otherwise filename as before
          Priority:
            1. @label tag value
            2. filename (current fallback)

      - Update SVG node rendering in ProjectArchMap.tsx:
          Already uses node.label for display text
          No change needed here if scanner returns
          correct label value

      - Update node detail panel:
          Show both label and filename:
            Header: @label value (or filename if no label)
            // PATH section: always shows actual filename
              and full relative path unchanged
- [x] Architecture Map — per project visual dependency graph
      ═══════════════════════════════════════════════════════
      MULTI-PART BUILD — work through parts sequentially
      Do NOT start next part until explicitly instructed
      Build target: ProjectArchMap.tsx (already exists as stub)
      ═══════════════════════════════════════════════════════

      ── PART 1 — File Scanner (Electron main process) ──────

      - [ ] Register IPC handler in electron/main.cjs:
              ipcMain.handle('archmap:scan', async (_, { repoPath }) => { })

            SCANNER LOGIC:
            - Walk the repoPath directory recursively
            - Skip these directories entirely:
                node_modules, .git, .next, dist,
                out, .turbo, coverage, .cache,
                public, styles (no JS/TS there)
            - Include only these extensions:
                .ts .tsx .js .jsx .cjs .mjs
            - For each file:

                READ JSDOC TAGS:
                Extract @fileoverview block if present:
                  /** ... @fileoverview ... */
                  Everything between @fileoverview and
                  next @ tag or end of comment block
                Extract all @depends tags:
                  @depends supabase/clients
                  @depends storage/documents
                  etc. — return as string array

                READ IMPORTS:
                Extract all import statements:
                  import x from './path'
                  import { x } from '../path'
                  import type { x } from './path'
                  require('./path')
                Resolve relative paths to absolute
                Only keep imports that resolve to
                files within the repoPath
                Ignore node_modules imports EXCEPT
                capture these as external dependencies:
                  @supabase/*, next/*, react,
                  react-dom, stripe, resend,
                  @anthropic-sdk/*
                  Return external deps as separate array

                DETERMINE LAYER:
                Map file path to layer:
                  /app/**/page.tsx      → 'page'
                  /app/**/layout.tsx    → 'page'
                  /app/api/**           → 'api'
                  /components/**        → 'component'
                  /lib/** /utils/**     → 'util'
                  /hooks/**             → 'util'
                  /types/**             → 'util'
                  /middleware.ts        → 'api'
                  anything else         → 'other'

            - Build and return this JSON structure:
                {
                  nodes: [
                    {
                      id: string,          ← absolute path
                      label: string,       ← filename only
                      path: string,        ← relative to repoPath
                      layer: string,       ← page|api|component|util|other
                      overview: string,    ← @fileoverview text or ''
                      depends: string[],   ← @depends tags
                      externals: string[], ← external npm deps
                    }
                  ],
                  edges: [
                    {
                      source: string,  ← absolute path of importer
                      target: string,  ← absolute path of imported
                    }
                  ],
                  meta: {
                    projectName: string,
                    repoPath: string,
                    scannedAt: number,   ← epoch ms
                    totalFiles: number,
                    totalEdges: number,
                  }
                }

            - Cache result in memory:
                Map<repoPath, scanResult>
                Invalidate cache when archmap:rescan called

          ipcMain.handle('archmap:rescan', async (_, { repoPath }) => {
            // clear cache for this repoPath, re-run scan
          })

      - [ ] Add to preload.cjs bridge:
              archmapAPI: {
                scan:    (repoPath) => ipcRenderer.invoke('archmap:scan', { repoPath }),
                rescan:  (repoPath) => ipcRenderer.invoke('archmap:rescan', { repoPath }),
              }

      - [ ] Test scanner against DoulaFlow repo:
              Call archmap:scan with DoulaFlow repoPath
              Log result to console
              Verify:
                nodes array has expected files
                edges connect correctly
                @fileoverview text extracted correctly
                @depends tags parsed correctly
              Fix any parsing issues before marking done
              DO NOT proceed to Part 2 until scan output
              looks correct on a real project

      ── PART 2 — Graph Layout Engine ───────────────────────

      - [ ] Install layout dependency:
              npm install dagre
              dagre is a directed graph layout library
              handles node positioning automatically
              no need to hand-calculate coordinates

      - [ ] Create src/utils/graphLayout.ts:

            import dagre from 'dagre'

            LAYER CONFIG:
            const LAYER_COLORS = {
              page:      '#00d4ff',   ← accent (cyan)
              api:       '#ffc200',   ← gold
              component: '#00ffcc',   ← accent2 (teal)
              util:      '#00d4ff44', ← muted cyan
              other:     '#00d4ff22', ← very muted
            }

            const NODE_WIDTH  = 160
            const NODE_HEIGHT = 36
            const RANK_SEP    = 120  ← horizontal space between layers
            const NODE_SEP    = 20   ← vertical space between nodes

            LAYOUT FUNCTION:
            export function computeLayout(scanResult: ScanResult): LayoutResult {
              const g = new dagre.graphlib.Graph()
              g.setGraph({
                rankdir: 'LR',        ← left to right
                ranksep: RANK_SEP,
                nodesep: NODE_SEP,
                marginx: 40,
                marginy: 40,
              })
              g.setDefaultEdgeLabel(() => ({}))

              // Add nodes
              scanResult.nodes.forEach(node => {
                g.setNode(node.id, {
                  width: NODE_WIDTH,
                  height: NODE_HEIGHT,
                  ...node,
                })
              })

              // Add edges
              scanResult.edges.forEach(edge => {
                // only add edge if both nodes exist
                if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
                  g.setEdge(edge.source, edge.target)
                }
              })

              dagre.layout(g)

              // Extract positioned nodes
              const layoutNodes = scanResult.nodes.map(node => {
                const { x, y } = g.node(node.id)
                return {
                  ...node,
                  x, y,
                  width: NODE_WIDTH,
                  height: NODE_HEIGHT,
                  color: LAYER_COLORS[node.layer] ?? LAYER_COLORS.other,
                }
              })

              // Extract edges with path points
              const layoutEdges = scanResult.edges
                .filter(e => g.hasNode(e.source) && g.hasNode(e.target))
                .map(edge => ({
                  ...edge,
                  points: g.edge(edge.source, edge.target)?.points ?? [],
                }))

              // Calculate total canvas size
              const maxX = Math.max(...layoutNodes.map(n => n.x + NODE_WIDTH))
              const maxY = Math.max(...layoutNodes.map(n => n.y + NODE_HEIGHT))

              return {
                nodes: layoutNodes,
                edges: layoutEdges,
                width: maxX + 80,
                height: maxY + 80,
              }
            }

            TYPES (add to src/types.ts):
              ScanResult — matches archmap:scan return shape
              LayoutNode — ScanResult node + x, y, width,
                           height, color
              LayoutEdge — edge + points: {x,y}[]
              LayoutResult — { nodes, edges, width, height }

      ── PART 3 — SVG Rendering (ProjectArchMap.tsx) ────────

      - [ ] Build the main architecture map component
            File: src/ProjectArchMap.tsx (replace stub)

            COMPONENT STRUCTURE:
            - useEffect on mount: call archmapAPI.scan(repoPath)
              store raw scan result in useState
              run computeLayout() on scan result
              store layout result in useState

            STATES:
              idle:     project has no repoPath configured
              scanning: scan in progress
              error:    scan failed
              ready:    layout computed, render graph

            IDLE STATE:
              "// NO REPO PATH CONFIGURED"
              "Set repo path in project settings"
              centered, same empty state pattern

            SCANNING STATE:
              "// SCANNING [PROJECT NAME]..."
              animated blink cursor
              "reading files and mapping dependencies"
              font-size 9px, color var(--dim)

            ERROR STATE:
              "// SCAN FAILED"
              error message below in #ff4444
              [ RETRY ] button

            READY STATE — full SVG canvas:

              TOOLBAR (above canvas):
                border-bottom: 1px solid var(--border)
                padding: 8px 16px
                display: flex, gap 12px, align-items center

                Left side:
                  "// ARCH MAP" label
                  Scan meta: "[N] FILES · [N] EDGES · 
                    scanned [relative time]"
                  font-size 8px, color var(--dimmer)

                Right side:
                  [ RESCAN ] button
                  [ − ] [ + ] zoom buttons
                  [ ⊡ ] reset zoom/pan button
                  Search input:
                    placeholder: "// SEARCH FILES..."
                    font-size 9px, width 160px
                    filters/highlights matching nodes

                Layer legend (right of toolbar):
                  Small colored dot + label for each layer
                  ● PAGES  ● API ROUTES  ● COMPONENTS
                  ● UTILS  ● EXTERNAL
                  font-size 8px, gap 12px

              CANVAS:
                Container div:
                  flex: 1, overflow: hidden
                  position: relative
                  background: var(--bg)
                  cursor: grab (pan mode)
                  cursor: grabbing (while dragging)

                Zoom/pan via react-zoom-pan-pinch:
                  npm install react-zoom-pan-pinch
                  <TransformWrapper>
                    <TransformComponent>
                      <svg ...>
                  Initial scale: fit graph to viewport
                  Min scale: 0.2, Max scale: 2.0

                SVG element:
                  width: layoutResult.width
                  height: layoutResult.height

                RENDER EDGES (draw before nodes):
                  For each layoutEdge:
                    <path>
                      d: smooth cubic bezier through
                         edge.points
                      stroke: #00d4ff18 (default)
                      stroke: #00d4ff88 (if source or
                        target node is hovered/selected)
                      stroke-width: 1
                      fill: none
                    Arrow marker at end:
                      <defs>
                        <marker id="arrow" ...>
                          <path d="M0,0 L6,3 L0,6 Z"
                            fill="#00d4ff44" />
                      marker-end="url(#arrow)"

                RENDER NODES:
                  For each layoutNode:
                    <g transform="translate(x, y)"
                       onClick={() => selectNode(node)}
                       onMouseEnter/Leave for hover>

                      <rect
                        width={NODE_WIDTH}
                        height={NODE_HEIGHT}
                        fill="var(--bg-panel)"
                        stroke={node.color}
                        stroke-width={selected ? 2 : 1}
                        opacity={
                          searchQuery && !matches ? 0.15 : 1
                        }
                      />

                      <text
                        x={8} y={NODE_HEIGHT / 2}
                        dominant-baseline="middle"
                        fill={node.color}
                        font-size={10}
                        font-family="Share Tech Mono"
                        text-anchor="start">
                        {truncate(node.label, 18)}
                      </text>

                      Layer indicator dot right side:
                      <circle
                        cx={NODE_WIDTH - 10}
                        cy={NODE_HEIGHT / 2}
                        r={3}
                        fill={node.color}
                      />

                    </g>

      ── PART 4 — Node Detail Panel ──────────────────────────

      - [ ] Slide-in detail panel when node is clicked
            Renders to the right of the canvas
            Width: 280px, slides in with CSS transition
            border-left: 1px solid var(--border)
            background: var(--bg-panel)

            PANEL HEADER:
              Node filename in accent2, Rajdhani 700
              Layer badge: "API ROUTE" / "COMPONENT" etc.
                same style as project status badges
              [ × ] close button top right
              border-bottom: 1px solid var(--border)
              padding: 14px 16px

            SECTIONS (each with // LABEL header):

              // PATH
              Relative file path from repo root
              font-size 9px, color var(--dim)
              word-break: break-all

              // OVERVIEW (only if @fileoverview exists)
              @fileoverview text
              font-size 10px, color var(--text)
              line-height 1.8
              italic

              // DEPENDS ON (only if @depends exists)
              Each @depends tag as a badge:
                padding: 2px 8px
                border: 1px solid var(--border-md)
                font-size 8px, color var(--dim)
                letter-spacing 1px
                display: flex-wrap row

              // IMPORTS ([N] files)
              List of files this node imports
              (internal only, from edges where
               source === this node)
              Each as a clickable row:
                font-size 9px, color var(--dim)
                hover: color var(--accent), cursor pointer
                clicking navigates to that node
                (pan canvas to center it, select it)

              // IMPORTED BY ([N] files)
              List of files that import this node
              (reverse edges where target === this node)
              Same clickable row style

              // EXTERNAL DEPS (only if externals exist)
              List of external npm packages this
              file imports
              font-size 9px, color #b44dff
              non-clickable

            EMPTY STATE (no node selected):
              "// CLICK A NODE TO INSPECT"
              centered, color var(--dimmer)

      ── PART 5 — Controls, Search, Polish ──────────────────

      - [ ] Search functionality
            - Input in toolbar filters graph
            - As user types:
                Nodes that match label/path:
                  opacity: 1, stroke brightened
                Nodes that don't match:
                  opacity: 0.1
                Edges connected to matching nodes:
                  stroke: #00d4ff44
                Edges not connected:
                  stroke: #00d4ff08
            - Clear search: restore all opacities
            - Match logic: case-insensitive includes()
              on node.label and node.path

      - [ ] Zoom controls
            - [ − ] decrements scale by 0.2
            - [ + ] increments scale by 0.2
            - [ ⊡ ] resets to fit-to-viewport:
                calculate scale to fit entire graph
                in available canvas container size
                center the graph
            - Keyboard shortcuts:
                Cmd/Ctrl + scroll → zoom
                Space + drag → pan (already via
                react-zoom-pan-pinch)

      - [ ] Layer filter toggles
            Add to toolbar below legend:
            [ PAGES ] [ API ] [ COMPONENTS ]
            [ UTILS ] [ EXTERNAL ]
            All active by default
            Clicking a layer toggle:
              Hides all nodes of that layer
              (opacity: 0, pointer-events: none)
              Hides edges where both nodes are hidden
              Button style: active = colored border,
                inactive = var(--border-md) border

      - [ ] Performance guard
            - If node count > 150:
              Show warning before rendering:
                "// LARGE PROJECT — [N] FILES DETECTED"
                "Rendering may be slow on first load"
                [ RENDER ANYWAY ]  [ CANCEL ]
              After first render cache the SVG layout
              so rescan is the only way to regenerate

      - [ ] [ RESCAN ] behavior
            - Calls archmapAPI.rescan(repoPath)
            - Shows scanning state while running
            - On complete: recomputes layout,
              re-renders graph
            - Clears selected node and search query
            - Updates "scanned X ago" in toolbar meta

      - [ ] Tab integration
            - // ARCH MAP tab in ProjectPanel.tsx
              already exists as placeholder
            - Wire it to render <ProjectArchMap>
              passing current project's repoPath
            - Lazy load: only call archmapAPI.scan
              when tab is first activated
              not on project select
            - Cache scan result per project in
              React state so switching tabs doesn't
              re-scan unnecessarily




- [ ] Add delete button below reply button in email detail view
      - Locate the reply button in the email detail panel component in `src/App.tsx`
      - Add a `Delete` button rendered immediately after the reply button in the same button group or action column
      - Style with the Emberforge aesthetic: `border: 1px solid #ff4444`, `color: #ff4444`, background transparent, `font-family: 'Share Tech Mono'`, hover state fills background with `#ff4444` at low opacity
      - Add `onClick` handler that calls a `handleDeleteEmail(email.id)` function
      - Implement `handleDeleteEmail` in component state logic: filter the email out of the inbox emails array in React state
      - If the deleted email is currently selected/open, clear the selected email state to return to inbox list view
      - Add a confirmation step via a small inline prompt or `window.confirm()` before deleting to prevent accidental loss
      - Ensure the deleted email disappears from the sidebar/inbox list immediately on confirm (optimistic UI update)
      - If Supabase email storage is wired up (per V1 roadmap), also fire a delete or soft-delete call to the relevant Supabase table after removing from local state
