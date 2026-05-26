export default function StatusBar({ time, vaultFileCount }: { time: string; vaultFileCount: number }) {
  return (
    <div style={{ height: 24, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', fontSize: 9, color: 'var(--dim)', background: 'var(--bg)', zIndex: 10, flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 24 }}>
        <span>◈ COMMAND CENTER: ACTIVE</span>
        <span>⬡ VAULT: {vaultFileCount} FILES</span>
        <span>▣ AGENTS: STANDBY</span>
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        <span style={{ color: 'var(--border-hi)' }}>EMBERFORGE LABS</span>
        <span>{time}</span>
      </div>
    </div>
  )
}
