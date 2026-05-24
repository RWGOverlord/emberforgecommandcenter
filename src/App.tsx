import { useState, useEffect, useCallback, useRef } from 'react'
import './index.css'
import VaultPanel from './VaultPanel'
import NodePanel from './NodePanel'
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
        set: (key: string, value: unknown) => Promise<void>
        get: (key: string) => Promise<unknown>
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

const PROJECTS = projectsData

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
}

function MiddlePanel({ section, selected, onSelect, vaultTree, selectedGame, selectedFile, onSelectFile }: MiddlePanelProps) {
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

      <div style={{ flex: 1, overflow: 'auto' }}>
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
        )) : section === 'projects' ? PROJECTS.map((p, i) => (
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
    </div>
  )
}

// ─── Connections panel ────────────────────────────────────────────────────────
function ConnectionsPanel() {
  const [apiKey, setApiKey]   = useState('')
  const [saved, setSaved]     = useState(false)

  useEffect(() => {
    async function load() {
      const val = await window.electronAPI?.settingsAPI?.get('pushbullet.apiKey')
      if (typeof val === 'string' && val) { setApiKey(val); setSaved(true) }
    }
    void load()
  }, [])

  async function handleSave() {
    await window.electronAPI?.settingsAPI?.set('pushbullet.apiKey', apiKey)
    setSaved(true)
  }

  return (
    <div style={{ padding: 20, zIndex: 1 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 8, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-mono)', marginBottom: 12 }}>
          // PUSHBULLET
        </div>
        <input
          type="password"
          value={apiKey}
          onChange={e => { setApiKey(e.target.value); setSaved(false) }}
          placeholder="API key..."
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--bg)', border: 'none',
            borderBottom: '1px solid var(--border-md)',
            color: 'var(--text)', fontFamily: 'var(--font-mono)',
            fontSize: 11, padding: '6px 0', outline: 'none',
          }}
          onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--accent)' }}
          onBlur={e  => { e.currentTarget.style.borderBottomColor = 'var(--border-md)' }}
        />
        <div style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 1, fontFamily: 'var(--font-mono)', marginTop: 6 }}>
          get your key at pushbullet.com/account
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => void handleSave()}
          disabled={!apiKey.trim()}
          onMouseEnter={e => { if (apiKey.trim()) e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          style={{
            padding: '6px 14px', fontSize: 9, letterSpacing: 2,
            border: `1px solid ${apiKey.trim() ? 'var(--accent)' : 'var(--border-md)'}`,
            color: apiKey.trim() ? 'var(--accent)' : 'var(--dim)',
            background: 'transparent', cursor: apiKey.trim() ? 'pointer' : 'default',
            fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease',
          }}
        >
          [ SAVE ]
        </button>
        {saved && (
          <span style={{ fontSize: 9, color: 'var(--accent2)', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>
            CONFIGURED ✓
          </span>
        )}
      </div>
    </div>
  )
}

// ─── System panel ────────────────────────────────────────────────────────────
function SystemPanel({ category }: { category: string }) {
  const [brightness, setBrightness] = useState(85)
  const [textMode,   setTextMode]   = useState<'dim' | 'mid' | 'bright'>('mid')
  const [vaultPath, setVaultPath]   = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const b = await window.electronAPI?.settingsAPI?.get('brightness')
      if (typeof b === 'number') setBrightness(b)
      const m = await window.electronAPI?.settingsAPI?.get('textMode')
      if (m === 'dim' || m === 'mid' || m === 'bright') setTextMode(m)
      const vp = await window.electronAPI?.vaultAPI?.getPath()
      if (vp) setVaultPath(vp)
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
      </div>
    )
    if (category === 'connections') return <ConnectionsPanel />
    if (category === 'quicklaunch') return stub('// QUICK LAUNCH')
    if (category === 'vault')       return stub('// VAULT PATH',
      vaultPath
        ? <div style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 1, fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '0 20px' }}>{vaultPath}</div>
        : <div style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>— LOADING —</div>
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
  vercel:   [{ key: 'projectId', label: 'PROJECT ID', type: 'text'     }, { key: 'token',   label: 'API TOKEN',   type: 'password' }],
  supabase: [{ key: 'url',       label: 'PROJECT URL', type: 'text'     }, { key: 'anonKey', label: 'ANON KEY',    type: 'password' }],
  github:   [{ key: 'repoPath',  label: 'REPO PATH',   type: 'text'     }, { key: 'token',   label: 'TOKEN',       type: 'password' }],
}

function cardDisplayValue(id: CardKey, cfg: Record<string, string>): string {
  if (id === 'vercel')   return cfg.projectId ?? '—'
  if (id === 'supabase') return cfg.url        ?? '—'
  return cfg.repoPath ?? '—'
}

const LOG_COLORS: Record<LogEntry['type'], string> = {
  info: 'var(--dim)', success: 'var(--accent2)', error: '#ff4444', action: 'var(--accent)',
}

