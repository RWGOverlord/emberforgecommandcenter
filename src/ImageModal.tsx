import { useEffect } from 'react'

export default function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(2, 8, 16, 0.95)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'img-modal-in 0.15s ease both',
      }}
    >
      <style>{`
        @keyframes img-modal-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .img-modal-img {
          animation: img-modal-scale 0.15s ease both;
        }
        @keyframes img-modal-scale {
          from { transform: scale(0.95); }
          to   { transform: scale(1); }
        }
      `}</style>
      <button
        onClick={onClose}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--dim)' }}
        style={{
          position: 'absolute', top: 20, right: 20,
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
          color: 'var(--dim)', padding: 0,
        }}
      >
        [ CLOSE ]
      </button>
      <img
        src={src}
        alt=""
        className="img-modal-img"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '90vw', maxHeight: '90vh',
          objectFit: 'contain',
          border: '1px solid var(--border-md)',
        }}
      />
    </div>
  )
}
