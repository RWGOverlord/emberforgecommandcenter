import { useState, useEffect, useCallback, useRef } from 'react'
import './index.css'
import VaultPanel from './VaultPanel'
import NodePanel, { type QuickLaunchApp } from './NodePanel'
import MessagesPanel from './MessagesPanel'
import MailPanel from './MailPanel'
import projectsData from './assets/projects.json'

// ─── Types ────────────────────────────────────────────────────────────────────
type GmailThread = {
  id: string; subject: string; from: string; snippet: string; timestamp: number; unread: boolean
}

type GmailMessage = {
  id: string; from: string; to: string; subject: string; body: string; timestamp: number; fromMe: boolean
}

type Project = {
  id: string
  label: string
  repoPath: string
  claudeMd: string
  tasksFile: string
  bugsFile: string
  vercelProject: string | null
  status: string
  statusColor: string
}

const STATUS_COLORS: Record<string, string> = {
  LIVE: '#00ffcc', LOCAL: '#00d4ff', REPO: '#00d4ff', PLANNED: '#555555',
}


function applyFontSize(size: 'S' | 'M' | 'L') {
  document.documentElement.style.zoom = size === 'S' ? '1' : size === 'M' ? '1.15' : '1.3'
}

type VaultNode = {
  name: string
  path: string
  type: 'folder' | 'file'
  ext: string
  modified: number
  children?: VaultNode[]
}

declare global {
  interface Window {
    electronAPI?: {
      platform: string
      vaultAPI?: {
        readTree:   () => Promise<VaultNode[]>
        readFile:   (path: string) => Promise<{ content: string; modified: number }>
        writeFile:  (path: string, content: string) => Promise<{ success: boolean; error?: string }>
        getPath:    () => Promise<string>
        choosePath: () => Promise<{ path: string } | null>
        onChange:   (cb: () => void) => void
        offChange:  (cb: () => void) => void
      }
      openApp: (path: string) => Promise<void>
      openInVSCode: (repoPath: string) => Promise<{ success: boolean }>
      projectAPI: {
        readFile:    (repoPath: string, filename: string) => Promise<{ content: string } | { error: string }>
        appendEntry: (repoPath: string, filename: string, entry: string) => Promise<{ success: boolean; error?: string }>
        gitPush:     (repoPath: string, filename: string, message: string) => Promise<{ success: boolean; output: string; error?: string }>
      }
      settingsAPI: {
        set:      (key: string, value: unknown) => Promise<void>
        get:      (key: string) => Promise<unknown>
        writeEnv: (key: string, value: string) => Promise<{ success: boolean }>
      }
      remindersAPI: {
        read:  () => Promise<{ content: string }>
        write: (content: string) => Promise<{ success: boolean; error?: string }>
      }
      waAPI: {
        connect:           () => Promise<{ success: boolean }>
        disconnect:        () => Promise<{ success: boolean }>
        getChats:          () => Promise<{ chats: WaChat[]; status: string }>
        getMessages:       (jid: string) => Promise<{ messages: WaMessage[] }>
        sendMessage:       (jid: string, text: string) => Promise<{ success: boolean; error?: string }>
        onStatus:          (cb: (s: string) => void) => void
        onQR:              (cb: (qr: string) => void) => void
        onChatsUpdated:    (cb: (chats: WaChat[]) => void) => void
        onMessagesUpdated: (cb: (data: { jid: string; messages: WaMessage[] }) => void) => void
        offAll:            () => void
      }
      vercelAPI: {
        getStatus: (projectId: string, teamId: string | undefined, token: string) => Promise<{ state?: string; createdAt?: number; meta?: { githubCommitMessage: string; githubCommitRef: string }; error?: string }>
        getLogs:   (projectId: string, teamId: string | undefined, token: string) => Promise<{ logs?: Array<{ timestamp: number; level: string; message: string; source: string; requestPath?: string; responseStatusCode?: number }>; error?: string }>
      }
      githubAPI: {
        getStatus:  (repoPath: string, token: string) => Promise<{ lastCommit?: { message: string; author: string; timestamp: number; branch: string }; openIssues?: number; error?: string }>
        getCommits: (repoPath: string, token: string) => Promise<{ commits?: Array<{ sha: string; message: string; author: string; timestamp: number; url: string }>; error?: string }>
      }
      supabaseAPI: {
        getStatus: (projectUrl: string, anonKey: string) => Promise<{ healthy?: boolean; error?: string }>
      }
      marketAPI: {
        getQuotes: () => Promise<Array<{ label: string; group: string; price: number | null; prevClose: number | null; error: boolean }>>
      }
      gmailAPI: {
        getStatus:  () => Promise<string>
        authorize:  () => Promise<{ success: boolean; error?: string }>
        getThreads: (pageToken?: string) => Promise<{ threads?: GmailThread[]; nextPageToken?: string | null; error?: string }>
        getThread:  (threadId: string) => Promise<{ messages?: GmailMessage[]; error?: string }>
        sendEmail:  (to: string, subject: string, body: string, threadId?: string) => Promise<{ success: boolean; error?: string }>
        markRead:   (threadId: string) => Promise<{ success: boolean; error?: string }>
        onStatus:   (cb: (s: string) => void) => void
        offStatus:  () => void
      }
      messagesAPI: {
        connect:          () => Promise<{ success?: boolean; error?: string }>
        getThreads:       () => Promise<{ threads?: MessageThread[]; error?: string }>
        getThread:        (threadId: string) => Promise<{ messages?: Message[]; error?: string }>
        sendMessage:      (number: string, body: string) => Promise<{ success: boolean; error?: string }>
        getDevices:       () => Promise<{ iden?: string; nickname?: string; error?: string }>
        onThreadsUpdated: (cb: (threads: MessageThread[]) => void) => void
        onThreadUpdated:  (cb: (data: { threadId: string; messages: Message[] }) => void) => void
        offThreadsUpdated:(cb: (threads: MessageThread[]) => void) => void
        offThreadUpdated: (cb: (data: { threadId: string; messages: Message[] }) => void) => void
      }
    }
  }
}

type WaChat = {
  id: string
  name: string
  snippet: string
  timestamp: number
  unread: boolean
}

type WaMessage = {
  id: string
  body: string
  timestamp: number
  direction: 'inbound' | 'outbound'
}

type MessageThread = {
  id: string
  name: string
  number: string
  snippet: string
  timestamp: number
  unread: boolean
}

type Message = {
  id: string
  body: string
  timestamp: number
  direction: 'inbound' | 'outbound'
}

// ─── Nav structure ────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'node',     label: '// NODE',     icon: '◈' },
  { id: 'mail',     label: '// MAIL',     icon: '✉' },
  { id: 'messages', label: '// COMMS', icon: '✉' },
  { id: 'vault',    label: '// VAULT',    icon: '≡' },
  { id: 'projects', label: '// PROJECTS', icon: '▦' },
  { id: 'agents',   label: '// AGENTS',   icon: '◷', divider: true },
  { id: 'system',   label: '// SYSTEM',   icon: '⚙' },
]

const SYSTEM_CATEGORIES = [
  { id: 'display',     label: 'DISPLAY'      },
  { id: 'connections', label: 'CONNECTIONS'  },
  { id: 'quicklaunch', label: 'QUICK LAUNCH' },
  { id: 'vault',       label: 'VAULT PATH'   },
  { id: 'about',       label: 'ABOUT'        },
]

const BOOT_LINES = [
  '> INIT EMBERFORGE COMMAND CENTER...',
  '> LOADING CORE MODULES...',
  '> MOUNTING VAULT: RISING WARRIOR GAMES...',
  '> INDEXING FILES...',
  '> CONNECTING PROJECT REGISTRY...',
  '> ALL SYSTEMS NOMINAL.',
  '> WELCOME BACK, FATHERJEDEDIAH.',
]

const BOOT_LINE_DELAY = 350
const BOOT_CHAR_DELAY = 18
const BOOT_FINISH_DELAY = 800

const PROJECTS_FALLBACK = projectsData as Project[]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function relTimeShort(ms: number): string {
  const diff  = Date.now() - ms
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)   return 'just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}hr ago`
  if (days  === 1) return 'yesterday'
  return `${days}d ago`
}

function countVaultFiles(nodes: VaultNode[]): number {
  return nodes.reduce((acc, node) => {
    if (node.type === 'file' && (node.ext === '.md' || node.ext === '.txt')) return acc + 1
    if (node.type === 'folder' && node.children) return acc + countVaultFiles(node.children)
    return acc
  }, 0)
}

function relativeTime(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  const weeks = Math.floor(days / 7)
  return `${weeks} week${weeks > 1 ? 's' : ''} ago`
}

