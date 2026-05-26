import { useState, useEffect } from 'react'
import type { QuickLaunchApp } from './NodePanel'
import { SYSTEM_CATEGORIES } from './types'
import { applyFontSize } from './helpers'
import { GridBg } from './Shared'

const DEFAULT_QUICK_LAUNCH: QuickLaunchApp[] = [
  { label: 'VS CODE', path: '/Applications/Visual Studio Code.app' },
  { label: 'BRAVE',   path: '/Applications/Brave Browser.app' },
]

function ConnectionsPanel() {
  const [pbKey,          setPbKey]          = useState('')
  const [pbSaved,        setPbSaved]        = useState(false)
  const [anthropicKey,   setAnthropicKey]   = useState('')
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

export default function SystemPanel({ category, onVaultSaved, onQuickLaunchSaved }: {
  category: string
  onVaultSaved?: () => void
  onQuickLaunchSaved?: (apps: QuickLaunchApp[]) => void
}) {
  const [brightness, setBrightness] = useState(85)
  const [textMode,   setTextMode]   = useState<'dim' | 'mid' | 'bright'>('mid')
  const [fontSize,   setFontSize]   = useState<'S' | 'M' | 'L'>('S')
  const [vaultPath,  setVaultPath]  = useState<string | null>(null)
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
                  flex: 1, padding: '6px 0', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
                  background: 'transparent', border: `1px solid ${textMode === mode ? 'var(--accent)' : 'var(--border-md)'}`,
                  color: textMode === mode ? 'var(--accent)' : 'var(--dimmer)', cursor: 'pointer', textTransform: 'uppercase',
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
                onClick={() => { setFontSize(s); applyFontSize(s); void window.electronAPI?.settingsAPI?.set('fontSize', s) }}
                style={{
                  flex: 1, padding: '6px 0', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
                  background: 'transparent', border: `1px solid ${fontSize === s ? 'var(--accent)' : 'var(--border-md)'}`,
                  color: fontSize === s ? 'var(--accent)' : 'var(--dimmer)', cursor: 'pointer',
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
    if (category === 'about') return stub('// ABOUT',
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
