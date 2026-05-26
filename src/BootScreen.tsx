import { GridBg } from './Shared'

export default function BootScreen({ lines }: { lines: string[] }) {
  return (
    <div style={{
      width: '100%', height: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-mono)', color: 'var(--accent)',
      fontSize: 12, gap: 6, padding: 40,
      position: 'relative', overflow: 'hidden',
      animation: 'flicker 6s infinite',
    }}>
      <GridBg />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, minWidth: 460 }}>
        <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 20, letterSpacing: 8, alignSelf: 'center' }}>
          EMBERFORGE LABS // COMMAND CENTER
        </div>
        {lines.map((line, i) => (
          <div key={i} style={{
            animation: 'fade-up 0.3s ease both',
            color: i === lines.length - 1 ? 'var(--accent2)' : 'var(--dim)',
            letterSpacing: 0.5,
          }}>{line}</div>
        ))}
        <span style={{ animation: 'blink 1s infinite', marginTop: 4, color: 'var(--accent)' }}>█</span>
      </div>
    </div>
  )
}