// ─── New project form ─────────────────────────────────────────────────────────
function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 8, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-mono)', marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 1, fontFamily: 'var(--font-mono)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function NewProjectForm({ onCreated, onCancel }: {
  onCreated: (project: Project) => void
  onCancel: () => void
}) {
  const [label,       setLabel]       = useState('')
  const [repoPath,    setRepoPath]    = useState('')
  const [contextFile, setContextFile] = useState('CLAUDE.md')
  const [tasksFile,   setTasksFile]   = useState('TASKS.md')
  const [bugsFile,    setBugsFile]    = useState('BUGS.md')
  const [vercelId,    setVercelId]    = useState('')
  const [status,      setStatus]      = useState('LOCAL')
  const [error,       setError]       = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg)', border: 'none',
    borderBottom: '1px solid var(--border-md)',
    color: 'var(--text)', fontFamily: 'var(--font-mono)',
    fontSize: 11, padding: '6px 0', outline: 'none',
  }

  function handleCreate() {
    if (!label.trim() || !repoPath.trim()) { setError('// LABEL AND REPO PATH REQUIRED'); return }
    onCreated({
      id: label.trim().toLowerCase().replace(/\s+/g, '-'),
      label: label.trim(),
      repoPath: repoPath.trim(),
      claudeMd: contextFile.trim() || 'CLAUDE.md',
      tasksFile: tasksFile.trim() || 'TASKS.md',
      bugsFile: bugsFile.trim() || 'BUGS.md',
      vercelProject: vercelId.trim() || null,
      status,
      statusColor: STATUS_COLORS[status] ?? '#00d4ff',
    })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden', animation: 'slide-in 0.2s ease both', position: 'relative' }}>
      <GridBg />
      <div style={{ height: 44, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 20px', flexShrink: 0, zIndex: 1 }}>
        <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 12, color: 'var(--accent)', letterSpacing: 1 }}>// NEW PROJECT</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20, zIndex: 1 }}>
        <FormRow label="// LABEL">
          <input value={label} onChange={e => { setLabel(e.target.value); setError('') }} placeholder="e.g. DoulaFlow"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
            onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
          />
        </FormRow>
        <FormRow label="// REPO PATH" hint="/Users/risingwarriorgames/Documents/07_TechProjects/...">
          <input value={repoPath} onChange={e => { setRepoPath(e.target.value); setError('') }} placeholder="/Users/..."
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
            onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
          />
        </FormRow>
        <FormRow label="// CONTEXT FILE" hint="AI context file at repo root">
          <input value={contextFile} onChange={e => setContextFile(e.target.value)} placeholder="CLAUDE.md"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
            onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
          />
        </FormRow>
        <FormRow label="// TASKS FILE">
          <input value={tasksFile} onChange={e => setTasksFile(e.target.value)} placeholder="TASKS.md"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
            onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
          />
        </FormRow>
        <FormRow label="// BUGS FILE">
          <input value={bugsFile} onChange={e => setBugsFile(e.target.value)} placeholder="BUGS.md"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
            onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
          />
        </FormRow>
        <FormRow label="// VERCEL ID">
          <input value={vercelId} onChange={e => setVercelId(e.target.value)} placeholder="optional"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
            onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
          />
        </FormRow>
        <FormRow label="// STATUS">
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            {(['LIVE', 'LOCAL', 'REPO', 'PLANNED'] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                style={{ flex: 1, padding: '6px 0', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
                  background: 'transparent', cursor: 'pointer', textTransform: 'uppercase',
                  border: `1px solid ${status === s ? 'var(--accent)' : 'var(--border-md)'}`,
                  color: status === s ? 'var(--accent)' : 'var(--dimmer)',
                }}>
                {s}
              </button>
            ))}
          </div>
        </FormRow>
        {error && <div style={{ fontSize: 9, color: '#ff4444', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button onClick={onCancel}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--dim)'; e.currentTarget.style.color = 'var(--dim)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dimmer)'; e.currentTarget.style.color = 'var(--dimmer)' }}
            style={{ padding: '6px 16px', fontSize: 9, letterSpacing: 2, border: '1px solid var(--dimmer)', color: 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}>
            [ CANCEL ]
          </button>
          <button onClick={handleCreate}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            style={{ padding: '6px 16px', fontSize: 9, letterSpacing: 2, border: '1px solid var(--accent)', color: 'var(--accent)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}>
            [ CREATE PROJECT ]
          </button>
        </div>
      </div>
    </div>
  )
}

function EditProjectForm({ project, onSaved, onCancel }: {
  project: Project
  onSaved: (project: Project) => void
  onCancel: () => void
}) {
  const [label,       setLabel]       = useState(project.label)
  const [repoPath,    setRepoPath]    = useState(project.repoPath)
  const [contextFile, setContextFile] = useState(project.claudeMd)
  const [tasksFile,   setTasksFile]   = useState(project.tasksFile)
  const [bugsFile,    setBugsFile]    = useState(project.bugsFile)
  const [vercelId,    setVercelId]    = useState(project.vercelProject ?? '')
  const [status,      setStatus]      = useState(project.status)
  const [error,       setError]       = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg)', border: 'none',
    borderBottom: '1px solid var(--border-md)',
    color: 'var(--text)', fontFamily: 'var(--font-mono)',
    fontSize: 11, padding: '6px 0', outline: 'none',
  }

  function handleSave() {
    if (!label.trim() || !repoPath.trim()) { setError('// LABEL AND REPO PATH REQUIRED'); return }
    onSaved({
      ...project,
      label: label.trim(),
      repoPath: repoPath.trim(),
      claudeMd: contextFile.trim() || 'CLAUDE.md',
      tasksFile: tasksFile.trim() || 'TASKS.md',
      bugsFile: bugsFile.trim() || 'BUGS.md',
      vercelProject: vercelId.trim() || null,
      status,
      statusColor: STATUS_COLORS[status] ?? '#00d4ff',
    })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden', animation: 'slide-in 0.2s ease both', position: 'relative' }}>
      <GridBg />
      <div style={{ height: 44, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 20px', flexShrink: 0, zIndex: 1 }}>
        <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 12, color: 'var(--accent)', letterSpacing: 1 }}>// EDIT — {project.label.toUpperCase()}</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20, zIndex: 1 }}>
        <FormRow label="// LABEL">
          <input value={label} onChange={e => { setLabel(e.target.value); setError('') }} placeholder="e.g. DoulaFlow"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
            onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
          />
        </FormRow>
        <FormRow label="// REPO PATH" hint="/Users/risingwarriorgames/Documents/07_TechProjects/...">
          <input value={repoPath} onChange={e => { setRepoPath(e.target.value); setError('') }} placeholder="/Users/..."
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
            onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
          />
        </FormRow>
        <FormRow label="// CONTEXT FILE" hint="AI context file at repo root">
          <input value={contextFile} onChange={e => setContextFile(e.target.value)} placeholder="CLAUDE.md"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
            onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
          />
        </FormRow>
        <FormRow label="// TASKS FILE">
          <input value={tasksFile} onChange={e => setTasksFile(e.target.value)} placeholder="TASKS.md"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
            onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
          />
        </FormRow>
        <FormRow label="// BUGS FILE">
          <input value={bugsFile} onChange={e => setBugsFile(e.target.value)} placeholder="BUGS.md"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
            onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
          />
        </FormRow>
        <FormRow label="// VERCEL ID">
          <input value={vercelId} onChange={e => setVercelId(e.target.value)} placeholder="optional"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
            onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
          />
        </FormRow>
        <FormRow label="// STATUS">
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            {(['LIVE', 'LOCAL', 'REPO', 'PLANNED'] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                style={{ flex: 1, padding: '6px 0', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
                  background: 'transparent', cursor: 'pointer', textTransform: 'uppercase',
                  border: `1px solid ${status === s ? 'var(--accent)' : 'var(--border-md)'}`,
                  color: status === s ? 'var(--accent)' : 'var(--dimmer)',
                }}>
                {s}
              </button>
            ))}
          </div>
        </FormRow>
        {error && <div style={{ fontSize: 9, color: '#ff4444', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button onClick={onCancel}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--dim)'; e.currentTarget.style.color = 'var(--dim)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dimmer)'; e.currentTarget.style.color = 'var(--dimmer)' }}
            style={{ padding: '6px 16px', fontSize: 9, letterSpacing: 2, border: '1px solid var(--dimmer)', color: 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}>
            [ CANCEL ]
          </button>
          <button onClick={handleSave}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            style={{ padding: '6px 16px', fontSize: 9, letterSpacing: 2, border: '1px solid var(--accent)', color: 'var(--accent)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}>
            [ SAVE CHANGES ]
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function GridBg() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
      backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
      backgroundSize: '60px 60px',
      animation: 'grid-scroll 8s linear infinite',
      opacity: 0.5,
    }} />
  )
}

function Scanline() {
  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999,
      background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px)',
    }} />
  )
}

// ─── Boot screen ──────────────────────────────────────────────────────────────
function BootScreen({ lines }: { lines: string[] }) {
  return (
    <div style={{
      width: '100%', height: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-mono)', color: 'var(--accent)',
      fontSize: 12, gap: 6, padding: 40,
      position: 'relative', overflow: 'hidden',
      animation: 'flicker 6s infinite',
    }}>
      <GridBg />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, minWidth: 460 }}>
        <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 20, letterSpacing: 8, alignSelf: 'center' }}>
          EMBERFORGE LABS // COMMAND CENTER
        </div>
        {lines.map((line, i) => (
          <div key={i} style={{
            animation: 'fade-up 0.3s ease both',
            color: i === lines.length - 1 ? 'var(--accent2)' : 'var(--dim)',
            letterSpacing: 0.5,
          }}>{line}</div>
        ))}
        <span style={{ animation: 'blink 1s infinite', marginTop: 4, color: 'var(--accent)' }}>█</span>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
type SidebarProps = {
  active: string
  onSelect: (id: string) => void
  vaultTree: VaultNode[]
  vaultLoading: boolean
  vaultError: boolean
  selectedGame: string | null
  onSelectGame: (path: string) => void
  onChooseVaultPath: () => void
}

