import { useState, useEffect, useRef, useCallback } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import type { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import { computeLayout } from './utils/graphLayout'
import { GridBg } from './Shared'
import { relTimeShort } from './helpers'
import type { ScanResult, LayoutNode, LayoutResult } from './types'

const NODE_WIDTH  = 160
const NODE_HEIGHT = 36

const LAYER_LEGEND = [
  { key: 'page',      label: 'PAGES',      color: '#00d4ff' },
  { key: 'api',       label: 'API ROUTES', color: '#ffc200' },
  { key: 'component', label: 'COMPONENTS', color: '#00ffcc' },
  { key: 'util',      label: 'UTILS',      color: '#00d4ff44' },
  { key: 'other',     label: 'OTHER',      color: '#00d4ff22' },
]

const LAYER_BADGE: Record<string, string> = {
  page: 'PAGE', api: 'API ROUTE', component: 'COMPONENT', util: 'UTILITY', other: 'OTHER',
}

const BTN = {
  padding: '3px 8px',
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--dim)',
  fontFamily: "'Share Tech Mono'",
  fontSize: 10 as number,
  cursor: 'pointer' as const,
  letterSpacing: 1 as number,
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 8, color: 'var(--dimmer)', letterSpacing: 3, marginBottom: 6, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
      // {text}
    </div>
  )
}

function pointsToPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`
  }
  return d
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

type Props = {
  repoPath: string
  projectName?: string
}

export default function ProjectArchMap({ repoPath, projectName }: Props) {
  const [status, setStatus]               = useState<'idle' | 'scanning' | 'error' | 'ready'>('idle')
  const [scanResult, setScanResult]       = useState<ScanResult | null>(null)
  const [layout, setLayout]               = useState<LayoutResult | null>(null)
  const [error, setError]                 = useState('')
  const [hoveredId, setHoveredId]         = useState<string | null>(null)
  const [selectedNode, setSelectedNode]   = useState<LayoutNode | null>(null)
  const [searchQuery, setSearchQuery]     = useState('')
  const [isPanning, setIsPanning]         = useState(false)
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['page', 'api', 'component', 'util', 'other']))
  const [confirmed, setConfirmed]         = useState(false)

  const transformRef = useRef<ReactZoomPanPinchContentRef>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fitToViewport = useCallback(() => {
    if (!containerRef.current || !transformRef.current || !layout) return
    const { offsetWidth: w, offsetHeight: h } = containerRef.current
    const scale = Math.min(w / layout.width, h / layout.height) * 0.9
    transformRef.current.setTransform(
      (w - layout.width  * scale) / 2,
      (h - layout.height * scale) / 2,
      scale,
      300
    )
  }, [layout])

  const runScan = useCallback(async (rescan = false) => {
    if (!repoPath) { setStatus('idle'); return }
    setStatus('scanning')
    setConfirmed(false)
    setSelectedNode(null)
    setSearchQuery('')
    const api = window.electronAPI?.archmapAPI
    if (!api) { setStatus('error'); setError('archmapAPI not available'); return }
    try {
      const result = rescan ? await api.rescan(repoPath) : await api.scan(repoPath)
      if ('error' in result) { setStatus('error'); setError(result.error); return }
      setScanResult(result)
      setLayout(computeLayout(result))
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [repoPath])

  const navigateToNode = useCallback((target: LayoutNode) => {
    setSelectedNode(target)
    if (!containerRef.current || !transformRef.current) return
    const { offsetWidth: w, offsetHeight: h } = containerRef.current
    const { scale } = transformRef.current.state
    transformRef.current.setTransform(
      w / 2 - target.x * scale,
      h / 2 - target.y * scale,
      scale,
      300
    )
  }, [])

  useEffect(() => { void runScan() }, [runScan])

  // ── idle ──────────────────────────────────────────────────────────────────
  if (!repoPath) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: 'var(--bg)' }}>
        <GridBg />
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 11, color: 'var(--accent)', letterSpacing: 2 }}>// NO REPO PATH CONFIGURED</div>
          <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 9, color: 'var(--dimmer)', marginTop: 8 }}>Set repo path in project settings</div>
        </div>
      </div>
    )
  }

  // ── scanning ──────────────────────────────────────────────────────────────
  if (status === 'scanning') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: 'var(--bg)' }}>
        <GridBg />
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 11, color: 'var(--accent)', letterSpacing: 2 }}>
            {'// SCANNING '}{projectName ? projectName.toUpperCase() : '...'}
            <span style={{ animation: 'blink 1s step-end infinite' }}>_</span>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 9, color: 'var(--dim)', marginTop: 8 }}>reading files and mapping dependencies</div>
        </div>
      </div>
    )
  }

  // ── error ─────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: 'var(--bg)' }}>
        <GridBg />
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 11, color: '#ff4444', letterSpacing: 2 }}>// SCAN FAILED</div>
          <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 9, color: '#ff4444', marginTop: 6 }}>{error}</div>
          <button
            onClick={() => void runScan()}
            style={{ marginTop: 14, padding: '5px 14px', background: 'transparent', border: '1px solid #ff4444', color: '#ff4444', fontFamily: "'Share Tech Mono'", fontSize: 9, letterSpacing: 2, cursor: 'pointer' }}
          >
            RETRY
          </button>
        </div>
      </div>
    )
  }

  // ── large-project warning ─────────────────────────────────────────────────
  if (status === 'ready' && scanResult && scanResult.nodes.length > 150 && !confirmed) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: 'var(--bg)' }}>
        <GridBg />
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 11, color: 'var(--accent)', letterSpacing: 2 }}>
            // LARGE PROJECT — {scanResult.nodes.length} FILES DETECTED
          </div>
          <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 9, color: 'var(--dim)', marginTop: 8 }}>
            Rendering may be slow on first load
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
            <button
              onClick={() => setConfirmed(true)}
              style={{ padding: '5px 14px', background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)', fontFamily: "'Share Tech Mono'", fontSize: 9, letterSpacing: 2, cursor: 'pointer' }}
            >
              RENDER ANYWAY
            </button>
            <button
              onClick={() => setStatus('idle')}
              style={{ padding: '5px 14px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--dim)', fontFamily: "'Share Tech Mono'", fontSize: 9, letterSpacing: 2, cursor: 'pointer' }}
            >
              CANCEL
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── ready ─────────────────────────────────────────────────────────────────
  if (!layout || !scanResult) return null

  const meta     = scanResult.meta
  const query    = searchQuery.toLowerCase().trim()
  const nodeById = new Map(layout.nodes.map(n => [n.id, n]))

  const isMatch = (node: LayoutNode) =>
    !query || node.label.toLowerCase().includes(query) || node.path.toLowerCase().includes(query)

  const isLayerVisible = (layer: string) => activeFilters.has(layer)

  const nodeOpacity = (node: LayoutNode): number => {
    if (!isLayerVisible(node.layer)) return 0
    if (query && !isMatch(node)) return 0.1
    return 1
  }

  const edgeStroke = (source: string, target: string): string => {
    const highlighted = hoveredId === source || hoveredId === target ||
      selectedNode?.id === source || selectedNode?.id === target
    if (highlighted) return '#00d4ff88'
    if (!query) return '#00d4ff18'
    const srcNode = nodeById.get(source)
    const tgtNode = nodeById.get(target)
    if ((srcNode && isMatch(srcNode)) || (tgtNode && isMatch(tgtNode))) return '#00d4ff44'
    return '#00d4ff08'
  }

  const edgeOpacity = (source: string, target: string): number => {
    const srcLayer = nodeById.get(source)?.layer ?? 'other'
    const tgtLayer = nodeById.get(target)?.layer ?? 'other'
    return (!isLayerVisible(srcLayer) && !isLayerVisible(tgtLayer)) ? 0 : 1
  }

  const imports    = selectedNode
    ? scanResult.edges.filter(e => e.source === selectedNode.id).map(e => nodeById.get(e.target)).filter((n): n is LayoutNode => n !== undefined)
    : []
  const importedBy = selectedNode
    ? scanResult.edges.filter(e => e.target === selectedNode.id).map(e => nodeById.get(e.source)).filter((n): n is LayoutNode => n !== undefined)
    : []

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, background: 'var(--bg-panel)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: "'Share Tech Mono'", fontSize: 10, color: 'var(--accent)', letterSpacing: 2, marginRight: 4 }}>// ARCH MAP</span>
          <span style={{ fontFamily: "'Share Tech Mono'", fontSize: 8, color: 'var(--dimmer)', letterSpacing: 1 }}>
            {meta.totalFiles} FILES · {meta.totalEdges} EDGES · scanned {relTimeShort(meta.scannedAt)}
          </span>
          <div style={{ flex: 1 }} />
          <button style={BTN} onClick={() => transformRef.current?.zoomOut()}>−</button>
          <button style={BTN} onClick={() => transformRef.current?.zoomIn()}>+</button>
          <button style={BTN} onClick={fitToViewport}>⊡</button>
          <button onClick={() => void runScan(true)} style={{ ...BTN, fontSize: 9, letterSpacing: 2, padding: '3px 10px' }}>RESCAN</button>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="// SEARCH FILES..."
            style={{ width: 160, padding: '3px 8px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: "'Share Tech Mono'", fontSize: 9, outline: 'none', letterSpacing: 1 }}
          />
        </div>
        {/* Row 2: legend dots */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {LAYER_LEGEND.map(l => (
            <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
              <span style={{ fontFamily: "'Share Tech Mono'", fontSize: 8, color: 'var(--dimmer)', letterSpacing: 1 }}>{l.label}</span>
            </div>
          ))}
        </div>
        {/* Row 3: layer filter toggles */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {LAYER_LEGEND.map(l => {
            const active = activeFilters.has(l.key)
            return (
              <button
                key={l.key}
                onClick={() => setActiveFilters(prev => {
                  const next = new Set(prev)
                  if (next.has(l.key)) next.delete(l.key)
                  else next.add(l.key)
                  return next
                })}
                style={{ padding: '2px 8px', background: 'transparent', border: `1px solid ${active ? l.color : 'var(--border)'}`, color: active ? l.color : 'var(--dimmer)', fontFamily: "'Share Tech Mono'", fontSize: 8, letterSpacing: 2, cursor: 'pointer', transition: 'all 0.15s ease' }}
              >
                {l.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Canvas + detail panel row ────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Canvas */}
        <div
          ref={containerRef}
          style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'var(--bg)', cursor: isPanning ? 'grabbing' : 'grab' }}
        >
          <TransformWrapper
            ref={transformRef}
            minScale={0.2}
            maxScale={2.0}
            limitToBounds={false}
            onPanningStart={() => setIsPanning(true)}
            onPanningStop={() => setIsPanning(false)}
          >
            <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
              <svg width={layout.width} height={layout.height} style={{ display: 'block' }}>
                <defs>
                  <marker id="arrow" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#00d4ff44" />
                  </marker>
                </defs>

                {layout.edges.map((edge, i) => (
                  <path
                    key={i}
                    d={pointsToPath(edge.points)}
                    stroke={edgeStroke(edge.source, edge.target)}
                    strokeWidth={1}
                    fill="none"
                    opacity={edgeOpacity(edge.source, edge.target)}
                    markerEnd="url(#arrow)"
                  />
                ))}

                {layout.nodes.map(node => {
                  const opacity    = nodeOpacity(node)
                  const isSelected = selectedNode?.id === node.id
                  const isHovered  = hoveredId === node.id
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x - NODE_WIDTH / 2}, ${node.y - NODE_HEIGHT / 2})`}
                      onClick={() => opacity > 0 ? setSelectedNode(isSelected ? null : node) : undefined}
                      onMouseEnter={() => opacity > 0 ? setHoveredId(node.id) : undefined}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{ cursor: opacity > 0 ? 'pointer' : 'default', pointerEvents: opacity === 0 ? 'none' : 'auto' }}
                    >
                      <rect
                        width={NODE_WIDTH}
                        height={NODE_HEIGHT}
                        fill="var(--bg-panel)"
                        stroke={node.color}
                        strokeWidth={isSelected || isHovered ? 2 : 1}
                        opacity={opacity}
                      />
                      <text
                        x={8}
                        y={NODE_HEIGHT / 2}
                        dominantBaseline="middle"
                        fill={node.color}
                        fontSize={10}
                        fontFamily="Share Tech Mono"
                        textAnchor="start"
                        opacity={opacity}
                      >
                        {truncate(node.label, 18)}
                      </text>
                      <circle
                        cx={NODE_WIDTH - 10}
                        cy={NODE_HEIGHT / 2}
                        r={3}
                        fill={node.color}
                        opacity={opacity}
                      />
                    </g>
                  )
                })}
              </svg>
            </TransformComponent>
          </TransformWrapper>
        </div>

        {/* ── Detail panel ──────────────────────────────────────────────── */}
        <div style={{
          width: selectedNode ? 280 : 0,
          flexShrink: 0,
          overflow: 'hidden',
          borderLeft: selectedNode ? '1px solid var(--border)' : 'none',
          background: 'var(--bg-panel)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s ease',
        }}>
          {selectedNode ? (
            <div style={{ width: 280, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Header */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--accent2)', letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedNode.label}
                  </div>
                  {/* Show actual filename when @label overrides the display name */}
                  {selectedNode.label !== selectedNode.path.split('/').pop() && (
                    <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 8, color: 'var(--dimmer)', letterSpacing: 1, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedNode.path.split('/').pop()}
                    </div>
                  )}
                  <div style={{ marginTop: 5, display: 'inline-block', padding: '1px 6px', border: `1px solid ${selectedNode.color}`, color: selectedNode.color, fontFamily: "'Share Tech Mono'", fontSize: 7, letterSpacing: 2 }}>
                    {LAYER_BADGE[selectedNode.layer] ?? selectedNode.layer.toUpperCase()}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--dim)', fontFamily: "'Share Tech Mono'", fontSize: 14, cursor: 'pointer', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
                >
                  ×
                </button>
              </div>

              {/* Scrollable sections */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* PATH */}
                <div>
                  <SectionLabel text="PATH" />
                  <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 9, color: 'var(--dim)', wordBreak: 'break-all', lineHeight: 1.7 }}>
                    {selectedNode.path}
                  </div>
                </div>

                {/* OVERVIEW */}
                {selectedNode.overview && (
                  <div>
                    <SectionLabel text="OVERVIEW" />
                    <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 10, color: 'var(--text)', lineHeight: 1.8, fontStyle: 'italic' }}>
                      {selectedNode.overview}
                    </div>
                  </div>
                )}

                {/* DEPENDS ON */}
                {selectedNode.depends.length > 0 && (
                  <div>
                    <SectionLabel text="DEPENDS ON" />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {selectedNode.depends.map(dep => (
                        <span key={dep} style={{ padding: '2px 8px', border: '1px solid var(--border-md, var(--border))', fontFamily: "'Share Tech Mono'", fontSize: 8, color: 'var(--dim)', letterSpacing: 1 }}>
                          {dep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* IMPORTS */}
                <div>
                  <SectionLabel text={`IMPORTS (${imports.length})`} />
                  {imports.length === 0
                    ? <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 9, color: 'var(--dimmer)' }}>—</div>
                    : imports.map(n => (
                        <div
                          key={n.id}
                          onClick={() => navigateToNode(n)}
                          style={{ fontFamily: "'Share Tech Mono'", fontSize: 9, color: 'var(--dim)', cursor: 'pointer', padding: '3px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.1s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = 'var(--accent)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = 'var(--dim)' }}
                        >
                          {n.label}
                        </div>
                      ))
                  }
                </div>

                {/* IMPORTED BY */}
                <div>
                  <SectionLabel text={`IMPORTED BY (${importedBy.length})`} />
                  {importedBy.length === 0
                    ? <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 9, color: 'var(--dimmer)' }}>—</div>
                    : importedBy.map(n => (
                        <div
                          key={n.id}
                          onClick={() => navigateToNode(n)}
                          style={{ fontFamily: "'Share Tech Mono'", fontSize: 9, color: 'var(--dim)', cursor: 'pointer', padding: '3px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.1s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = 'var(--accent)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = 'var(--dim)' }}
                        >
                          {n.label}
                        </div>
                      ))
                  }
                </div>

                {/* EXTERNAL DEPS */}
                {selectedNode.externals.length > 0 && (
                  <div>
                    <SectionLabel text="EXTERNAL DEPS" />
                    {selectedNode.externals.map(ext => (
                      <div key={ext} style={{ fontFamily: "'Share Tech Mono'", fontSize: 9, color: '#b44dff', padding: '3px 0' }}>
                        {ext}
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          ) : (
            <div style={{ width: 280, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: "'Share Tech Mono'", fontSize: 9, color: 'var(--dimmer)', letterSpacing: 2 }}>// CLICK A NODE TO INSPECT</div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
