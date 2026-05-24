# Emberforge Command Center

## Concept
A web-based command center dashboard using the Emberforge.OS 
aesthetic (dark cyberpunk, icy blue, three-column finder layout).
Built for personal use to monitor and manage deployed applications
under Emberforge Labs.

## Layout
- Left sidebar: project/app list (same // prefix nav style)
- Middle panel: selected app status and activity feed
- Right panel: detail view, drill-down, or agent chat

## Core Features (V1 Concept)
- Vercel deployment status per project
- Supabase health and recent activity
- GitHub last commit and open issues
- Per-project AI agent (Claude API, pre-loaded with 
  project CLAUDE.md context)
- Self-contained chat per app — project-aware assistant

## Tech Stack (Proposed)
- Next.js (consistent with existing Emberforge work)
- Vercel API, Supabase API, GitHub API
- Anthropic API for per-project agents
- Same color system and typography as Emberforge.OS

## Status
- Backlog — revisit when taking on a new client project
  or when Emberforge Labs scope becomes clearer

## Origin
Spun out of Emberforge.OS UI exploration, May 2026