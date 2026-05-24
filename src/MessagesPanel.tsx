import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Shared types ─────────────────────────────────────────────────────────────
type MessageThread = {
  id: string; name: string; number: string; snippet: string; timestamp: number; unread: boolean
}
type Message = {
  id: string; body: string; timestamp: number; direction: 'inbound' | 'outbound'
}
type WaChat = {
  id: string; name: string; snippet: string; timestamp: number; unread: boolean
}
type WaMessage = {
  id: string; body: string; timestamp: number; direction: 'inbound' | 'outbound'
}

function relTime(ms: number): string {
  const diff = Date.now() - ms
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)   return 'just now'
  if (mins  < 60)  return `${mins} min ago`
  if (hours < 24)  return `${hours}hr ago`
  if (days  === 1) return 'yesterday'
  return `${days}d ago`
}

function absTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

// ─── Shared conversation view ─────────────────────────────────────────────────
function ConversationView({
  name, number, messages, loading,
  onSend, reply, setReply, sending, sendError,
}: {
  name: string; number?: string; messages: Message[] | WaMessage[]
  loading: boolean; onSend: () => void
  reply: string; setReply: (v: string) => void
  sending: boolean; sendError: string | null
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ height: 44, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 20px', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 13, color: 'var(--accent2)' }}>{name}</span>
        {number && <span style={{ fontSize: 9, color: 'var(--dim)', marginLeft: 8 }}>{number}</span>}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-mono)' }}>// LOADING...</span>
            <span style={{ animation: 'blink 1s infinite', color: 'var(--accent)' }}>█</span>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 3, fontFamily: 'var(--font-mono)' }}>// NO MESSAGES</span>
          </div>
        ) : (
          (messages as Message[]).map(m => {
            const out = m.direction === 'outbound'
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: out ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                <div style={{
                  maxWidth: '65%', padding: '8px 12px',
                  fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6,
                  ...(out ? {
                    background: 'transparent',
                    border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
                    color: 'var(--accent)', borderRadius: '4px 0 4px 4px',
                  } : {
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-md)',
                    color: 'var(--text)', borderRadius: '0 4px 4px 4px',
                  }),
                }}>
                  {m.body}
                </div>
                <div style={{ fontSize: 8, color: 'var(--dimmer)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                  {absTime(m.timestamp)}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            value={reply} onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
            placeholder="> TYPE A MESSAGE..." rows={1} disabled={sending}
            style={{ flex: 1, minHeight: 36, maxHeight: 120, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', background: 'var(--bg-panel)', border: '1px solid var(--border-md)', padding: '8px 12px', resize: 'none', outline: 'none', opacity: sending ? 0.5 : 1, transition: 'border-color 0.15s ease' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
            onBlur={e  => { e.currentTarget.style.borderColor = 'var(--border-md)' }}
          />
          <button
            onClick={onSend} disabled={sending || !reply.trim()}
            onMouseEnter={e => { if (!sending && reply.trim()) e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            style={{ padding: '8px 16px', fontSize: 9, letterSpacing: 2, border: `1px solid ${sending || !reply.trim() ? 'var(--border-md)' : 'var(--accent)'}`, color: sending || !reply.trim() ? 'var(--dim)' : 'var(--accent)', background: 'transparent', cursor: sending || !reply.trim() ? 'default' : 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease', flexShrink: 0 }}
          >
            {sending ? '...' : '[ SEND ]'}
          </button>
        </div>
        {sendError && <div style={{ fontSize: 8, color: '#ff4444', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>// FAILED — {sendError}</div>}
      </div>
    </div>
  )
}

function EmptyConversation() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--bg)' }}>
      <div style={{ fontSize: 28, color: 'var(--dimmer)' }}>✉</div>
      <div style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 4, fontFamily: 'var(--font-mono)' }}>// SELECT A CONVERSATION</div>
    </div>
  )
}

// ─── SMS tab ──────────────────────────────────────────────────────────────────
function SmsTab() {
  const [threads, setThreads]     = useState<MessageThread[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState<MessageThread | null>(null)
  const [messages, setMessages]   = useState<Message[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [reply, setReply]         = useState('')
  const [sending, setSending]     = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    const api = window.electronAPI?.messagesAPI
    if (!api) { setLoading(false); return }
    void api.getThreads().then(res => {
      if (res.error) setError(res.error)
      else setThreads(res.threads ?? [])
      setLoading(false)
    })
    const handler = (t: MessageThread[]) => { setThreads(t); setError(null) }
    api.onThreadsUpdated(handler)
    return () => { api.offThreadsUpdated(handler) }
  }, [])

  useEffect(() => {
    if (!selected) { setMessages([]); return }
    const api = window.electronAPI?.messagesAPI
    if (!api) return
    setMsgLoading(true)
    setMessages([])
    void api.getThread(selected.id).then(res => {
      setMessages(res.messages ?? [])
      setMsgLoading(false)
    })
    const handler = (data: { threadId: string; messages: Message[] }) => {
      if (data.threadId === selected.id) setMessages(data.messages)
    }
    api.onThreadUpdated(handler)
    return () => { api.offThreadUpdated(handler) }
  }, [selected])

  const handleSend = useCallback(async () => {
    if (!selected || !reply.trim() || sending) return
    setSending(true); setSendError(null)
    const body = reply.trim()
    const res = await window.electronAPI?.messagesAPI?.sendMessage(selected.number, body)
    setSending(false)
    if (res?.success) {
      setReply('')
      setMessages(prev => [...prev, { id: `local-${Date.now()}`, body, timestamp: Date.now(), direction: 'outbound' }])
    } else { setSendError(res?.error ?? 'send failed') }
  }, [selected, reply, sending])

  const filtered = threads.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.snippet.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Thread list */}
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 32, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="// SEARCH..."
            style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text)', padding: '0 12px', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 6 }}>
              <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>// LOADING...</span>
              <span style={{ animation: 'blink 1s infinite', color: 'var(--accent)' }}>█</span>
            </div>
          ) : error === 'NO_API_KEY' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
              <div style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 3, fontFamily: 'var(--font-mono)' }}>// API KEY NOT SET</div>
              <div style={{ fontSize: 8, color: 'var(--dimmer)', fontFamily: 'var(--font-mono)', marginTop: 4, textAlign: 'center', padding: '0 16px' }}>Configure in // SYSTEM → CONNECTIONS</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <span style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 3, fontFamily: 'var(--font-mono)' }}>{threads.length === 0 ? '// NO THREADS' : '// NO RESULTS'}</span>
            </div>
          ) : filtered.map((t, i) => {
            const isSelected = t.id === selected?.id
            return (
              <div key={t.id} onClick={() => setSelected(t)}
                style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSelected ? 'var(--bg-hover)' : 'transparent', borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent', animation: 'fade-up 0.25s ease both', animationDelay: `${i * 0.04}s`, transition: 'background 0.15s ease' }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                    {t.unread && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                    <span style={{ fontFamily: 'var(--font-head)', fontWeight: t.unread ? 700 : 600, fontSize: 11, color: t.unread ? 'var(--accent)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name || t.number}</span>
                  </div>
                  <span style={{ fontSize: 8, color: 'var(--dimmer)', flexShrink: 0, marginLeft: 6 }}>{t.timestamp ? relTime(t.timestamp) : ''}</span>
                </div>
                <div style={{ fontSize: 9, color: t.unread ? 'var(--text)' : 'var(--dim)', letterSpacing: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: t.unread ? 10 : 0 }}>{t.snippet || '—'}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Conversation */}
      {selected ? (
        <ConversationView
          name={selected.name || selected.number} number={selected.name ? selected.number : undefined}
          messages={messages} loading={msgLoading}
          reply={reply} setReply={setReply} sending={sending} sendError={sendError}
          onSend={() => void handleSend()}
        />
      ) : <EmptyConversation />}
    </div>
  )
}