function Sidebar({ active, onSelect, vaultTree, vaultLoading, vaultError, selectedGame, onSelectGame, onChooseVaultPath }: SidebarProps) {
  const isVaultExpanded = active === 'vault'
  const gameFolders = vaultTree.filter(n => n.type === 'folder')

  function navItemStyle(isActive: boolean, nested = false) {
    return {
      display: 'flex', alignItems: 'center', gap: 10,
      padding: nested ? '8px 16px 8px 30px' : '9px 16px',
      cursor: 'pointer',
      fontSize: nested ? 9 : 10,
      letterSpacing: 1,
      fontFamily: 'var(--font-mono)',
      color: isActive ? 'var(--accent2)' : 'var(--dim)',
      background: isActive ? 'var(--bg-hover)' : 'transparent',
      borderLeft: isActive ? '2px solid var(--accent2)' : '2px solid transparent',
      transition: 'all 0.15s ease',
    } as React.CSSProperties
  }

  function hoverOn(e: React.MouseEvent<HTMLDivElement>, isActive: boolean) {
    if (!isActive) {
      const el = e.currentTarget as HTMLDivElement
      el.style.background = 'var(--bg-hover)'
      el.style.color = 'var(--accent)'
    }
  }
  function hoverOff(e: React.MouseEvent<HTMLDivElement>, isActive: boolean) {
    if (!isActive) {
      const el = e.currentTarget as HTMLDivElement
      el.style.background = 'transparent'
      el.style.color = 'var(--dim)'
    }
  }

  function vaultHeaderStyle() {
    return {
      padding: '8px 16px 6px 30px',
      fontSize: 8,
      color: 'var(--dimmer)',
      letterSpacing: 2,
      fontFamily: 'var(--font-mono)',
      borderLeft: '2px solid transparent',
    } as React.CSSProperties
  }

  function renderVaultContent() {
    if (vaultLoading) return (
      <div style={{ padding: '10px 16px 10px 30px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--dim)', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>
        <span>// READING VAULT...</span>
        <span style={{ animation: 'blink 1s infinite' }}>█</span>
      </div>
    )
    if (vaultError) return (
      <div style={{ padding: '10px 16px 12px 30px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 9, color: '#ff4444', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>// VAULT NOT FOUND</div>
        <button
          onClick={onChooseVaultPath}
          style={{ background: 'transparent', border: '1px solid var(--border-md)', color: 'var(--dim)', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 1, padding: '6px 10px', cursor: 'pointer' }}
        >
          [ CHOOSE FOLDER ]
        </button>
      </div>
    )
    if (!gameFolders.length) return (
      <div style={{ padding: '10px 16px 12px 30px', fontSize: 9, color: 'var(--dimmer)', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>
        // NO VAULT FOLDERS
      </div>
    )
    return gameFolders.map(game => (
      <div
        key={game.path}
        onClick={() => onSelectGame(game.path)}
        style={navItemStyle(selectedGame === game.path, true)}
        onMouseEnter={e => hoverOn(e, selectedGame === game.path)}
        onMouseLeave={e => hoverOff(e, selectedGame === game.path)}
      >
        <span style={{ fontSize: 12, opacity: 0.8 }}>≡</span>
        <span>// {game.name.toUpperCase()}</span>
      </div>
    ))
  }

  return (
    <div style={{
      width: 200, flexShrink: 0,
      borderRight: '1px solid var(--border)',
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', zIndex: 2,
    }}>
      <div style={{
        height: 44, borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        paddingLeft: 76, gap: 8,
      }}>
        <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-head)', fontWeight: 700 }}>
          COMMAND CENTER
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {NAV_ITEMS.map(item => {
          const isActive = active === item.id
          const isVaultItem = item.id === 'vault'

          return (
            <div key={item.id}>
              {item.divider && <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />}
              <div
                onClick={() => onSelect(item.id)}
                style={navItemStyle(isActive)}
                onMouseEnter={e => hoverOn(e, isActive)}
                onMouseLeave={e => hoverOff(e, isActive)}
              >
                <span style={{ fontSize: 13, opacity: 0.8 }}>{item.icon}</span>
                <span>{item.label}</span>
                {isVaultItem && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: isActive ? 'var(--accent2)' : 'var(--dimmer)' }}>
                    {isVaultExpanded ? '▼' : '▶'}
                  </span>
                )}
              </div>

              {isVaultItem && isVaultExpanded && (
                <div style={{
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: 6,
                  animation: 'fade-up 0.2s ease both',
                }}>
                  <div style={vaultHeaderStyle()}>// VAULT FOLDERS</div>
                  {renderVaultContent()}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{
        borderTop: '1px solid var(--border)', padding: '10px 16px',
        fontSize: 9, color: 'var(--dimmer)', letterSpacing: 1,
      }}>
        <div>EMBERFORGE LABS</div>
        <div style={{ marginTop: 2, color: 'var(--border-md)' }}>v0.1.0 // ALPHA</div>
      </div>
    </div>
  )
}

// ─── Middle panel ─────────────────────────────────────────────────────────────
type MiddlePanelProps = {
  section: string
  selected: string | null
  onSelect: (id: string) => void
  vaultTree: VaultNode[]
  selectedGame: string | null
  selectedFile: string | null
  onSelectFile: (path: string) => void
  projects: Project[]
  onAddProject: () => void
}

function MiddlePanel({ section, selected, onSelect, vaultTree, selectedGame, selectedFile, onSelectFile, projects, onAddProject }: MiddlePanelProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const isVault = section === 'vault'

  useEffect(() => { setExpandedFolders(new Set()) }, [selectedGame])

  function toggleFolder(path: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  const gameNode = isVault && selectedGame ? vaultTree.find(n => n.path === selectedGame) : null

  const header = (() => {
    if (isVault && gameNode) return `// ${gameNode.name.toUpperCase()}`
    return NAV_ITEMS.find(n => n.id === section)?.label ?? section.toUpperCase()
  })()

  function fileRow(file: VaultNode, indent: boolean, delay: number) {
    const isSelected = selectedFile === file.path
    return (
      <div
        key={file.path}
        onClick={() => onSelectFile(file.path)}
        style={{
          padding: indent ? '10px 16px 10px 32px' : '10px 16px',
          borderBottom: '1px solid var(--border)',
          cursor: 'pointer',
          background: isSelected ? 'var(--bg-hover)' : 'transparent',
          borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
          animation: 'fade-up 0.25s ease both',
          animationDelay: `${delay}s`,
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
      >
        <div style={{ fontSize: 11, color: 'var(--text)', fontFamily: 'var(--font-head)', fontWeight: 600, letterSpacing: 0.5, marginBottom: 3 }}>
          {file.name.replace(/\.md$/, '')}
        </div>
        <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 0.5 }}>
          // modified {relativeTime(file.modified)}
        </div>
      </div>
    )
  }

  function renderVaultContent() {
    if (!selectedGame) return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 40 }}>
        <div style={{ fontSize: 28, color: 'var(--dimmer)' }}>≡</div>
        <div style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 3 }}>// SELECT A GAME</div>
      </div>
    )

    const children = gameNode?.children ?? []
    const subfolders = children.filter(n => n.type === 'folder')
    const rootFiles  = children.filter(n => n.type === 'file' && n.ext === '.md')

    if (!subfolders.length && !rootFiles.length) return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 40 }}>
        <div style={{ fontSize: 28, color: 'var(--dimmer)' }}>⬡</div>
        <div style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 3 }}>// NO FILES</div>
      </div>
    )

    const items: React.JSX.Element[] = []
    let idx = 0

    subfolders.forEach(folder => {
      const isExpanded = expandedFolders.has(folder.path)
      items.push(
        <div
          key={folder.path}
          onClick={() => toggleFolder(folder.path)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', cursor: 'pointer',
            borderBottom: '1px solid var(--border)',
            animation: 'fade-up 0.25s ease both',
            animationDelay: `${idx++ * 0.05}s`,
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
        >
          <span style={{ fontSize: 10, color: 'var(--dim)', fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>-- {folder.name}</span>
          <span style={{ fontSize: 9, color: 'var(--dimmer)' }}>{isExpanded ? '▼' : '▶'}</span>
        </div>
      )
      if (isExpanded) {
        const folderFiles = folder.children?.filter(n => n.type === 'file' && n.ext === '.md') ?? []
        folderFiles.forEach(file => { items.push(fileRow(file, true, idx++ * 0.04)) })
      }
    })

    rootFiles.forEach(file => { items.push(fileRow(file, false, idx++ * 0.05)) })

    return <>{items}</>
  }

  return (
    <div style={{
      width: 280, flexShrink: 0,
      borderRight: '1px solid var(--border)',
      background: 'var(--bg-panel)',
      display: 'flex', flexDirection: 'column', zIndex: 1,
      animation: 'slide-in 0.2s ease both',
    }}>
      <div style={{
        height: 44, borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 16px', flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 2, fontFamily: 'var(--font-head)', fontWeight: 700 }}>{header}</span>
        <span style={{ animation: 'blink 1.4s infinite', fontSize: 10, color: 'var(--dimmer)' }}>▌</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {isVault ? renderVaultContent() : section === 'system' ? SYSTEM_CATEGORIES.map((cat, i) => (
          <div
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            onMouseEnter={e => { if (selected !== cat.id) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { if (selected !== cat.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              background: selected === cat.id ? 'var(--bg-hover)' : 'transparent',
              borderLeft: selected === cat.id ? '2px solid var(--accent)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 6,
              animation: 'fade-up 0.25s ease both',
              animationDelay: `${i * 0.05}s`,
              transition: 'background 0.15s ease',
            }}
          >
            <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'var(--font-mono)' }}>--</span>
            <span style={{ fontSize: 10, color: selected === cat.id ? 'var(--accent2)' : 'var(--dim)', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>{cat.label}</span>
          </div>
        )) : section === 'projects' ? projects.map((p, i) => (
          <div
            key={p.id}
            onClick={() => onSelect(p.id)}
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              background: selected === p.id ? 'var(--bg-hover)' : 'transparent',
              borderLeft: selected === p.id ? '2px solid var(--accent)' : '2px solid transparent',
              animation: 'fade-up 0.25s ease both',
              animationDelay: `${i * 0.05}s`,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => { if (selected !== p.id) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { if (selected !== p.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text)', fontFamily: 'var(--font-head)', fontWeight: 600, letterSpacing: 0.5 }}>{p.label}</span>
              <span style={{ fontSize: 8, color: p.statusColor, letterSpacing: 1, padding: '1px 5px', border: `1px solid ${p.statusColor}55` }}>{p.status}</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 0.5 }}>{p.vercelProject ?? '—'}</div>
          </div>
        )) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 40 }}>
            <div style={{ fontSize: 28, color: 'var(--dimmer)' }}>⬡</div>
            <div style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 3 }}>DIRECTORY EMPTY</div>
            <div style={{ fontSize: 8, color: 'var(--border-md)', letterSpacing: 1, marginTop: 4 }}>— V2 —</div>
          </div>
        )}
      </div>
      {section === 'projects' && (
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onAddProject}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.color = 'var(--dimmer)' }}
            style={{ width: 'calc(100% - 32px)', margin: '12px 16px', padding: 8, fontSize: 9, letterSpacing: 2, border: '1px solid var(--border-md)', color: 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease', display: 'block' }}
          >
            [ + NEW PROJECT ]
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Connections panel ────────────────────────────────────────────────────────
function ConnectionsPanel() {
  const [pbKey,       setPbKey]       = useState('')
  const [pbSaved,     setPbSaved]     = useState(false)
  const [anthropicKey, setAnthropicKey] = useState('')
  const [anthropicSaved, setAnthropicSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const pb = await window.electronAPI?.settingsAPI?.get('pushbullet.apiKey')
      if (typeof pb === 'string' && pb) { setPbKey(pb); setPbSaved(true) }
      const ak = await window.electronAPI?.settingsAPI?.get('anthropic.apiKey')
      if (typeof ak === 'string' && ak) { setAnthropicKey(ak); setAnthropicSaved(true) }
    }
    void load()
  }, [])

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg)', border: 'none',
    borderBottom: '1px solid var(--border-md)',
    color: 'var(--text)', fontFamily: 'var(--font-mono)',
    fontSize: 11, padding: '6px 0', outline: 'none',
  }

  async function saveAnthropicKey() {
    const key = anthropicKey.trim()
    await window.electronAPI?.settingsAPI?.set('anthropic.apiKey', key)
    await window.electronAPI?.settingsAPI?.writeEnv('VITE_ANTHROPIC_API_KEY', key)
    setAnthropicSaved(true)
  }

  async function savePbKey() {
    await window.electronAPI?.settingsAPI?.set('pushbullet.apiKey', pbKey)
    setPbSaved(true)
  }

  function SaveRow({ canSave, saved, onSave }: { canSave: boolean; saved: boolean; onSave: () => void }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <button
          onClick={onSave}
          disabled={!canSave}
          onMouseEnter={e => { if (canSave) e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          style={{
            padding: '6px 14px', fontSize: 9, letterSpacing: 2,
            border: `1px solid ${canSave ? 'var(--accent)' : 'var(--border-md)'}`,
            color: canSave ? 'var(--accent)' : 'var(--dim)',
            background: 'transparent', cursor: canSave ? 'pointer' : 'default',
            fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease',
          }}
        >[ SAVE ]</button>
        {saved && <span style={{ fontSize: 9, color: 'var(--accent2)', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>CONFIGURED ✓</span>}
      </div>
    )
  }

  return (
    <div style={{ padding: 20, zIndex: 1, display: 'flex', flexDirection: 'column', gap: 28 }}>

      <div>
        <div style={{ fontSize: 8, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-mono)', marginBottom: 12 }}>// ANTHROPIC</div>
        <input
          type="password"
          value={anthropicKey}
          onChange={e => { setAnthropicKey(e.target.value); setAnthropicSaved(false) }}
          placeholder="sk-ant-..."
          style={inputStyle}
          onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
          onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
        />
        <div style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 1, fontFamily: 'var(--font-mono)', marginTop: 6 }}>
          used by // PROJECTS agent — console.anthropic.com
        </div>
        <SaveRow canSave={!!anthropicKey.trim()} saved={anthropicSaved} onSave={() => void saveAnthropicKey()} />
      </div>

      <div>
        <div style={{ fontSize: 8, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-mono)', marginBottom: 12 }}>// PUSHBULLET</div>
        <input
          type="password"
          value={pbKey}
          onChange={e => { setPbKey(e.target.value); setPbSaved(false) }}
          placeholder="API key..."
          style={inputStyle}
          onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
          onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
        />
        <div style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 1, fontFamily: 'var(--font-mono)', marginTop: 6 }}>
          get your key at pushbullet.com/account
        </div>
        <SaveRow canSave={!!pbKey.trim()} saved={pbSaved} onSave={() => void savePbKey()} />
      </div>

    </div>
  )
}

