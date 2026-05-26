import { useState, useEffect } from 'react'
import type { VaultNode, Project } from './types'
import { NAV_ITEMS, SYSTEM_CATEGORIES } from './types'
import { relativeTime } from './helpers'

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

export default function MiddlePanel({ section, selected, onSelect, vaultTree, selectedGame, selectedFile, onSelectFile, projects, onAddProject }: MiddlePanelProps) {
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