// ─── WhatsApp tab ─────────────────────────────────────────────────────────────
function WhatsAppTab() {
  const [status, setStatus]       = useState('disconnected')
  const [qr, setQr]               = useState<string | null>(null)
  const [chats, setChats]         = useState<WaChat[]>([])
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState<WaChat | null>(null)
  const [messages, setMessages]   = useState<WaMessage[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [reply, setReply]         = useState('')
  const [sending, setSending]     = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    const api = window.electronAPI?.waAPI
    if (!api) return
    // Load cached state
    void api.getChats().then(res => { setStatus(res.status); setChats(res.chats) })
    api.onStatus(setStatus)
    api.onQR(setQr)
    api.onChatsUpdated(setChats)
    api.onMessagesUpdated(data => {
      if (data.jid === selected?.id) setMessages(data.messages)
    })
    return () => { api.offAll() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) { setMessages([]); return }
    setMsgLoading(true)
    void window.electronAPI?.waAPI?.getMessages(selected.id).then(res => {
      setMessages(res.messages)
      setMsgLoading(false)
    })
  }, [selected])

  const handleSend = useCallback(async () => {
    if (!selected || !reply.trim() || sending) return
    setSending(true); setSendError(null)
    const text = reply.trim()
    const res = await window.electronAPI?.waAPI?.sendMessage(selected.id, text)
    setSending(false)
    if (res?.success) {
      setReply('')
      setMessages(prev => [...prev, { id: `local-${Date.now()}`, body: text, timestamp: Date.now(), direction: 'outbound' }])
    } else { setSendError(res?.error ?? 'send failed') }
  }, [selected, reply, sending])

  const filtered = chats.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  if (status === 'disconnected') return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--bg)' }}>
      <div style={{ fontSize: 28, color: 'var(--dimmer)' }}>◈</div>
      <div style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 4, fontFamily: 'var(--font-mono)' }}>// WHATSAPP NOT CONNECTED</div>
      <button
        onClick={() => { void window.electronAPI?.waAPI?.connect() }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        style={{ padding: '8px 20px', fontSize: 9, letterSpacing: 2, border: '1px solid var(--accent)', color: 'var(--accent)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}
      >
        [ CONNECT ]
      </button>
    </div>
  )

  if (status === 'connecting') return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--bg)' }}>
      <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-mono)' }}>// CONNECTING...</span>
      <span style={{ animation: 'blink 1s infinite', color: 'var(--accent)' }}>█</span>
    </div>
  )

  if (status === 'qr') return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--bg)' }}>
      <div style={{ fontSize: 9, color: 'var(--accent)', letterSpacing: 3, fontFamily: 'var(--font-mono)' }}>// SCAN WITH WHATSAPP</div>
      {qr && <img src={qr} alt="WhatsApp QR" style={{ width: 200, height: 200, border: '1px solid var(--border-md)', padding: 8, background: '#fff' }} />}
      <div style={{ fontSize: 8, color: 'var(--dimmer)', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>
        WhatsApp → Linked Devices → Link a Device
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Chat list */}
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 32, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="// SEARCH..."
            style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text)', padding: '0 12px', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <span style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 3, fontFamily: 'var(--font-mono)' }}>// NO CHATS</span>
            </div>
          ) : filtered.map((c, i) => {
            const isSelected = c.id === selected?.id
            return (
              <div key={c.id} onClick={() => setSelected(c)}
                style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSelected ? 'var(--bg-hover)' : 'transparent', borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent', animation: 'fade-up 0.25s ease both', animationDelay: `${i * 0.04}s`, transition: 'background 0.15s ease' }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                    {c.unread && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                    <span style={{ fontFamily: 'var(--font-head)', fontWeight: c.unread ? 700 : 600, fontSize: 11, color: c.unread ? 'var(--accent)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  </div>
                  <span style={{ fontSize: 8, color: 'var(--dimmer)', flexShrink: 0, marginLeft: 6 }}>{c.timestamp ? relTime(c.timestamp) : ''}</span>
                </div>
                <div style={{ fontSize: 9, color: c.unread ? 'var(--text)' : 'var(--dim)', letterSpacing: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: c.unread ? 10 : 0 }}>{c.snippet || '—'}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Conversation */}
      {selected ? (
        <ConversationView
          name={selected.name} messages={messages} loading={msgLoading}
          reply={reply} setReply={setReply} sending={sending} sendError={sendError}
          onSend={() => void handleSend()}
        />
      ) : <EmptyConversation />}
    </div>
  )
}

