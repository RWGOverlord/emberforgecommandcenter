import { useState, useEffect, useRef, useCallback } from 'react'
import { marked } from 'marked'

// ─── Scoped markdown styles ───────────────────────────────────────────────────
const VAULT_STYLES = `
.vault-content h1, .vault-content h2, .vault-content h3 {
  font-family: Rajdhani, sans-serif;
  font-weight: 700;
  color: var(--accent2);
  letter-spacing: 1px;
}
.vault-content h1::before, .vault-content h2::before, .vault-content h3::before {
  content: "// ";
}
.vault-content h1 {
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
}
.vault-content p {
  font-family: 'Share Tech Mono', monospace;
  color: var(--text);
  line-height: 1.8;
  font-size: 12px;
}
.vault-content code {
  background: var(--bg-panel);
  color: var(--accent);
  border: 1px solid var(--border-md);
  padding: 1px 5px;
  border-radius: 2px;
}
.vault-content pre {
  background: var(--bg-panel);
  border: 1px solid var(--border-md);
  border-left: 3px solid var(--accent);
  padding: 12px 16px;
  overflow-x: auto;
}
.vault-content pre code {
  background: none;
  border: none;
  padding: 0;
  border-radius: 0;
  color: var(--accent);
  font-family: 'Share Tech Mono', monospace;
  font-size: 11px;
}
.vault-content ul, .vault-content ol {
  color: var(--text);
  padding-left: 20px;
  line-height: 1.8;
}
.vault-content li::marker {
  color: var(--accent);
}
.vault-content blockquote {
  border-left: 3px solid var(--accent2);
  padding-left: 12px;
  color: var(--dim);
  font-style: italic;
  margin: 0 0 12px 0;
}
.vault-content table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 12px;
}
.vault-content th {
  background: var(--bg-panel);
  color: var(--accent);
  border: 1px solid var(--border-md);
  padding: 8px 12px;
  font-family: Rajdhani, sans-serif;
  font-weight: 600;
  text-align: left;
}
.vault-content td {
  border: 1px solid var(--border);
  padding: 8px 12px;
  color: var(--text);
}
.vault-content input[type="checkbox"] {
  accent-color: var(--accent);
}
.vault-content a {
  color: var(--accent);
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 27%, transparent);
}
.vault-content hr {
  border: none;
  border-top: 1px solid var(--border-md);
  margin: 16px 0;
}
`

// ─── Btn helper ───────────────────────────────────────────────────────────────
function Btn({ children, onClick, muted, danger }: { children: string; onClick: () => void; muted?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: `1px solid ${danger ? '#ff4444' : 'var(--border-md)'}`,
        color: danger ? '#ff4444' : muted ? 'var(--dimmer)' : 'var(--dim)',
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: 1,
        padding: '3px 8px',
        cursor: muted ? 'default' : 'pointer',
        pointerEvents: muted ? 'none' : 'auto',
      }}
    >
      {children}
    </button>
  )
}

// ─── VaultPanel ───────────────────────────────────────────────────────────────
type Props = {
  selectedFile: string | null
  onSelectFile: (path: string) => void
}

