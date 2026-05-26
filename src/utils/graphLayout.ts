import * as dagre from 'dagre'
import type { ScanResult, LayoutNode, LayoutEdge, LayoutResult } from '../types'

const LAYER_COLORS: Record<string, string> = {
  page:      '#00d4ff',
  api:       '#ffc200',
  component: '#00ffcc',
  util:      '#00d4ff44',
  other:     '#00d4ff22',
}

const NODE_WIDTH  = 160
const NODE_HEIGHT = 36
const RANK_SEP    = 120
const NODE_SEP    = 20

export function computeLayout(scanResult: ScanResult): LayoutResult {
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: 'LR',
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
    marginx: 40,
    marginy: 40,
  })
  g.setDefaultEdgeLabel(() => ({}))

  scanResult.nodes.forEach(node => {
    g.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      ...node,
    })
  })

  scanResult.edges.forEach(edge => {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  })

  dagre.layout(g)

  const layoutNodes: LayoutNode[] = scanResult.nodes.map(node => {
    const { x, y } = g.node(node.id) as { x: number; y: number }
    return {
      ...node,
      x,
      y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      color: LAYER_COLORS[node.layer] ?? LAYER_COLORS['other'],
    }
  })

  const layoutEdges: LayoutEdge[] = scanResult.edges
    .filter(e => g.hasNode(e.source) && g.hasNode(e.target))
    .map(edge => ({
      ...edge,
      points: (g.edge(edge.source, edge.target) as { points?: { x: number; y: number }[] })?.points ?? [],
    }))

  const maxX = Math.max(...layoutNodes.map(n => n.x + NODE_WIDTH))
  const maxY = Math.max(...layoutNodes.map(n => n.y + NODE_HEIGHT))

  return {
    nodes: layoutNodes,
    edges: layoutEdges,
    width:  maxX + 80,
    height: maxY + 80,
  }
}
