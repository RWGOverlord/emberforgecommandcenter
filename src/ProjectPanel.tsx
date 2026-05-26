import { useState, useEffect, useRef } from 'react'
import type { Project, CardKey, LogEntry } from './types'
import { STATUS_COLORS } from './types'
import { relTimeShort } from './helpers'
import { GridBg } from './Shared'
import ProjectArchMap from './ProjectArchMap'

// ─── Form helper ─────────────────────────────────────────────────────────────

function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 8, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-mono)', marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 1, fontFamily: 'var(--font-mono)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

// ─── Stat cards ───────────────────────────────────────────────────────────────

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

// ─── New project form ─────────────────────────────────────────────────────────

export function NewProjectForm({ onCreated, onCancel }: {
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

// ─── Edit project form ────────────────────────────────────────────────────────

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

// ─── Detail panel ─────────────────────────────────────────────────────────────

export default function DetailPanel({ projectId, projects, onRemove, onUpdate }: { projectId: string | null; projects: Project[]; onRemove: (id: string) => void; onUpdate: (project: Project) => void }) {
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

  const [vercelData,    setVercelData]    = useState<VercelData   | null | 'loading' | { error: string }>(null)
  const [githubData,    setGithubData]    = useState<GithubData   | null | 'loading' | 'error'>(null)
  const [supabaseData,  setSupabaseData]  = useState<SupabaseData | null | 'loading' | 'error'>(null)
  const [logsSource,    setLogsSource]    = useState<'vercel' | 'github' | null>(null)
  const [vercelLogs,    setVercelLogs]    = useState<VercelLog[]    | null | 'loading' | { error: string }>(null)
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

      {/* Header */}
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

      {/* Overview content */}
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
                  READY:    { label: 'READY ✓',  color: 'var(--accent2)' },
                  BUILDING: { label: 'BUILDING',  color: '#ffc200' },
                  ERROR:    { label: 'FAILED ✗',  color: '#ff4444' },
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
                const issueColor = openIssues > 0 ? '#ffc200' : 'var(--dimmer)'
                const issueLabel = openIssues === 0 ? 'no open issues' : `${openIssues} open issue${openIssues === 1 ? '' : 's'}`
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
        <ProjectArchMap repoPath={project?.repoPath ?? ''} projectName={project?.label} />
      )}

    </div>
  )
}