function StatCard({ id, label, borderRight, isEditing, config, draft, onEdit, onCancel, onSave, onDraftChange }: {
  id: CardKey; label: string; borderRight: boolean
  isEditing: boolean; config: Record<string, string> | null; draft: Record<string, string>
  onEdit: () => void; onCancel: () => void; onSave: () => void
  onDraftChange: (key: string, val: string) => void
}) {
  const fields = CARD_FIELDS[id]
  return (
    <div style={{ padding: '12px 16px', borderRight: borderRight ? '1px solid var(--border)' : 'none', background: 'var(--bg-panel)', display: 'flex', flexDirection: 'column', gap: 4, position: 'relative', minHeight: 86 }}>
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
            <>
              <div style={{ fontSize: 9, color: 'var(--dim)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cardDisplayValue(id, config)}</div>
              <div style={{ fontSize: 8, color: 'var(--accent2)', letterSpacing: 1 }}>CONFIGURED ✓</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 20, color: 'var(--accent)', fontFamily: 'var(--font-head)', fontWeight: 700, lineHeight: 1 }}>—</div>
              <div style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 1 }}>not connected</div>
            </>
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
function DetailPanel({ projectId }: { projectId: string | null }) {
  const [mode, setMode]                 = useState<'bug' | 'task' | 'general'>('task')
  const [input, setInput]               = useState('')
  const [generating, setGenerating]     = useState(false)
  const [output, setOutput]             = useState<string | null>(null)
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  const [editingCard, setEditingCard]   = useState<CardKey | null>(null)
  const [cardConfigs, setCardConfigs]   = useState<Record<CardKey, Record<string, string> | null>>({ vercel: null, supabase: null, github: null })
  const [cardDraft, setCardDraft]       = useState<Record<string, string>>({})
  const [logs, setLogs]                 = useState<LogEntry[]>([])
  const logsEndRef                      = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMode('task')
    setInput('')
    setGenerating(false)
    setOutput(null)
    setActionStatus(null)
    setEditingCard(null)
    setCardDraft({})
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

  const project = PROJECTS.find(p => p.id === projectId)

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

      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
      if (!apiKey || apiKey === 'your-api-key-here') throw new Error('API key not configured in .env')

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
          <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 1 }}>{project.vercelProject ?? '—'}</span>
          <button
            onClick={() => void window.electronAPI?.openInVSCode(project.repoPath)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.color = 'var(--dimmer)' }}
            style={{ fontSize: 8, letterSpacing: 2, border: '1px solid var(--border-md)', color: 'var(--dimmer)', padding: '4px 10px', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
          >OPEN IN VSCODE</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid var(--border)', flexShrink: 0, zIndex: 1 }}>
        {(['vercel', 'supabase', 'github'] as CardKey[]).map((id, i) => (
          <StatCard
            key={id} id={id} borderRight={i < 2}
            label={id === 'vercel' ? 'VERCEL' : id === 'supabase' ? 'SUPABASE' : 'GITHUB'}
            isEditing={editingCard === id}
            config={cardConfigs[id]}
            draft={cardDraft}
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
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 8, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
            // LOGS
          </div>
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {logs.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 3, fontFamily: 'var(--font-mono)' }}>// NO LOGS YET</span>
              </div>
            ) : (
              <>
                {logs.map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                    <span style={{ fontSize: 8, color: 'var(--dimmer)', width: 44, flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{log.time}</span>
                    <span style={{ fontSize: 9, color: LOG_COLORS[log.type], letterSpacing: 0.5, fontFamily: 'var(--font-mono)' }}>{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </>
            )}
          </div>
        </div>

      </div>
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
    if (!booted) return
    loadVault()
    const api = window.electronAPI?.vaultAPI
    if (!api) return
    api.onChange(loadVault)
    return () => api.offChange(loadVault)
  }, [booted, loadVault])

  if (!booted) return <><Scanline /><BootScreen lines={bootLines} /></>

  return (
    <>
      <Scanline />
      <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', animation: 'flicker 8s infinite' }}>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <Sidebar
            active={activeSection}
            onSelect={id => { setSection(id); setSelected(null) }}
            vaultTree={vaultTree}
            vaultLoading={vaultLoading}
            vaultError={vaultError}
            selectedGame={selectedGame}
            onSelectGame={path => { setSelectedGame(path); setSelectedFile(null) }}
            onChooseVaultPath={handleChooseVaultPath}
          />
          {activeSection === 'node' ? (
            <NodePanel />
          ) : activeSection === 'mail' ? (
            <MailPanel />
          ) : activeSection === 'messages' ? (
            <MessagesPanel />
          ) : (
            <>
              <MiddlePanel
                section={activeSection}
                selected={activeSection === 'system' ? systemCategory : selectedItem}
                onSelect={activeSection === 'system' ? setSystemCategory : setSelected}
                vaultTree={vaultTree}
                selectedGame={selectedGame}
                selectedFile={selectedFile}
                onSelectFile={setSelectedFile}
              />
              {activeSection === 'vault'
                ? <VaultPanel selectedFile={selectedFile} onSelectFile={setSelectedFile} />
                : activeSection === 'system'
                ? <SystemPanel category={systemCategory} />
                : <DetailPanel projectId={selectedItem} />
              }
            </>
          )}
        </div>
        <StatusBar time={time} vaultFileCount={vaultFileCount} />
      </div>
    </>
  )
}