// ─── MessagesPanel ────────────────────────────────────────────────────────────
type Tab = 'sms' | 'whatsapp'

export default function MessagesPanel() {
  const [tab, setTab] = useState<Tab>('sms')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header + tab bar */}
      <div style={{ height: 44, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16, flexShrink: 0, background: 'var(--bg-panel)' }}>
        <span style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 2, fontFamily: 'var(--font-head)', fontWeight: 700 }}>// COMMS</span>
        <span style={{ animation: 'blink 1.4s infinite', fontSize: 10, color: 'var(--dimmer)' }}>▌</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {(['sms', 'whatsapp'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              onMouseEnter={e => { if (tab !== t) e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { if (tab !== t) e.currentTarget.style.background = 'transparent' }}
              style={{ padding: '4px 10px', fontSize: 8, letterSpacing: 2, border: `1px solid ${tab === t ? 'var(--accent)' : 'var(--border-md)'}`, color: tab === t ? 'var(--accent)' : 'var(--dim)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s ease' }}>
              {t === 'sms' ? '[ SMS ]' : '[ WHATSAPP ]'}
            </button>
          ))}
        </div>
      </div>

      {/* Active tab content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {tab === 'sms' ? <SmsTab /> : <WhatsAppTab />}
      </div>
    </div>
  )
}