export default function VaultPanel({ selectedFile, onSelectFile }: Props) {
  const [loadedFile, setLoadedFile]     = useState<string | null>(null)
  const [content, setContent]           = useState('')
  const [loading, setLoading]           = useState(false)
  const [mode, setMode]                 = useState<'view' | 'edit'>('view')
  const [editContent, setEditContent]   = useState('')
  const [saving, setSaving]             = useState(false)
  const [saveError, setSaveError]       = useState(false)
  const [pendingFile, setPendingFile]   = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Ref snapshot so the file-change effect doesn't need reactive deps on edit state
  const snap = useRef({ mode, editContent, content })
  snap.current = { mode, editContent, content }

  const loadFile = useCallback(async (path: string) => {
    const api = window.electronAPI?.vaultAPI
    if (!api) return
    setLoading(true)
    setSaveError(false)
    try {
      const result = await api.readFile(path)
      setContent(result.content)
      setEditContent(result.content)
      setLoadedFile(path)
      setMode('view')
    } finally {
      setLoading(false)
    }
  }, [])

  // Trigger load (or show guard) when selectedFile changes
  useEffect(() => {
    if (!selectedFile || selectedFile === loadedFile) return
    const { mode: m, editContent: ec, content: c } = snap.current
    const hasUnsaved = m === 'edit' && ec !== c
    if (hasUnsaved) {
      setPendingFile(selectedFile)
    } else {
      void loadFile(selectedFile)
    }
  }, [selectedFile, loadedFile, loadFile])

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (mode === 'edit') textareaRef.current?.focus()
  }, [mode])

  // ── Actions ────────────────────────────────────────────────────────────────
  function enterEdit() {
    setEditContent(content)
    setSaveError(false)
    setMode('edit')
  }

  async function save() {
    const api = window.electronAPI?.vaultAPI
    if (!api || !loadedFile) return
    setSaving(true)
    setSaveError(false)
    try {
      const result = await api.writeFile(loadedFile, editContent)
      if (result.success) {
        setContent(editContent)
        setMode('view')
      } else {
        setSaveError(true)
      }
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setEditContent(content)
    setMode('view')
    setSaveError(false)
  }

  function handleDiscard() {
    const next = pendingFile
    setMode('view')
    setSaveError(false)
    setPendingFile(null)
    if (next) void loadFile(next)
  }

  function handleKeepEditing() {
    setPendingFile(null)
    if (loadedFile) onSelectFile(loadedFile)
  }

  function handleTab(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const ta = e.currentTarget
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const next  = editContent.slice(0, start) + '  ' + editContent.slice(end)
    setEditContent(next)
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2 }, 0)
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!selectedFile && !loadedFile) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ zIndex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: 36, color: 'var(--dimmer)', marginBottom: 16 }}>◈</div>
        <div style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: 4 }}>// SELECT A FILE</div>
      </div>
    </div>
  )

  const filename = (loadedFile ?? selectedFile ?? '').split('/').pop()?.replace(/\.md$/, '') ?? ''
  const html = loadedFile ? marked.parse(content) as string : ''

  // ── Header bar ─────────────────────────────────────────────────────────────
  function renderHeader() {
    if (pendingFile) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
        <span style={{ fontSize: 9, color: '#ffc200', fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>
          // UNSAVED CHANGES
        </span>
        <Btn onClick={handleDiscard} danger>[ DISCARD ]</Btn>
        <Btn onClick={handleKeepEditing}>[ KEEP EDITING ]</Btn>
      </div>
    )
    return (
      <>
        <span style={{ fontSize: 11, color: 'var(--accent2)', fontFamily: 'var(--font-head)', fontWeight: 700, letterSpacing: 1 }}>
          {filename.toUpperCase()}
        </span>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          {saving ? (
            <Btn onClick={() => {}} muted>[ SAVING... ]</Btn>
          ) : mode === 'view' ? (
            <Btn onClick={enterEdit}>[ EDIT ]</Btn>
          ) : (
            <>
              <Btn onClick={() => void save()}>[ SAVE ]</Btn>
              <Btn onClick={cancel}>[ CANCEL ]</Btn>
            </>
          )}
        </div>
      </>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        height: 44, borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 20px',
        gap: 12, flexShrink: 0,
      }}>
        {renderHeader()}
      </div>

      {/* Save error banner */}
      {saveError && (
        <div style={{
          padding: '8px 20px', background: 'var(--bg-panel)',
          borderBottom: '1px solid #ff444433',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <span style={{ fontSize: 9, color: '#ff4444', fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>
            // SAVE FAILED — check file permissions
          </span>
          <Btn onClick={() => void save()} danger>[ RETRY ]</Btn>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 9, color: 'var(--dim)', fontFamily: 'var(--font-mono)', letterSpacing: 2 }}>
          // LOADING...
        </div>
      )}

      {/* View mode */}
      {!loading && mode === 'view' && (
        <>
          <style dangerouslySetInnerHTML={{ __html: VAULT_STYLES }} />
          <div
            key={loadedFile}
            className="vault-content"
            dangerouslySetInnerHTML={{ __html: html }}
            style={{
              flex: 1, overflow: 'auto', padding: 20,
              animation: 'slide-in 0.2s ease both',
            }}
          />
        </>
      )}

      {/* Edit mode */}
      {!loading && mode === 'edit' && (
        <textarea
          ref={textareaRef}
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          onKeyDown={handleTab}
          style={{
            flex: 1, resize: 'none',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text)',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-md)',
            padding: 16,
            lineHeight: 1.8,
            outline: 'none',
            margin: 0,
          }}
        />
      )}
    </div>
  )
}
