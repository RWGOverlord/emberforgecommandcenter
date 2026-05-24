# Emberforge Command Center

Desktop Electron + React app for Mac using the Emberforge.OS aesthetic.
Monitors and manages deployed applications under Emberforge Labs.

## Stack
- Electron 42 + React 19 + TypeScript + Vite 8
- Share Tech Mono + Rajdhani (Google Fonts, same as .OS)

## Setup

```bash
npm install
npm run electron:dev      # Vite dev server + Electron together
npm run electron:build    # Build .dmg for Mac
```

## Structure
```
electron/
  main.cjs        ← Electron main process (frameless, fullscreen)
  preload.cjs     ← Context bridge
src/
  App.tsx         ← Full shell (boot, sidebar, panels, status bar)
  index.css       ← CSS variables, fonts, keyframes
  main.tsx        ← React entry
```

## Dev Notes
- Window starts non-fullscreen for dev. Set `fullscreen: true` in
  `electron/main.cjs` for production feel.
- F11 toggles fullscreen at runtime.
- `main.cjs` is CommonJS — Electron doesn't support ESM in main process yet.
  Renderer (Vite/React) is full ESM.
- Traffic lights preserved via `titleBarStyle: 'hidden'` + `trafficLightPosition`.

## Aesthetic
Exact match to Emberforge.OS:
  bg #020810 · accent #00d4ff · secondary #00ffcc
  Fonts: Share Tech Mono + Rajdhani
  Scanline overlay, animated grid, flicker, // prefix nav

## V1 Roadmap
- [ ] Vercel API — deploy status per project
- [ ] Supabase — health + activity feed
- [ ] GitHub — last commit + open issues
- [ ] Per-project Claude agent (pre-loaded with CLAUDE.md context)
- [ ] Color theme system (matches .OS 6 themes)