// ─── System panel ────────────────────────────────────────────────────────────
const DEFAULT_QUICK_LAUNCH: QuickLaunchApp[] = [
  { label: 'VS CODE', path: '/Applications/Visual Studio Code.app' },
  { label: 'BRAVE',   path: '/Applications/Brave Browser.app' },
]

function SystemPanel({ category, onVaultSaved, onQuickLaunchSaved }: {
  category: string
  onVaultSaved?: () => void
  onQuickLaunchSaved?: (apps: QuickLaunchApp[]) => void
}) {
  const [brightness, setBrightness] = useState(85)
  const [textMode,   setTextMode]   = useState<'dim' | 'mid' | 'bright'>('mid')
  const [fontSize,   setFontSize]   = useState<'S' | 'M' | 'L'>('S')
  const [vaultPath, setVaultPath]   = useState<string | null>(null)
  const [vaultInput, setVaultInput] = useState('')
  const [vaultSaved, setVaultSaved] = useState(false)
  const [quickApps,  setQuickApps]  = useState<QuickLaunchApp[]>(DEFAULT_QUICK_LAUNCH)
  const [quickOrig,  setQuickOrig]  = useState<QuickLaunchApp[]>(DEFAULT_QUICK_LAUNCH)
  const [quickError, setQuickError] = useState(false)
  const [quickSaved, setQuickSaved] = useState(false)

  useEffect(() => {
    async function init() {
      const b = await window.electronAPI?.settingsAPI?.get('brightness')
      if (typeof b === 'number') setBrightness(b)
      const m = await window.electronAPI?.settingsAPI?.get('textMode')
      if (m === 'dim' || m === 'mid' || m === 'bright') setTextMode(m)
      const f = await window.electronAPI?.settingsAPI?.get('fontSize')
      if (f === 'S' || f === 'M' || f === 'L') { setFontSize(f); applyFontSize(f) }
      const vp = await window.electronAPI?.vaultAPI?.getPath()
      if (vp) { setVaultPath(vp); setVaultInput(vp) }
      const ql = await window.electronAPI?.settingsAPI?.get('quickLaunch')
      if (Array.isArray(ql) && ql.length > 0) { setQuickApps(ql as QuickLaunchApp[]); setQuickOrig(ql as QuickLaunchApp[]) }
    }
    void init()
  }, [])

  function applyBrightness(val: number) {
    setBrightness(val)
    const root = document.getElementById('root')
    if (root) root.style.filter = `brightness(${val / 100})`
    void window.electronAPI?.settingsAPI?.set('brightness', val)
  }

  const TEXT_MODES = {
    dim:    { '--text': '#7ab3d4', '--dim': '#3d7a99', '--dimmer': '#1f4d66' },
    mid:    { '--text': '#a8d4ee', '--dim': '#6aadcc', '--dimmer': '#3d7a99' },
    bright: { '--text': '#d4eeff', '--dim': '#99d4ee', '--dimmer': '#6aadcc' },
  } as const

  function applyTextMode(mode: 'dim' | 'mid' | 'bright') {
    setTextMode(mode)
    const vars = TEXT_MODES[mode]
    document.documentElement.style.setProperty('--text',   vars['--text'])
    document.documentElement.style.setProperty('--dim',    vars['--dim'])
    document.documentElement.style.setProperty('--dimmer', vars['--dimmer'])
    void window.electronAPI?.settingsAPI?.set('textMode', mode)
  }

  function stub(label: string, extra?: React.ReactNode) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ fontSize: 28, color: 'var(--dimmer)' }}>⚙</div>
        <div style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: 4, fontFamily: 'var(--font-mono)' }}>{label}</div>
        {extra ?? <div style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 2, fontFamily: 'var(--font-mono)', marginTop: 8 }}>— COMING SOON —</div>}
      </div>
    )
  }

  function renderContent() {
    if (category === 'display') return (
      <div style={{ padding: 20, zIndex: 1, display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{ fontSize: 8, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-mono)' }}>// BRIGHTNESS</div>
            <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>{brightness}%</span>
          </div>
          <input
            type="range" min={40} max={100} step={1}
            value={brightness}
            onChange={e => applyBrightness(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)', display: 'block' }}
          />
        </div>
        <div>
          <div style={{ fontSize: 8, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-mono)', marginBottom: 12 }}>// TEXT MODE</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['dim', 'mid', 'bright'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => applyTextMode(mode)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: 2,
                  background: 'transparent',
                  border: `1px solid ${textMode === mode ? 'var(--accent)' : 'var(--border-md)'}`,
                  color: textMode === mode ? 'var(--accent)' : 'var(--dimmer)',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 8, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-mono)', marginBottom: 12 }}>// FONT SIZE</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['S', 'M', 'L'] as const).map(s => (
              <button
                key={s}
                onClick={() => {
                  setFontSize(s)
                  applyFontSize(s)
                  void window.electronAPI?.settingsAPI?.set('fontSize', s)
                }}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: 2,
                  background: 'transparent',
                  border: `1px solid ${fontSize === s ? 'var(--accent)' : 'var(--border-md)'}`,
                  color: fontSize === s ? 'var(--accent)' : 'var(--dimmer)',
                  cursor: 'pointer',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
    if (category === 'connections') return <ConnectionsPanel />
    if (category === 'quicklaunch') {
      const atMax = quickApps.length >= 6
      const rowInputStyle: React.CSSProperties = {
        background: 'var(--bg)', border: 'none', borderBottom: '1px solid var(--border-md)',
        color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 11,
        padding: '6px 0', outline: 'none',
      }
      return (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, zIndex: 1, overflowY: 'auto', flex: 1 }}>
          <div>
            {quickApps.map((app, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <input
                  value={app.label}
                  placeholder="LABEL"
                  onChange={e => {
                    const updated = [...quickApps]
                    updated[i] = { ...updated[i], label: e.target.value.toUpperCase() }
                    setQuickApps(updated); setQuickError(false)
                  }}
                  style={{ ...rowInputStyle, width: 100, flexShrink: 0 }}
                  onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
                  onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
                />
                <input
                  value={app.path}
                  placeholder="/Applications/App.app"
                  onChange={e => {
                    const updated = [...quickApps]
                    updated[i] = { ...updated[i], path: e.target.value }
                    setQuickApps(updated); setQuickError(false)
                  }}
                  style={{ ...rowInputStyle, flex: 1 }}
                  onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
                  onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
                />
                <button
                  onClick={() => { setQuickApps(quickApps.filter((_, j) => j !== i)); setQuickError(false) }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ff4444'; e.currentTarget.style.borderColor = '#ff4444' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#ff444466'; e.currentTarget.style.borderColor = '#ff444422' }}
                  style={{ padding: '3px 8px', fontSize: 8, letterSpacing: 1, border: '1px solid #ff444422', color: '#ff444466', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', flexShrink: 0, transition: 'all 0.15s ease' }}
                >
                  [ REMOVE ]
                </button>
              </div>
            ))}
          </div>
          {atMax
            ? <div style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>// MAX 6 APPS</div>
            : <button
                onClick={() => setQuickApps([...quickApps, { label: '', path: '' }])}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.color = 'var(--dimmer)' }}
                style={{ width: '100%', padding: 8, fontSize: 9, letterSpacing: 2, border: '1px solid var(--border-md)', color: 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
              >
                [ + ADD APP ]
              </button>
          }
          {quickError && <div style={{ fontSize: 9, color: '#ff4444', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>// ALL FIELDS REQUIRED</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
            {quickSaved && <span style={{ fontSize: 9, color: 'var(--accent2)', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>// SAVED ✓</span>}
            <button
              onClick={() => { setQuickApps(quickOrig); setQuickError(false); setQuickSaved(false) }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dimmer)'; e.currentTarget.style.color = 'var(--dimmer)' }}
              style={{ padding: '6px 16px', fontSize: 9, letterSpacing: 2, border: '1px solid var(--dimmer)', color: 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
            >
              [ CANCEL ]
            </button>
            <button
              onClick={async () => {
                if (quickApps.some(a => !a.label.trim() || !a.path.trim())) { setQuickError(true); return }
                await window.electronAPI?.settingsAPI?.set('quickLaunch', quickApps)
                setQuickOrig(quickApps)
                setQuickSaved(true)
                onQuickLaunchSaved?.(quickApps)
                setTimeout(() => setQuickSaved(false), 2000)
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              style={{ padding: '6px 16px', fontSize: 9, letterSpacing: 2, border: '1px solid var(--accent)', color: 'var(--accent)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
            >
              [ SAVE ]
            </button>
          </div>
        </div>
      )
    }
    if (category === 'vault') return (
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, zIndex: 1 }}>
        <div>
          <div style={{ fontSize: 8, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-mono)', marginBottom: 6 }}>// CURRENT PATH</div>
          <input
            value={vaultInput}
            onChange={e => { setVaultInput(e.target.value); setVaultSaved(false) }}
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: 'none', borderBottom: '1px solid var(--border-md)', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '6px 0', outline: 'none' }}
            onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
            onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
          />
          <div style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 1, fontFamily: 'var(--font-mono)', marginTop: 6 }}>absolute path to your vault folder</div>
        </div>
        <button
          onClick={async () => {
            const result = await window.electronAPI?.vaultAPI?.choosePath()
            if (result) { setVaultInput(result.path); setVaultPath(result.path); setVaultSaved(false) }
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.color = 'var(--dimmer)' }}
          style={{ alignSelf: 'flex-start', padding: '6px 14px', fontSize: 9, letterSpacing: 2, border: '1px solid var(--border-md)', color: 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
        >
          [ CHOOSE FOLDER ]
        </button>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
          {vaultSaved && <span style={{ fontSize: 9, color: 'var(--accent2)', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>// SAVED ✓</span>}
          <button
            onClick={() => { setVaultInput(vaultPath ?? ''); setVaultSaved(false) }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dimmer)'; e.currentTarget.style.color = 'var(--dimmer)' }}
            style={{ padding: '6px 16px', fontSize: 9, letterSpacing: 2, border: '1px solid var(--dimmer)', color: 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
          >
            [ CANCEL ]
          </button>
          <button
            onClick={async () => {
              const trimmed = vaultInput.trim()
              if (!trimmed) return
              await window.electronAPI?.settingsAPI?.set('vaultPath', trimmed)
              setVaultPath(trimmed)
              setVaultSaved(true)
              onVaultSaved?.()
              setTimeout(() => setVaultSaved(false), 2000)
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            style={{ padding: '6px 16px', fontSize: 9, letterSpacing: 2, border: '1px solid var(--accent)', color: 'var(--accent)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
          >
            [ SAVE ]
          </button>
        </div>
      </div>
    )
    if (category === 'about')       return stub('// ABOUT',
      <div style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>v0.1.0 // ALPHA</div>
    )
    return stub('// SETTINGS')
  }

  const catLabel = SYSTEM_CATEGORIES.find(c => c.id === category)?.label ?? category.toUpperCase()

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden', animation: 'slide-in 0.2s ease both', position: 'relative' }}>
      <GridBg />
      <div style={{ height: 44, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 20px', flexShrink: 0, zIndex: 1 }}>
        <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 12, color: 'var(--accent2)', letterSpacing: 1 }}>
          -- {catLabel}
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', zIndex: 1, overflow: 'hidden' }}>
        {renderContent()}
      </div>
    </div>
  )
}

// ─── Stat cards ───────────────────────────────────────────────────────────────
type CardKey  = 'vercel' | 'supabase' | 'github'
type LogEntry = { time: string; message: string; type: 'info' | 'success' | 'error' | 'action' }

const CARD_FIELDS: Record<CardKey, Array<{ key: string; label: string; type: 'text' | 'password' }>> = {
  vercel:   [{ key: 'projectId', label: 'PROJECT ID', type: 'text' }, { key: 'teamId', label: 'TEAM ID (optional)', type: 'text' }, { key: 'token', label: 'API TOKEN', type: 'password' }],
  supabase: [{ key: 'url',       label: 'PROJECT URL', type: 'text'     }, { key: 'anonKey', label: 'ANON KEY',    type: 'password' }],
  github:   [{ key: 'repoPath',  label: 'REPO PATH',   type: 'text'     }, { key: 'token',   label: 'TOKEN',       type: 'password' }],
}

function cardDisplayValue(id: CardKey, cfg: Record<string, string>): string {
  if (id === 'vercel')   return cfg.projectId ?? '—'
  if (id === 'supabase') return cfg.url        ?? '—'
  return cfg.repoPath ?? '—'
}


function StatCard({ id, label, borderRight, isEditing, config, draft, liveData, onEdit, onCancel, onSave, onDraftChange, onLogs, logsActive }: {
  id: CardKey; label: string; borderRight: boolean
  isEditing: boolean; config: Record<string, string> | null; draft: Record<string, string>
  liveData?: React.ReactNode
  onEdit: () => void; onCancel: () => void; onSave: () => void
  onDraftChange: (key: string, val: string) => void
  onLogs?: () => void; logsActive?: boolean
}) {
  const fields = CARD_FIELDS[id]
  return (
    <div style={{ padding: '12px 16px 32px 16px', borderRight: borderRight ? '1px solid var(--border)' : 'none', background: 'var(--bg-panel)', display: 'flex', flexDirection: 'column', gap: 4, position: 'relative', minHeight: 86 }}>
      <div style={{ fontSize: 8, color: 'var(--dim)', letterSpacing: 3, marginBottom: 2 }}>{label}</div>

      {isEditing ? (
        <>
          {fields.map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 7, color: 'var(--dimmer)', letterSpacing: 1, marginBottom: 2 }}>{f.label}</div>
              <input
                type={f.type} value={draft[f.key] ?? ''}
                onChange={e => onDraftChange(f.key, e.target.value)}
                onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
                onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: 'none', borderBottom: '1px solid var(--border-md)', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 0', outline: 'none' }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
            <button onClick={onCancel}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--dim)'; e.currentTarget.style.color = 'var(--dim)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dimmer)'; e.currentTarget.style.color = 'var(--dimmer)' }}
              style={{ padding: '3px 8px', fontSize: 8, letterSpacing: 2, border: '1px solid var(--dimmer)', color: 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
              [ CANCEL ]
            </button>
            <button onClick={onSave}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              style={{ padding: '3px 8px', fontSize: 8, letterSpacing: 2, border: '1px solid var(--accent)', color: 'var(--accent)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
              [ SAVE ]
            </button>
          </div>
        </>
      ) : (
        <>
          {config ? (
            liveData ?? (
              <>
                <div style={{ fontSize: 9, color: 'var(--dim)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cardDisplayValue(id, config)}</div>
                <div style={{ fontSize: 8, color: 'var(--accent2)', letterSpacing: 1 }}>CONFIGURED ✓</div>
              </>
            )
          ) : (
            <>
              <div style={{ fontSize: 20, color: 'var(--accent)', fontFamily: 'var(--font-head)', fontWeight: 700, lineHeight: 1 }}>—</div>
              <div style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 1 }}>not connected</div>
            </>
          )}
          {onLogs && config && (
            <button onClick={onLogs}
              onMouseEnter={e => { if (!logsActive) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' } }}
              onMouseLeave={e => { if (!logsActive) { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.color = 'var(--dimmer)' } }}
              style={{ position: 'absolute', bottom: 10, left: 12, padding: '3px 8px', fontSize: 8, letterSpacing: 2, border: `1px solid ${logsActive ? 'var(--accent2)' : 'var(--border-md)'}`, color: logsActive ? 'var(--accent2)' : 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}>
              [ LOGS ]
            </button>
          )}
          <button onClick={onEdit}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.color = 'var(--dimmer)' }}
            style={{ position: 'absolute', bottom: 10, right: 12, padding: '3px 8px', fontSize: 8, letterSpacing: 2, border: '1px solid var(--border-md)', color: 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}>
            [ EDIT ]
          </button>
        </>
      )}
    </div>
  )
}

// ─── Right detail panel ───────────────────────────────────────────────────────
function DetailPanel({ projectId, projects, onRemove, onUpdate }: { projectId: string | null; projects: Project[]; onRemove: (id: string) => void; onUpdate: (project: Project) => void }) {
  const [mode, setMode]                 = useState<'bug' | 'task' | 'general'>('task')
  const [input, setInput]               = useState('')
  const [generating, setGenerating]     = useState(false)
  const [output, setOutput]             = useState<string | null>(null)
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  const [editingCard, setEditingCard]   = useState<CardKey | null>(null)
  const [cardConfigs, setCardConfigs]   = useState<Record<CardKey, Record<string, string> | null>>({ vercel: null, supabase: null, github: null })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [cardDraft, setCardDraft]       = useState<Record<string, string>>({})
  const [logs, setLogs]                 = useState<LogEntry[]>([])
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [detailView, setDetailView]     = useState<'overview' | 'archmap'>('overview')
  const logsEndRef                      = useRef<HTMLDivElement>(null)

  type VercelData   = { state: string; createdAt: number; meta: { githubCommitMessage: string; githubCommitRef: string } }
  type GithubData   = { lastCommit: { message: string; author: string; timestamp: number; branch: string }; openIssues: number }
  type SupabaseData = { healthy: boolean; checkedAt: number; errorMessage?: string }
  type VercelLog    = { timestamp: number; level: string; message: string; source: string; requestPath?: string; responseStatusCode?: number }
  type GithubCommit = { sha: string; message: string; author: string; timestamp: number; url: string }

  const [vercelData,   setVercelData]   = useState<VercelData  | null | 'loading' | { error: string }>(null)
  const [githubData,   setGithubData]   = useState<GithubData  | null | 'loading' | 'error'>(null)
  const [supabaseData, setSupabaseData] = useState<SupabaseData | null | 'loading' | 'error'>(null)

  const [logsSource,    setLogsSource]   = useState<'vercel' | 'github' | null>(null)
  const [vercelLogs,    setVercelLogs]   = useState<VercelLog[]    | null | 'loading' | { error: string }>(null)
  const [githubCommits, setGithubCommits] = useState<GithubCommit[] | null | 'loading' | { error: string }>(null)

  useEffect(() => {
    setMode('task')
    setInput('')
    setGenerating(false)
    setOutput(null)
    setActionStatus(null)
    setEditingCard(null)
    setCardDraft({})
    setConfirmRemove(false)
    setSettingsOpen(false)
    setLogsSource(null)
    setVercelLogs(null)
    setGithubCommits(null)
    setDetailView('overview')
  }, [projectId])

  useEffect(() => {
    async function loadCards() {
      const api = window.electronAPI?.settingsAPI
      if (!api || !projectId) { setCardConfigs({ vercel: null, supabase: null, github: null }); return }
      const [v, s, g] = await Promise.all([
        api.get(`project.${projectId}.vercel`),
        api.get(`project.${projectId}.supabase`),
        api.get(`project.${projectId}.github`),
      ])
      setCardConfigs({
        vercel:   (v as Record<string, string> | null) ?? null,
        supabase: (s as Record<string, string> | null) ?? null,
        github:   (g as Record<string, string> | null) ?? null,
      })
    }
    void loadCards()
  }, [projectId])

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])

  useEffect(() => {
    setVercelData(null)
    const cfg = cardConfigs.vercel as Record<string, string> | null
    if (!cfg?.projectId || !cfg?.token) return

    async function fetchVercel() {
      setVercelData('loading')
      const res = await window.electronAPI?.vercelAPI?.getStatus(cfg!.projectId, cfg!.teamId || undefined, cfg!.token)
      if (!res || res.error) { setVercelData({ error: (res?.error as string | undefined) ?? 'fetch failed' }); return }
      setVercelData(res as VercelData)
    }

    void fetchVercel()
    const id = setInterval(() => void fetchVercel(), 60_000)
    return () => clearInterval(id)
  }, [projectId, cardConfigs.vercel])

  useEffect(() => {
    setGithubData(null)
    const cfg = cardConfigs.github as Record<string, string> | null
    if (!cfg?.repoPath || !cfg?.token) return

    async function fetchGithub() {
      setGithubData('loading')
      const res = await window.electronAPI?.githubAPI?.getStatus(cfg!.repoPath, cfg!.token)
      if (!res || res.error) { setGithubData('error'); return }
      setGithubData(res as GithubData)
    }

    void fetchGithub()
    const id = setInterval(() => void fetchGithub(), 60_000)
    return () => clearInterval(id)
  }, [projectId, cardConfigs.github])

  useEffect(() => {
    setSupabaseData(null)
    const cfg = cardConfigs.supabase as Record<string, string> | null
    if (!cfg?.url || !cfg?.anonKey) return

    async function fetchSupabase() {
      setSupabaseData('loading')
      const res = await window.electronAPI?.supabaseAPI?.getStatus(cfg!.url, cfg!.anonKey)
      if (!res) { setSupabaseData('error'); return }
      setSupabaseData({ healthy: res.healthy ?? false, checkedAt: Date.now(), errorMessage: (res as { errorMessage?: string }).errorMessage })
    }

    void fetchSupabase()
    const id = setInterval(() => void fetchSupabase(), 120_000)
    return () => clearInterval(id)
  }, [projectId, cardConfigs.supabase])

  const project = projects.find(p => p.id === projectId)

  async function fetchVercelLogs() {
    const cfg = cardConfigs.vercel as Record<string, string> | null
    if (!cfg?.projectId || !cfg?.token) return
    setLogsSource('vercel')
    setVercelLogs('loading')
    const res = await window.electronAPI?.vercelAPI?.getLogs(cfg.projectId, cfg.teamId || undefined, cfg.token)
    if (!res || res.error) { setVercelLogs({ error: (res?.error as string | undefined) ?? 'fetch failed' }); return }
    setVercelLogs(res.logs ?? [])
  }

  async function fetchGithubCommits() {
    const cfg = cardConfigs.github as Record<string, string> | null
    if (!cfg?.repoPath || !cfg?.token) return
    setLogsSource('github')
    setGithubCommits('loading')
    const res = await window.electronAPI?.githubAPI?.getCommits(cfg.repoPath, cfg.token)
    if (!res || res.error) { setGithubCommits({ error: (res?.error as string | undefined) ?? 'fetch failed' }); return }
    setGithubCommits(res.commits ?? [])
  }

  function addLog(message: string, type: LogEntry['type']) {
    const t = new Date()
    const time = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
    setLogs(prev => [...prev, { time, message, type }])
  }

  async function handleGenerate() {
    if (!project || !input.trim()) return
    setGenerating(true)
    setOutput(null)
    setActionStatus(null)

    try {
      const claudeRes = await window.electronAPI?.projectAPI.readFile(project.repoPath, project.claudeMd)
      const projectContext = claudeRes && 'content' in claudeRes
        ? claudeRes.content
        : `You are a project assistant for ${project.label}. Stack: refer to project conventions.`

      const modeInstructions: Record<typeof mode, string> = {
        bug: `The user will describe a bug. Respond with ONLY a formatted BUGS.md entry matching this exact style:\n\n- [ ] [short bug title]\n      - Trigger: [when it happens]\n      - Expected: [what should happen]\n      - Actual: [what actually happens]\n      - Suspected cause: [if inferable]\n      - Fix: [suggested fix if clear]\n      - Test: [how to verify fix]\n\nNo preamble, no explanation. Only the entry block.`,
        task: `The user will describe a feature or task. Respond with ONLY a formatted TASKS.md entry matching this exact style:\n\n- [ ] [short task title]\n      - [implementation detail line 1]\n      - [implementation detail line 2]\n      - [etc — as many as needed]\n      - Be specific to the project stack and conventions described in the system prompt above\n\nNo preamble, no explanation. Only the entry block.`,
        general: `Answer the user's question about this project concisely and in plain text. You may reference the project context above.`,
      }

      const storedKey = await window.electronAPI?.settingsAPI?.get('anthropic.apiKey') as string | undefined
      const apiKey = (storedKey && storedKey !== 'your-api-key-here')
        ? storedKey
        : (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined)
      if (!apiKey || apiKey === 'your-api-key-here') throw new Error('Add your Anthropic API key in // SYSTEM > CONNECTIONS')

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: projectContext + '\n\n' + modeInstructions[mode],
          messages: [{ role: 'user', content: input }],
        }),
      })

      if (!res.ok) {
        const err = await res.json() as { error?: { message?: string } }
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
      }

      const data = await res.json() as { content?: Array<{ text?: string }> }
      setOutput(data?.content?.[0]?.text ?? '// NO RESPONSE')
      addLog(`generated ${mode} entry for ${project.label}`, 'action')
    } catch (err) {
      const msg = (err as Error).message
      setOutput(`// ERROR — ${msg}`)
      addLog(`generate failed — ${msg}`, 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleAppend() {
    if (!project || output === null) return
    const filename = mode === 'bug' ? project.bugsFile : project.tasksFile
    const result = await window.electronAPI?.projectAPI.appendEntry(project.repoPath, filename, output)
    if (result?.success) {
      setActionStatus('// APPENDED TO FILE ✓')
      addLog(`appended to ${filename}`, 'success')
    } else {
      const err = result?.error ?? 'unknown error'
      setActionStatus(`// FAILED — ${err}`)
      addLog(`failed to append to ${filename}`, 'error')
    }
  }

  async function handlePush() {
    if (!project || output === null) return
    const filename = mode === 'bug' ? project.bugsFile : project.tasksFile
    const kind = mode === 'bug' ? 'bug' : 'task'
    const appendResult = await window.electronAPI?.projectAPI.appendEntry(project.repoPath, filename, output)
    if (!appendResult?.success) {
      const err = appendResult?.error ?? 'unknown'
      setActionStatus(`// FAILED — ${err}`)
      addLog(`failed to append to ${filename}`, 'error')
      return
    }
    const pushResult = await window.electronAPI?.projectAPI.gitPush(
      project.repoPath, filename, `chore: add ${kind} entry via Command Center`
    )
    if (pushResult?.success) {
      setActionStatus('// APPENDED + PUSHED ✓')
      addLog(`pushed ${filename} to github`, 'success')
    } else {
      const err = pushResult?.error ?? 'push failed'
      setActionStatus(`// FAILED — ${err}`)
      addLog(`git push failed — ${err}`, 'error')
    }
  }

  if (project && settingsOpen) return (
    <EditProjectForm
      project={project}
      onSaved={updated => { onUpdate(updated); setSettingsOpen(false) }}
      onCancel={() => setSettingsOpen(false)}
    />
  )

  if (!project) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      <GridBg />
      <div style={{ zIndex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: 36, color: 'var(--dimmer)', marginBottom: 16 }}>◈</div>
        <div style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: 4 }}>SELECT A PROJECT</div>
        <div style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 2, marginTop: 8 }}>— OR SECTION FROM THE SIDEBAR —</div>
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', animation: 'slide-in 0.2s ease both', overflow: 'hidden', position: 'relative' }}>
      <GridBg />
      <div style={{ height: 44, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0, zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--accent2)', fontFamily: 'var(--font-head)', fontWeight: 700, letterSpacing: 1 }}>{project.label.toUpperCase()}</span>
          <span style={{ fontSize: 8, color: project.statusColor, letterSpacing: 2, padding: '2px 6px', border: `1px solid ${project.statusColor}55` }}>{project.status}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {confirmRemove ? (
            <>
              <span style={{ fontSize: 8, color: '#ff4444', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>// REMOVE PROJECT?</span>
              <button
                onClick={() => { onRemove(project.id); setConfirmRemove(false) }}
                onMouseEnter={e => { e.currentTarget.style.background = '#ff444422' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                style={{ fontSize: 8, letterSpacing: 2, border: '1px solid #ff4444', color: '#ff4444', padding: '3px 8px', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
              >[ CONFIRM ]</button>
              <button
                onClick={() => setConfirmRemove(false)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--dim)'; e.currentTarget.style.color = 'var(--dim)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dimmer)'; e.currentTarget.style.color = 'var(--dimmer)' }}
                style={{ fontSize: 8, letterSpacing: 2, border: '1px solid var(--dimmer)', color: 'var(--dimmer)', padding: '3px 8px', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
              >[ ABORT ]</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 1 }}>{project.vercelProject ?? '—'}</span>
              <button
                onClick={() => void window.electronAPI?.openInVSCode(project.repoPath)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.color = 'var(--dimmer)' }}
                style={{ fontSize: 8, letterSpacing: 2, border: '1px solid var(--border-md)', color: 'var(--dimmer)', padding: '4px 10px', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
              >OPEN IN VSCODE</button>
              <button
                onClick={() => setSettingsOpen(true)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.color = 'var(--dimmer)' }}
                style={{ fontSize: 8, letterSpacing: 2, border: '1px solid var(--border-md)', color: 'var(--dimmer)', padding: '4px 10px', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
              >[ SETTINGS ]</button>
              <button
                onClick={() => setConfirmRemove(true)}
                onMouseEnter={e => { e.currentTarget.style.color = '#ff4444'; e.currentTarget.style.borderColor = '#ff4444' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#ff444466'; e.currentTarget.style.borderColor = '#ff444433' }}
                style={{ fontSize: 8, letterSpacing: 2, border: '1px solid #ff444433', color: '#ff444466', padding: '3px 8px', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
              >[ REMOVE ]</button>
            </>
          )}
        </div>
      </div>

      {/* Tab row */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, zIndex: 1 }}>
        {(['overview', 'archmap'] as const).map(v => (
          <button key={v} onClick={() => setDetailView(v)}
            style={{ padding: '7px 16px', fontSize: 8, letterSpacing: 3, border: 'none', borderBottom: `2px solid ${detailView === v ? 'var(--accent)' : 'transparent'}`, color: detailView === v ? 'var(--accent)' : 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}>
            // {v === 'overview' ? 'OVERVIEW' : 'ARCH MAP'}
          </button>
        ))}
      </div>

      {detailView === 'overview' && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid var(--border)', flexShrink: 0, zIndex: 1 }}>
        {(['vercel', 'supabase', 'github'] as CardKey[]).map((id, i) => (
          <StatCard
            key={id} id={id} borderRight={i < 2}
            label={id === 'vercel' ? 'VERCEL' : id === 'supabase' ? 'SUPABASE' : 'GITHUB'}
            isEditing={editingCard === id}
            config={cardConfigs[id]}
            draft={cardDraft}
            liveData={id === 'vercel' ? (
              vercelData === 'loading' ? (
                <div style={{ fontSize: 9, color: 'var(--dimmer)', fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>// FETCHING...</div>
              ) : vercelData && 'error' in vercelData ? (
                <div style={{ fontSize: 9, color: '#ff4444', fontFamily: 'var(--font-mono)', letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>// {vercelData.error}</div>
              ) : vercelData ? (() => {
                const vd = vercelData as VercelData
                const STATE_STYLE: Record<string, { label: string; color: string }> = {
                  READY:    { label: 'READY ✓',   color: 'var(--accent2)' },
                  BUILDING: { label: 'BUILDING',   color: '#ffc200' },
                  ERROR:    { label: 'FAILED ✗',   color: '#ff4444' },
                }
                const s = STATE_STYLE[vd.state] ?? { label: vd.state, color: 'var(--dim)' }
                const branch  = vd.meta.githubCommitRef
                const message = vd.meta.githubCommitMessage
                const summary = [branch, message].filter(Boolean).join(' — ')
                return (
                  <>
                    <div style={{ fontSize: 10, color: s.color, fontFamily: 'var(--font-mono)', letterSpacing: 1, fontWeight: 700 }}>{s.label}</div>
                    <div style={{ fontSize: 9, color: 'var(--dim)', fontFamily: 'var(--font-mono)' }}>deployed {relTimeShort(vd.createdAt)}</div>
                    <div style={{ fontSize: 8, color: 'var(--dimmer)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary || '—'}</div>
                  </>
                )
              })() : undefined
            ) : id === 'github' ? (
              githubData === 'loading' ? (
                <div style={{ fontSize: 9, color: 'var(--dimmer)', fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>// FETCHING...</div>
              ) : githubData === 'error' ? (
                <div style={{ fontSize: 9, color: '#ff4444', fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>// API ERROR</div>
              ) : githubData ? (() => {
                const { lastCommit, openIssues } = githubData
                const issueColor  = openIssues > 0 ? '#ffc200' : 'var(--dimmer)'
                const issueLabel  = openIssues === 0 ? 'no open issues' : `${openIssues} open issue${openIssues === 1 ? '' : 's'}`
                return (
                  <>
                    <div style={{ fontSize: 9, color: 'var(--text)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastCommit.message}</div>
                    <div style={{ fontSize: 9, color: 'var(--dim)', fontFamily: 'var(--font-mono)' }}>{lastCommit.author} · {relTimeShort(lastCommit.timestamp)}</div>
                    <div style={{ fontSize: 8, color: issueColor, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastCommit.branch} · {issueLabel}</div>
                  </>
                )
              })() : undefined
            ) : id === 'supabase' ? (
              supabaseData === 'loading' ? (
                <div style={{ fontSize: 9, color: 'var(--dimmer)', fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>// FETCHING...</div>
              ) : supabaseData === 'error' ? (
                <div style={{ fontSize: 9, color: '#ff4444', fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>// API ERROR</div>
              ) : supabaseData ? (() => {
                const cfg = cardConfigs.supabase as Record<string, string> | null
                const url = cfg?.url ?? ''
                const shortUrl = url.replace(/^https?:\/\//, '').replace(/\.supabase\.co.*/, '.supabase.co')
                const t = new Date(supabaseData.checkedAt)
                const checked = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`
                return (
                  <>
                    <div style={{ fontSize: 10, color: supabaseData.healthy ? 'var(--accent2)' : '#ff4444', fontFamily: 'var(--font-mono)', letterSpacing: 1, fontWeight: 700 }}>{supabaseData.healthy ? 'CONNECTED ✓' : 'OFFLINE ✗'}</div>
                    <div style={{ fontSize: 8, color: 'var(--dimmer)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortUrl || '—'}</div>
                    {supabaseData.healthy
                      ? <div style={{ fontSize: 8, color: 'var(--dimmer)', fontFamily: 'var(--font-mono)' }}>// last checked {checked}</div>
                      : <div style={{ fontSize: 8, color: '#ff444488', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{supabaseData.errorMessage ?? 'fetch failed'}</div>
                    }
                  </>
                )
              })() : undefined
            ) : undefined}
            onEdit={() => {
              const cfg = cardConfigs[id] ?? {}
              const defaults: Record<string, string> = {}
              CARD_FIELDS[id].forEach(f => { defaults[f.key] = (cfg as Record<string, string>)[f.key] ?? (id === 'github' && f.key === 'repoPath' ? project.repoPath : '') })
              setCardDraft(defaults)
              setEditingCard(id)
            }}
            onCancel={() => setEditingCard(null)}
            onSave={async () => {
              await window.electronAPI?.settingsAPI?.set(`project.${project.id}.${id}`, cardDraft)
              setCardConfigs(prev => ({ ...prev, [id]: { ...cardDraft } }))
              setEditingCard(null)
            }}
            onDraftChange={(key, val) => setCardDraft(prev => ({ ...prev, [key]: val }))}
            onLogs={id === 'vercel' ? () => void fetchVercelLogs() : id === 'github' ? () => void fetchGithubCommits() : undefined}
            logsActive={id === 'vercel' ? logsSource === 'vercel' : id === 'github' ? logsSource === 'github' : undefined}
          />
        ))}
      </div>

      {/* Zone 3 — Agent (55%) + Logs (45%) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', zIndex: 1 }}>

        {/* Left — Agent */}
        <div style={{ width: '55%', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 9, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
            // PROJECT AGENT — {project.label.toUpperCase()}
          </div>

          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
            {(['task', 'bug', 'general'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setOutput(null); setActionStatus(null) }}
                style={{ padding: '5px 12px', fontSize: 9, letterSpacing: 2, border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--border-md)'}`, color: mode === m ? 'var(--accent)' : 'var(--dim)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}>
                [ {m === 'bug' ? 'BUG ENTRY' : m === 'task' ? 'TASK ENTRY' : 'GENERAL'} ]
              </button>
            ))}
          </div>

          <textarea value={input} onChange={e => setInput(e.target.value)}
            placeholder="describe the bug or task..." disabled={generating}
            style={{ flex: 1, minHeight: 60, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', background: 'var(--bg-panel)', border: 'none', borderBottom: '1px solid var(--border)', padding: '12px 16px', resize: 'none', outline: 'none', opacity: generating ? 0.5 : 1 }}
          />

          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
            <button onClick={() => void handleGenerate()} disabled={generating || !input.trim()}
              style={{ padding: '6px 16px', fontSize: 9, letterSpacing: 2, border: `1px solid ${generating || !input.trim() ? 'var(--border-md)' : 'var(--accent)'}`, color: generating || !input.trim() ? 'var(--dim)' : 'var(--accent)', background: 'transparent', cursor: generating || !input.trim() ? 'default' : 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}>
              {generating ? <span>// GENERATING<span style={{ animation: 'blink 1s infinite' }}>█</span></span> : '[ GENERATE ]'}
            </button>
          </div>

          {output !== null && (
            <>
              <div style={{ maxHeight: 160, overflow: 'auto', flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent2)', background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '12px 16px', whiteSpace: 'pre-wrap' }}>
                {output}
              </div>
              {mode !== 'general' && (
                <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => void handleAppend()}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.color = 'var(--dim)' }}
                      style={{ padding: '5px 12px', fontSize: 9, letterSpacing: 2, border: '1px solid var(--border-md)', color: 'var(--dim)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}>
                      [ APPEND TO {mode === 'bug' ? 'BUGS' : 'TASKS'}.md ]
                    </button>
                    <button onClick={() => void handlePush()}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      style={{ padding: '5px 12px', fontSize: 9, letterSpacing: 2, border: '1px solid var(--accent2)', color: 'var(--accent2)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}>
                      [ PUSH TO GITHUB ]
                    </button>
                  </div>
                  {actionStatus && (
                    <div style={{ fontSize: 8, letterSpacing: 1, textAlign: 'right', fontFamily: 'var(--font-mono)', color: actionStatus.startsWith('// FAILED') ? '#ff4444' : 'var(--accent2)' }}>
                      {actionStatus}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right — Logs */}
        <div style={{ width: '45%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 8, color: 'var(--accent)', letterSpacing: 3, fontFamily: 'var(--font-head)', fontWeight: 700 }}>
              {logsSource === 'vercel' ? '// VERCEL LOGS' : logsSource === 'github' ? '// GITHUB COMMITS' : '// LOGS'}
            </span>
            {logsSource && (
              <button
                onClick={() => logsSource === 'vercel' ? void fetchVercelLogs() : void fetchGithubCommits()}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.color = 'var(--dimmer)' }}
                style={{ padding: '3px 8px', fontSize: 8, letterSpacing: 2, border: '1px solid var(--border-md)', color: 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}>
                [ REFRESH ]
              </button>
            )}
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {logsSource === null ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>// SELECT VERCEL OR GITHUB LOGS</span>
              </div>

            ) : logsSource === 'vercel' ? (
              vercelLogs === 'loading' ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>// FETCHING LOGS</span>
                  <span className="blink" style={{ color: 'var(--accent)' }}>_</span>
                </div>
              ) : vercelLogs && 'error' in vercelLogs ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span style={{ fontSize: 9, color: '#ff4444', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>// FAILED TO LOAD LOGS</span>
                  <button onClick={() => void fetchVercelLogs()}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.color = 'var(--dimmer)' }}
                    style={{ padding: '3px 10px', fontSize: 8, letterSpacing: 2, border: '1px solid var(--border-md)', color: 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                    [ RETRY ]
                  </button>
                </div>
              ) : Array.isArray(vercelLogs) ? (
                <>
                  <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', fontSize: 8, color: 'var(--dimmer)', fontFamily: 'var(--font-mono)', letterSpacing: 1, flexShrink: 0 }}>
                    // LOGS AVAILABLE FOR LAST 3 DAYS ONLY
                  </div>
                  {vercelLogs.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>// NO LOG ENTRIES</span>
                    </div>
                  ) : vercelLogs.map((entry, i) => {
                    const t = new Date(entry.timestamp)
                    const ts = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`
                    const lvlColor = entry.level === 'error' ? '#ff4444' : entry.level === 'warning' ? '#ffc200' : 'var(--dim)'
                    const lvlLabel = entry.level === 'error' ? 'ERR' : entry.level === 'warning' ? 'WRN' : 'INF'
                    return (
                      <div key={i} style={{ padding: '5px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 8, color: 'var(--dimmer)', width: 52, flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{ts}</span>
                          <span style={{ fontSize: 7, color: lvlColor, width: 24, flexShrink: 0, fontFamily: 'var(--font-mono)', paddingTop: 1 }}>{lvlLabel}</span>
                          <span style={{ fontSize: 9, color: entry.level === 'error' ? '#ff4444' : 'var(--dim)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{entry.message}</span>
                        </div>
                        {entry.requestPath && (
                          <div style={{ paddingLeft: 76, fontSize: 8, color: 'var(--dimmer)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                            {entry.requestPath}
                            {entry.responseStatusCode && (
                              <span style={{ marginLeft: 6, color: entry.responseStatusCode >= 400 ? '#ff4444' : 'var(--accent2)' }}>{entry.responseStatusCode}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              ) : null

            ) : logsSource === 'github' ? (
              githubCommits === 'loading' ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>// FETCHING LOGS</span>
                  <span className="blink" style={{ color: 'var(--accent)' }}>_</span>
                </div>
              ) : githubCommits && 'error' in githubCommits ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span style={{ fontSize: 9, color: '#ff4444', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>// FAILED TO LOAD LOGS</span>
                  <button onClick={() => void fetchGithubCommits()}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.color = 'var(--dimmer)' }}
                    style={{ padding: '3px 10px', fontSize: 8, letterSpacing: 2, border: '1px solid var(--border-md)', color: 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                    [ RETRY ]
                  </button>
                </div>
              ) : Array.isArray(githubCommits) ? (
                githubCommits.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>// NO COMMITS</span>
                  </div>
                ) : githubCommits.map((c, i) => (
                  <div key={i} style={{ padding: '5px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 8, color: 'var(--dimmer)', width: 64, flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{relTimeShort(c.timestamp)}</span>
                      <span style={{ fontSize: 8, color: 'var(--accent)', width: 52, flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{c.sha}</span>
                      <span style={{ fontSize: 9, color: 'var(--dim)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message}</span>
                    </div>
                    <div style={{ paddingLeft: 116, fontSize: 8, color: 'var(--dimmer)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{c.author}</div>
                  </div>
                ))
              ) : null
            ) : null}
          </div>
        </div>

      </div>
    </>}

    {detailView === 'archmap' && (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, position: 'relative', overflow: 'hidden', zIndex: 1 }}>
        <GridBg />
        <div style={{ zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 34, color: 'var(--dimmer)', marginBottom: 4 }}>⬡</div>
          <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-head)', fontWeight: 700, letterSpacing: 4 }}>// ARCH MAP</div>
          <div style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 2 }}>VISUAL DEPENDENCY GRAPH — COMING SOON</div>
          <div style={{ marginTop: 16, padding: '14px 20px', border: '1px solid var(--border)', background: 'var(--bg-panel)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([
              { label: 'PAGES',       color: 'var(--accent)'  },
              { label: 'COMPONENTS',  color: 'var(--accent2)' },
              { label: 'API ROUTES',  color: '#ffc200'        },
              { label: 'UTILS / LIB', color: 'var(--dim)'    },
              { label: 'EXTERNAL',    color: '#b44dff'        },
            ] as const).map(({ label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 8, color: 'var(--dim)', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>{label}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 1, maxWidth: 280, textAlign: 'center', lineHeight: 2, marginTop: 4 }}>
            // REQUIRES @fileoverview + @depends JSDOC TAGS<br />ACROSS ALL PROJECT FILES BEFORE PARSING
          </div>
        </div>
      </div>
    )}

    </div>
  )
}

// ─── Status bar ───────────────────────────────────────────────────────────────
function StatusBar({ time, vaultFileCount }: { time: string; vaultFileCount: number }) {
  return (
    <div style={{ height: 24, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', fontSize: 9, color: 'var(--dim)', background: 'var(--bg)', zIndex: 10, flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 24 }}>
        <span>◈ COMMAND CENTER: ACTIVE</span>
        <span>⬡ VAULT: {vaultFileCount} FILES</span>
        <span>▣ AGENTS: STANDBY</span>
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        <span style={{ color: 'var(--border-hi)' }}>EMBERFORGE LABS</span>
        <span>{time}</span>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [booted, setBooted]               = useState(false)
  const [bootLines, setBootLines]         = useState<string[]>([])
  const [activeSection, setSection]       = useState('node')
  const [selectedItem, setSelected]       = useState<string | null>(null)
  const [systemCategory, setSystemCategory] = useState('display')
  const [time, setTime]                   = useState('')
  const [vaultFileCount, setVaultFileCount] = useState(0)
  const [vaultTree, setVaultTree]         = useState<VaultNode[]>([])
  const [vaultLoading, setVaultLoading]   = useState(false)
  const [vaultError, setVaultError]       = useState(false)
  const [selectedGame, setSelectedGame]   = useState<string | null>(null)
  const [selectedFile, setSelectedFile]   = useState<string | null>(null)
  const [projects, setProjects]           = useState<Project[]>([])
  const [addingProject, setAddingProject] = useState(false)
  const [quickLaunchApps, setQuickLaunchApps] = useState<QuickLaunchApp[] | undefined>(undefined)

  const loadVault = useCallback(async () => {
    const api = window.electronAPI?.vaultAPI
    if (!api) return
    setVaultLoading(true)
    setVaultError(false)
    try {
      const tree = await api.readTree()
      setVaultTree(tree)
      setVaultFileCount(countVaultFiles(tree))
    } catch {
      setVaultError(true)
    } finally {
      setVaultLoading(false)
    }
  }, [])

  const handleChooseVaultPath = useCallback(async () => {
    const api = window.electronAPI?.vaultAPI
    if (!api) return
    const result = await api.choosePath()
    if (result) loadVault()
  }, [loadVault])

  useEffect(() => {
    let lineIndex = 0
    let charIndex = 0
    let currentLine = ''
    let timeoutId: ReturnType<typeof setTimeout>

    function typeNextChar() {
      const line = BOOT_LINES[lineIndex]

      if (!line) {
        timeoutId = setTimeout(() => setBooted(true), BOOT_FINISH_DELAY)
        return
      }

      if (charIndex < line.length) {
        currentLine += line[charIndex]

        setBootLines(prev => {
          const next = [...prev]
          next[lineIndex] = currentLine
          return next
        })

        charIndex++
        timeoutId = setTimeout(typeNextChar, BOOT_CHAR_DELAY)
      } else {
        lineIndex++
        charIndex = 0
        currentLine = ''
        timeoutId = setTimeout(typeNextChar, BOOT_LINE_DELAY)
      }
    }

    typeNextChar()

    return () => clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    async function applyStoredBrightness() {
      const val = await window.electronAPI?.settingsAPI?.get('brightness')
      const brightness = typeof val === 'number' ? val : 85
      const root = document.getElementById('root')
      if (root) root.style.filter = `brightness(${brightness / 100})`
    }
    void applyStoredBrightness()
  }, [])

  useEffect(() => {
    const TEXT_MODES = {
      dim:    { '--text': '#7ab3d4', '--dim': '#3d7a99', '--dimmer': '#1f4d66' },
      mid:    { '--text': '#a8d4ee', '--dim': '#6aadcc', '--dimmer': '#3d7a99' },
      bright: { '--text': '#d4eeff', '--dim': '#99d4ee', '--dimmer': '#6aadcc' },
    } as const
    async function applyStoredTextMode() {
      const m = await window.electronAPI?.settingsAPI?.get('textMode')
      const mode = (m === 'dim' || m === 'mid' || m === 'bright') ? m : 'mid'
      const vars = TEXT_MODES[mode]
      document.documentElement.style.setProperty('--text',   vars['--text'])
      document.documentElement.style.setProperty('--dim',    vars['--dim'])
      document.documentElement.style.setProperty('--dimmer', vars['--dimmer'])
    }
    void applyStoredTextMode()
  }, [])

  useEffect(() => {
    async function applyStoredFontSize() {
      const f = await window.electronAPI?.settingsAPI?.get('fontSize')
      if (f === 'S' || f === 'M' || f === 'L') applyFontSize(f)
    }
    void applyStoredFontSize()
  }, [])

  useEffect(() => {
    if (!booted) return
    loadVault()
    const api = window.electronAPI?.vaultAPI
    if (!api) return
    api.onChange(loadVault)
    return () => api.offChange(loadVault)
  }, [booted, loadVault])

  useEffect(() => {
    if (!booted) return
    async function loadProjects() {
      const stored = await window.electronAPI?.settingsAPI?.get('projects')
      if (Array.isArray(stored) && stored.length > 0) {
        setProjects(stored as Project[])
      } else {
        setProjects(PROJECTS_FALLBACK)
        void window.electronAPI?.settingsAPI?.set('projects', PROJECTS_FALLBACK)
      }
    }
    void loadProjects()
  }, [booted])

  useEffect(() => {
    if (!booted) return
    async function loadQuickLaunch() {
      const stored = await window.electronAPI?.settingsAPI?.get('quickLaunch')
      if (Array.isArray(stored) && stored.length > 0) setQuickLaunchApps(stored as QuickLaunchApp[])
    }
    void loadQuickLaunch()
  }, [booted])

  if (!booted) return <><Scanline /><BootScreen lines={bootLines} /></>

  return (
    <>
      <Scanline />
      <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', animation: 'flicker 8s infinite' }}>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <Sidebar
            active={activeSection}
            onSelect={id => { setSection(id); setSelected(null); setAddingProject(false) }}
            vaultTree={vaultTree}
            vaultLoading={vaultLoading}
            vaultError={vaultError}
            selectedGame={selectedGame}
            onSelectGame={path => { setSelectedGame(path); setSelectedFile(null) }}
            onChooseVaultPath={handleChooseVaultPath}
          />
          {activeSection === 'node' ? (
            <NodePanel quickLaunchApps={quickLaunchApps} />
          ) : activeSection === 'mail' ? (
            <MailPanel />
          ) : activeSection === 'messages' ? (
            <MessagesPanel />
          ) : (
            <>
              <MiddlePanel
                section={activeSection}
                selected={activeSection === 'system' ? systemCategory : selectedItem}
                onSelect={activeSection === 'system' ? setSystemCategory : id => { setSelected(id); setAddingProject(false) }}
                vaultTree={vaultTree}
                selectedGame={selectedGame}
                selectedFile={selectedFile}
                onSelectFile={setSelectedFile}
                projects={projects}
                onAddProject={() => { setAddingProject(true); setSelected(null) }}
              />
              {activeSection === 'vault'
                ? <VaultPanel selectedFile={selectedFile} onSelectFile={setSelectedFile} />
                : activeSection === 'system'
                ? <SystemPanel category={systemCategory} onVaultSaved={loadVault} onQuickLaunchSaved={apps => setQuickLaunchApps(apps)} />
                : addingProject
                ? <NewProjectForm
                    onCreated={async project => {
                      const updated = [...projects, project]
                      setProjects(updated)
                      await window.electronAPI?.settingsAPI?.set('projects', updated)
                      setAddingProject(false)
                      setSelected(project.id)
                    }}
                    onCancel={() => setAddingProject(false)}
                  />
                : <DetailPanel
                    projectId={selectedItem}
                    projects={projects}
                    onRemove={async id => {
                      const updated = projects.filter(p => p.id !== id)
                      setProjects(updated)
                      await window.electronAPI?.settingsAPI?.set('projects', updated)
                      setSelected(null)
                    }}
                    onUpdate={async project => {
                      const updated = projects.map(p => p.id === project.id ? project : p)
                      setProjects(updated)
                      await window.electronAPI?.settingsAPI?.set('projects', updated)
                    }}
                  />
              }
            </>
          )}
        </div>
        <StatusBar time={time} vaultFileCount={vaultFileCount} />
      </div>
    </>
  )
}
