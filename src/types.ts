export type GmailThread = {
  id: string; subject: string; from: string; snippet: string; timestamp: number; unread: boolean
}

export type GmailMessage = {
  id: string; from: string; to: string; subject: string; body: string; timestamp: number; fromMe: boolean
}

export type Project = {
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

export const STATUS_COLORS: Record<string, string> = {
  LIVE: '#00ffcc', LOCAL: '#00d4ff', REPO: '#00d4ff', PLANNED: '#555555',
}

export type VaultNode = {
  name: string
  path: string
  type: 'folder' | 'file'
  ext: string
  modified: number
  children?: VaultNode[]
}

export type WaChat = {
  id: string
  name: string
  snippet: string
  timestamp: number
  unread: boolean
}

export type WaMessage = {
  id: string
  body: string
  timestamp: number
  direction: 'inbound' | 'outbound'
}

export type MessageThread = {
  id: string
  name: string
  number: string
  snippet: string
  timestamp: number
  unread: boolean
}

export type Message = {
  id: string
  body: string
  timestamp: number
  direction: 'inbound' | 'outbound'
}

export type CardKey  = 'vercel' | 'supabase' | 'github'
export type LogEntry = { time: string; message: string; type: 'info' | 'success' | 'error' | 'action' }

export type ScanNode = {
  id: string
  label: string
  path: string
  layer: 'page' | 'api' | 'component' | 'util' | 'other'
  overview: string
  depends: string[]
  externals: string[]
}

export type ScanEdge = {
  source: string
  target: string
}

export type ScanMeta = {
  projectName: string
  repoPath: string
  scannedAt: number
  totalFiles: number
  totalEdges: number
}

export type ScanResult = {
  nodes: ScanNode[]
  edges: ScanEdge[]
  meta: ScanMeta
}

export type LayoutNode = ScanNode & {
  x: number
  y: number
  width: number
  height: number
  color: string
}

export type LayoutEdge = ScanEdge & {
  points: { x: number; y: number }[]
}

export type LayoutResult = {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  width: number
  height: number
}

export const NAV_ITEMS = [
  { id: 'node',     label: '// NODE',     icon: '◈' },
  { id: 'mail',     label: '// MAIL',     icon: '✉' },
  { id: 'messages', label: '// COMMS',    icon: '✉' },
  { id: 'vault',    label: '// VAULT',    icon: '≡' },
  { id: 'projects', label: '// PROJECTS', icon: '▦' },
  { id: 'agents',   label: '// AGENTS',   icon: '◷', divider: true },
  { id: 'system',   label: '// SYSTEM',   icon: '⚙' },
]

export const SYSTEM_CATEGORIES = [
  { id: 'display',     label: 'DISPLAY'      },
  { id: 'connections', label: 'CONNECTIONS'  },
  { id: 'quicklaunch', label: 'QUICK LAUNCH' },
  { id: 'vault',       label: 'VAULT PATH'   },
  { id: 'about',       label: 'ABOUT'        },
]

export const BOOT_LINES = [
  '> INIT EMBERFORGE COMMAND CENTER...',
  '> LOADING CORE MODULES...',
  '> MOUNTING VAULT: RISING WARRIOR GAMES...',
  '> INDEXING FILES...',
  '> CONNECTING PROJECT REGISTRY...',
  '> ALL SYSTEMS NOMINAL.',
  '> WELCOME BACK, FATHERJEDEDIAH.',
]

export const BOOT_LINE_DELAY  = 350
export const BOOT_CHAR_DELAY  = 18
export const BOOT_FINISH_DELAY = 800

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
        connect:           () => Promise<{ success?: boolean; error?: string }>
        getThreads:        () => Promise<{ threads?: MessageThread[]; error?: string }>
        getThread:         (threadId: string) => Promise<{ messages?: Message[]; error?: string }>
        sendMessage:       (number: string, body: string) => Promise<{ success: boolean; error?: string }>
        getDevices:        () => Promise<{ iden?: string; nickname?: string; error?: string }>
        onThreadsUpdated:  (cb: (threads: MessageThread[]) => void) => void
        onThreadUpdated:   (cb: (data: { threadId: string; messages: Message[] }) => void) => void
        offThreadsUpdated: (cb: (threads: MessageThread[]) => void) => void
        offThreadUpdated:  (cb: (data: { threadId: string; messages: Message[] }) => void) => void
      }
      archmapAPI: {
        scan:   (repoPath: string) => Promise<ScanResult | { error: string }>
        rescan: (repoPath: string) => Promise<ScanResult | { error: string }>
      }
    }
  }
}
