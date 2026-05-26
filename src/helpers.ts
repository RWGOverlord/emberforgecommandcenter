import type { VaultNode } from './types'

export function applyFontSize(size: 'S' | 'M' | 'L') {
  document.documentElement.style.zoom = size === 'S' ? '1' : size === 'M' ? '1.15' : '1.3'
}

export function relTimeShort(ms: number): string {
  const diff  = Date.now() - ms
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)   return 'just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}hr ago`
  if (days  === 1) return 'yesterday'
  return `${days}d ago`
}

export function countVaultFiles(nodes: VaultNode[]): number {
  return nodes.reduce((acc, node) => {
    if (node.type === 'file' && (node.ext === '.md' || node.ext === '.txt')) return acc + 1
    if (node.type === 'folder' && node.children) return acc + countVaultFiles(node.children)
    return acc
  }, 0)
}

export function relativeTime(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  const weeks = Math.floor(days / 7)
  return `${weeks} week${weeks > 1 ? 's' : ''} ago`
}
