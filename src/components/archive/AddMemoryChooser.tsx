import { CTA } from '../../design/copy'
import { T, radius, sans, serif } from '../../design/tokens'
import { Body, Btn } from '../../design/ui'

export default function AddMemoryChooser({
  open,
  onClose,
  onTalk,
  onWrite,
  onPhoto,
}: {
  open: boolean
  onClose: () => void
  onTalk: () => void
  onWrite: () => void
  onPhoto: () => void
}) {
  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(43,36,28,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440, background: T.card,
          border: `1px solid ${T.line}`, borderRadius: radius.md,
          padding: '26px 28px', boxShadow: '0 24px 48px rgba(43,36,28,.18)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ fontFamily: serif, fontSize: 26, color: T.ink }}>{CTA.addMemory}</div>
        <Body size={15}>Talk, write, or add a photograph. The structured interviews are done — the archive stays open.</Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
          <Btn onClick={onTalk}>Talk</Btn>
          <Btn tone="quiet" onClick={onWrite}>Write</Btn>
          <Btn tone="quiet" onClick={onPhoto}>Add a photograph</Btn>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none', border: 'none', padding: 0, marginTop: 4, cursor: 'pointer',
            fontFamily: sans, fontSize: 13.5, color: T.ink3, textDecoration: 'underline',
            textAlign: 'left',
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
