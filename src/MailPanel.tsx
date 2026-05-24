import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
type GmailThread = {
  id: string
  subject: string
  from: string
  snippet: string
  timestamp: number
  unread: boolean
}

type GmailMessage = {
  id: string
  from: string
  to: string
  subject: string
  body: string
  timestamp: number
  fromMe: boolean
}

function relTime(ms: number): string {
  if (!ms) return ''
  const diff = Date.now() - ms
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)   return 'just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  if (days  === 1) return 'yesterday'
  if (days  < 7)   return `${days}d ago`
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function absDate(ms: number): string {
  if (!ms) return ''
  return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function senderName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</)
  if (match) return match[1].trim()
  return from.replace(/<[^>]+>/, '').trim() || from
}

// ─── Compose new email ────────────────────────────────────────────────────────
function ComposeField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', borderBottom: '1px solid var(--border)', padding: '10px 20px' }}>
      <span style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 3, fontFamily: 'var(--font-mono)', flexShrink: 0, width: 52 }}>{label}</span>
      {children}
    </div>
  )
}

function ComposeView({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [to, setTo]           = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody]       = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const toRef = useRef<HTMLInputElement>(null)

  useEffect(() => { toRef.current?.focus() }, [])

  async function handleSend() {
    if (!to.trim() || !body.trim() || sending) return
    setSending(true)
    setError(null)
    const res = await window.electronAPI?.gmailAPI?.sendEmail(to.trim(), subject.trim() || '(no subject)', body.trim())
    setSending(false)
    if (res?.success) {
      onSent()
      onClose()
    } else {
      setError(res?.error ?? 'send failed')
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden', animation: 'slide-in 0.15s ease both' }}>
      {/* Compose header */}
      <div style={{ height: 44, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 20px', flexShrink: 0, justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 12, color: 'var(--accent2)', letterSpacing: 1 }}>// NEW MESSAGE</span>
        <button
          onClick={onClose}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--dim)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--dimmer)' }}
          style={{ background: 'transparent', border: 'none', color: 'var(--dimmer)', cursor: 'pointer', fontSize: 14, lineHeight: 1, fontFamily: 'var(--font-mono)' }}
        >
          ✕
        </button>
      </div>

      {/* Fields */}
      <ComposeField label="TO">
        <input
          ref={toRef}
          type="email"
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder="recipient@email.com"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', padding: 0 }}
        />
      </ComposeField>
      <ComposeField label="SUBJECT">
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="(optional)"
          onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', padding: 0 }}
        />
      </ComposeField>

      {/* Body */}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="..."
        disabled={sending}
        style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', background: 'transparent', border: 'none', outline: 'none', padding: '16px 20px', resize: 'none', lineHeight: 1.8, opacity: sending ? 0.5 : 1 }}
      />

      {/* Actions */}
      <div style={{ borderTop: '1px solid var(--border-md)', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        {error
          ? <span style={{ fontSize: 8, color: '#ff4444', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>// SEND FAILED — {error}</span>
          : <span />
        }
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            disabled={sending}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--dim)'; e.currentTarget.style.color = 'var(--dim)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dimmer)'; e.currentTarget.style.color = 'var(--dimmer)' }}
            style={{ padding: '5px 14px', fontSize: 9, letterSpacing: 2, border: '1px solid var(--dimmer)', color: 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
          >
            [ CANCEL ]
          </button>
          <button
            onClick={() => void handleSend()}
            disabled={sending || !to.trim() || !body.trim()}
            onMouseEnter={e => { if (!sending && to.trim() && body.trim()) e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            style={{ padding: '5px 14px', fontSize: 9, letterSpacing: 2, border: `1px solid ${sending || !to.trim() || !body.trim() ? 'var(--border-md)' : 'var(--accent)'}`, color: sending || !to.trim() || !body.trim() ? 'var(--dim)' : 'var(--accent)', background: 'transparent', cursor: sending || !to.trim() || !body.trim() ? 'default' : 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
          >
            {sending ? '// SENDING...' : '[ SEND ]'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Empty right panel ────────────────────────────────────────────────────────
function EmptyEmail() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--bg)' }}>
      <div style={{ fontSize: 28, color: 'var(--dimmer)' }}>✉</div>
      <div style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 4, fontFamily: 'var(--font-mono)' }}>// SELECT AN EMAIL</div>
    </div>
  )
}

// ─── Auth required state ──────────────────────────────────────────────────────
function AuthRequired({ onConnect }: { onConnect: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--bg)' }}>
      <div style={{ fontSize: 28, color: 'var(--dimmer)' }}>✉</div>
      <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 4, fontFamily: 'var(--font-mono)', marginTop: 12 }}>// GMAIL — NOT CONNECTED</div>
      <button
        onClick={onConnect}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        style={{ padding: '8px 20px', fontSize: 9, letterSpacing: 2, border: '1px solid var(--accent)', color: 'var(--accent)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease', marginTop: 4 }}
      >
        [ CONNECT GMAIL ]
      </button>
    </div>
  )
}

// ─── Email view ───────────────────────────────────────────────────────────────
function EmailView({ messages, loading, onReply }: {
  messages: GmailMessage[]
  loading: boolean
  onReply: (to: string, subject: string, threadId: string, body: string) => void
}) {
  const [showComposer, setShowComposer] = useState(false)
  const [replyBody, setReplyBody]       = useState('')
  const [sending, setSending]           = useState(false)
  const [sendStatus, setSendStatus]     = useState<'idle' | 'sent' | 'failed'>('idle')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setShowComposer(false); setReplyBody(''); setSendStatus('idle') }, [messages])

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--bg)' }}>
      <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-mono)' }}>// LOADING...</span>
      <span style={{ animation: 'blink 1s infinite', color: 'var(--accent)' }}>█</span>
    </div>
  )

  if (messages.length === 0) return <EmptyEmail />

  const first = messages[0]
  const last  = messages[messages.length - 1]
  const threadId = first.id

  async function handleSend() {
    if (!replyBody.trim() || sending) return
    setSending(true)
    const replyTo  = messages.find(m => !m.fromMe)?.from ?? first.from
    const subject  = first.subject.startsWith('Re:') ? first.subject : `Re: ${first.subject}`
    const result = await window.electronAPI?.gmailAPI?.sendEmail(replyTo, subject, replyBody.trim(), threadId)
    setSending(false)
    if (result?.success) {
      setSendStatus('sent')
      setReplyBody('')
      setShowComposer(false)
      setTimeout(() => setSendStatus('idle'), 2000)
      onReply(replyTo, subject, threadId, replyBody.trim())
    } else {
      setSendStatus('failed')
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Email header */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '16px 20px', flexShrink: 0, position: 'relative' }}>
        <div style={{ paddingRight: 110 }}>
          <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 14, color: 'var(--accent2)', letterSpacing: 0.5, marginBottom: 10, lineHeight: 1.3 }}>
            {first.subject || '(no subject)'}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 3 }}>FROM</span>
            <span style={{ fontSize: 10, color: 'var(--dim)' }}>{first.from}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 3 }}>DATE</span>
            <span style={{ fontSize: 10, color: 'var(--dim)' }}>{absDate(last.timestamp)}</span>
          </div>
        </div>
        <button
          onClick={() => { setShowComposer(v => !v); setTimeout(() => textareaRef.current?.focus(), 50) }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          style={{ position: 'absolute', top: 16, right: 20, padding: '5px 14px', fontSize: 9, letterSpacing: 2, border: '1px solid var(--accent)', color: 'var(--accent)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
        >
          [ REPLY ]
        </button>
        {sendStatus === 'sent' && (
          <div style={{ position: 'absolute', bottom: 8, right: 20, fontSize: 9, color: 'var(--accent2)', letterSpacing: 1, fontFamily: 'var(--font-mono)', animation: 'fade-up 0.3s ease both' }}>
            // REPLY SENT ✓
          </div>
        )}
      </div>

      {/* Email body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {messages.length > 1 && (
          <div style={{ marginBottom: 20 }}>
            {messages.slice(0, -1).map(m => (
              <div key={m.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)', opacity: 0.6 }}>
                <div style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 2, marginBottom: 6 }}>
                  {m.fromMe ? 'YOU' : senderName(m.from)} — {absDate(m.timestamp)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{m.body}</div>
              </div>
            ))}
          </div>
        )}
        <div>
          {messages.length > 1 && (
            <div style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 2, marginBottom: 6 }}>
              {last.fromMe ? 'YOU' : senderName(last.from)} — {absDate(last.timestamp)}
            </div>
          )}
          {last.body || <span style={{ color: 'var(--dimmer)', fontStyle: 'italic' }}>(empty)</span>}
        </div>
      </div>

      {/* Reply composer */}
      {showComposer && (
        <div style={{ borderTop: '1px solid var(--border-md)', padding: '14px 20px', flexShrink: 0, animation: 'fade-up 0.2s ease both' }}>
          <div style={{ fontSize: 8, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-mono)', marginBottom: 8 }}>// REPLY</div>
          <textarea
            ref={textareaRef}
            value={replyBody}
            onChange={e => setReplyBody(e.target.value)}
            disabled={sending}
            rows={4}
            style={{ width: '100%', minHeight: 80, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', background: 'var(--bg-panel)', border: '1px solid var(--border-md)', padding: '10px 12px', resize: 'none', outline: 'none', opacity: sending ? 0.5 : 1, transition: 'border-color 0.15s ease', boxSizing: 'border-box' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
            onBlur={e  => { e.currentTarget.style.borderColor = 'var(--border-md)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => { setShowComposer(false); setReplyBody(''); setSendStatus('idle') }}
              disabled={sending}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--dim)'; e.currentTarget.style.color = 'var(--dim)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dimmer)'; e.currentTarget.style.color = 'var(--dimmer)' }}
              style={{ padding: '5px 14px', fontSize: 9, letterSpacing: 2, border: '1px solid var(--dimmer)', color: 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
            >
              [ CANCEL ]
            </button>
            <button
              onClick={() => void handleSend()}
              disabled={sending || !replyBody.trim()}
              onMouseEnter={e => { if (!sending && replyBody.trim()) e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              style={{ padding: '5px 14px', fontSize: 9, letterSpacing: 2, border: `1px solid ${sending || !replyBody.trim() ? 'var(--border-md)' : 'var(--accent)'}`, color: sending || !replyBody.trim() ? 'var(--dim)' : 'var(--accent)', background: 'transparent', cursor: sending || !replyBody.trim() ? 'default' : 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
            >
              {sending ? '// SENDING...' : '[ SEND REPLY ]'}
            </button>
          </div>
          {sendStatus === 'failed' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 8, color: '#ff4444', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>// SEND FAILED</span>
              <button
                onClick={() => void handleSend()}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.color = 'var(--dim)' }}
                style={{ padding: '3px 10px', fontSize: 8, letterSpacing: 2, border: '1px solid var(--border-md)', color: 'var(--dim)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
              >
                [ RETRY ]
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── MailPanel ────────────────────────────────────────────────────────────────
export default function MailPanel() {
  const [status, setStatus]             = useState<'LOADING' | 'AUTH_REQUIRED' | 'AUTHENTICATED' | 'ERROR'>('LOADING')
  const [threads, setThreads]           = useState<GmailThread[]>([])
  const [search, setSearch]             = useState('')
  const [selected, setSelected]         = useState<GmailThread | null>(null)
  const [messages, setMessages]         = useState<GmailMessage[]>([])
  const [msgLoading, setMsgLoading]     = useState(false)
  const [threadsLoading, setThreadsLoading] = useState(false)
  const [nextPageToken, setNextPageToken]   = useState<string | null>(null)
  const [loadingMore, setLoadingMore]       = useState(false)
  const [connecting, setConnecting]         = useState(false)
  const [composing, setComposing]           = useState(false)

  useEffect(() => {
    const api = window.electronAPI?.gmailAPI
    if (!api) { setStatus('ERROR'); return }

    void api.getStatus().then(s => setStatus(s as typeof status))
    api.onStatus(s => {
      setStatus(s as typeof status)
      if (s === 'AUTHENTICATED') loadThreads()
    })

    return () => { api.offStatus() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status === 'AUTHENTICATED' && threads.length === 0 && !threadsLoading) {
      loadThreads()
    }
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadThreads() {
    const api = window.electronAPI?.gmailAPI
    if (!api) return
    setThreadsLoading(true)
    const res = await api.getThreads()
    setThreadsLoading(false)
    if (res.error) return
    setThreads(res.threads ?? [])
    setNextPageToken(res.nextPageToken ?? null)
  }

  async function loadMoreThreads() {
    const api = window.electronAPI?.gmailAPI
    if (!api || !nextPageToken || loadingMore) return
    setLoadingMore(true)
    const res = await api.getThreads(nextPageToken)
    setLoadingMore(false)
    if (res.error) return
    setThreads(prev => [...prev, ...(res.threads ?? [])])
    setNextPageToken(res.nextPageToken ?? null)
  }

  const loadThread = useCallback(async (thread: GmailThread) => {
    setSelected(thread)
    setMessages([])
    setMsgLoading(true)
    const api = window.electronAPI?.gmailAPI
    if (!api) { setMsgLoading(false); return }
    const res = await api.getThread(thread.id)
    setMsgLoading(false)
    if (res.messages) {
      setMessages(res.messages)
      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, unread: false } : t))
    }
  }, [])

  async function handleConnect() {
    const api = window.electronAPI?.gmailAPI
    if (!api || connecting) return
    setConnecting(true)
    await api.authorize()
    setConnecting(false)
  }

  const filtered = threads.filter(t =>
    t.subject.toLowerCase().includes(search.toLowerCase()) ||
    senderName(t.from).toLowerCase().includes(search.toLowerCase()) ||
    t.from.toLowerCase().includes(search.toLowerCase())
  )

  function renderContent() {
    if (status === 'LOADING') {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--bg)' }}>
          <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-mono)' }}>// LOADING MAIL...</span>
          <span style={{ animation: 'blink 1s infinite', color: 'var(--accent)' }}>█</span>
        </div>
      )
    }

    if (status === 'AUTH_REQUIRED' || status === 'ERROR') {
      return (
        <>
          <AuthRequired onConnect={() => void handleConnect()} />
          <AuthRequired onConnect={() => void handleConnect()} />
        </>
      )
    }

    return (
      <>
        {/* Thread list */}
        <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 32, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="// SEARCH..."
              style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text)', padding: '0 12px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {threadsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 6 }}>
                <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>// LOADING MAIL...</span>
                <span style={{ animation: 'blink 1s infinite', color: 'var(--accent)' }}>█</span>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <span style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 3, fontFamily: 'var(--font-mono)' }}>
                  {threads.length === 0 ? '// NO MAIL' : '// NO RESULTS'}
                </span>
              </div>
            ) : (
              <>
                {filtered.map((t, i) => {
                  const isSelected = t.id === selected?.id
                  return (
                    <div
                      key={t.id}
                      onClick={() => void loadThread(t)}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: isSelected ? 'var(--bg-hover)' : 'transparent',
                        borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                        animation: 'fade-up 0.25s ease both',
                        animationDelay: `${i * 0.04}s`,
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                    >
                      {/* Row 1: sender + timestamp */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', minWidth: 0 }}>
                          {t.unread && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                          <span style={{ fontFamily: 'var(--font-head)', fontWeight: t.unread ? 700 : 600, fontSize: 11, color: t.unread ? 'var(--accent)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {senderName(t.from) || t.from}
                          </span>
                        </div>
                        <span style={{ fontSize: 8, color: 'var(--dimmer)', flexShrink: 0, marginLeft: 6 }}>
                          {relTime(t.timestamp)}
                        </span>
                      </div>
                      {/* Row 2: subject */}
                      <div style={{ fontSize: 10, color: t.unread ? 'var(--text)' : 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2, paddingLeft: t.unread ? 10 : 0 }}>
                        {t.subject || '(no subject)'}
                      </div>
                      {/* Row 3: snippet */}
                      <div style={{ fontSize: 9, color: 'var(--dimmer)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: t.unread ? 10 : 0 }}>
                        {t.snippet || '—'}
                      </div>
                    </div>
                  )
                })}

                {nextPageToken && (
                  <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={() => void loadMoreThreads()}
                      disabled={loadingMore}
                      onMouseEnter={e => { if (!loadingMore) e.currentTarget.style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      style={{ padding: '5px 14px', fontSize: 9, letterSpacing: 2, border: `1px solid ${loadingMore ? 'var(--border-md)' : 'var(--accent)'}`, color: loadingMore ? 'var(--dim)' : 'var(--accent)', background: 'transparent', cursor: loadingMore ? 'default' : 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
                    >
                      {loadingMore ? '// LOADING...' : '[ LOAD MORE ]'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Email view / compose */}
        {composing ? (
          <ComposeView
            onClose={() => setComposing(false)}
            onSent={() => void loadThreads()}
          />
        ) : selected ? (
          <EmailView
            messages={messages}
            loading={msgLoading}
            onReply={() => void loadThread(selected)}
          />
        ) : (
          <EmptyEmail />
        )}
      </>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ height: 44, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, flexShrink: 0, background: 'var(--bg-panel)' }}>
        <span style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 2, fontFamily: 'var(--font-head)', fontWeight: 700 }}>// MAIL</span>
        <span style={{ animation: 'blink 1.4s infinite', fontSize: 10, color: 'var(--dimmer)' }}>▌</span>
        {status === 'AUTHENTICATED' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button
              onClick={() => { setComposing(true); setSelected(null) }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.color = 'var(--dimmer)' }}
              style={{ padding: '4px 10px', fontSize: 8, letterSpacing: 2, border: '1px solid var(--border-md)', color: 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
            >
              [ COMPOSE ]
            </button>
            <button
              onClick={() => void loadThreads()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.color = 'var(--dimmer)' }}
              style={{ padding: '4px 10px', fontSize: 8, letterSpacing: 2, border: '1px solid var(--border-md)', color: 'var(--dimmer)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
            >
              [ REFRESH ]
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {renderContent()}
      </div>
    </div>
  )
}
