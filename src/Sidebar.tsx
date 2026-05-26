import type { VaultNode } from './types'
import { NAV_ITEMS } from './types'

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

export default function Sidebar({ active, onSelect, vaultTree, vaultLoading, vaultError, selectedGame, onSelectGame, onChooseVaultPath }: SidebarProps) {
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
