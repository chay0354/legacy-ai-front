import React from 'react'
import { ACTIONS, can, type Role } from '../lib/permissions'

const C = {
  card: '#fbf6ec',
  ink: '#2b241c',
  ink2: '#6e6253',
  ink3: '#9a8d79',
  line: '#ddccb0',
  cardLine: '#d8cbb0',
  terra: '#c06a44',
}
const serif = "'Newsreader', Georgia, serif"
const sans = "'Hanken Grotesk', system-ui, sans-serif"
export type GalleryItem = {
  id: string
  imageUrl: string | null
  caption: string
  title?: string
}

type Props = {
  role: Role
  items: GalleryItem[]
  onUpload?: () => void
  onDelete?: (id: string) => void
  /** View-only: no upload or delete controls (e.g. avatar main screen). */
  readOnly?: boolean
  /** When false, only the grid/empty state is shown (parent supplies the section title). */
  showHeader?: boolean
  style?: React.CSSProperties
}

export default function GallerySection({ role, items, onUpload, onDelete, readOnly = false, showHeader = true, style }: Props) {
  const canUpload = !readOnly && can(role, ACTIONS.UPLOAD_MEDIA)
  const canDelete = !readOnly && can(role, ACTIONS.UPLOAD_MEDIA)

  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardLine}`, borderRadius: 10, padding: '22px 24px', marginTop: showHeader ? 24 : 0, boxShadow: showHeader ? undefined : '0 14px 36px rgba(43,36,28,.07)', ...style }}>
      {showHeader && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: serif, fontSize: 20, color: C.ink }}>Gallery</div>
            <div style={{ fontFamily: sans, fontSize: 12.5, color: C.ink2, marginTop: 4 }}>Photos and the stories behind them</div>
          </div>
          {canUpload && onUpload && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onUpload(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onUpload(); } }}
              style={{ fontFamily: sans, fontSize: 12.5, fontWeight: 600, color: C.terra, cursor: 'pointer' }}
            >
              + Upload photo
            </span>
          )}
        </div>
      )}
      {!showHeader && canUpload && onUpload && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onUpload(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onUpload(); } }}
            style={{ fontFamily: sans, fontSize: 12.5, fontWeight: 600, color: C.terra, cursor: 'pointer' }}
          >
            + Upload photo
          </span>
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ fontSize: 13.5, color: C.ink3, padding: '8px 0 4px' }}>
          {canUpload ? 'No photos yet — upload faces, places, and letters your family should see.' : 'No gallery photos yet.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                border: `1px solid ${C.line}`,
                borderRadius: 10,
                overflow: 'hidden',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ aspectRatio: '4 / 3', background: '#e8dfd0', position: 'relative' }}>
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title || 'Gallery photo'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontStyle: 'italic', fontSize: 12, color: C.ink3 }}>
                    Photo unavailable
                  </div>
                )}
                {canDelete && onDelete && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                    aria-label="Remove photo"
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      border: `1px solid ${C.line}`,
                      background: 'rgba(251,246,236,.92)',
                      color: '#b04a3a',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    ⌫
                  </button>
                )}
              </div>
              <div style={{ padding: '12px 12px 14px' }}>
                {item.title && (
                  <div style={{ fontFamily: serif, fontSize: 15, color: C.ink, lineHeight: 1.2, marginBottom: 4 }}>{item.title}</div>
                )}
                <div style={{ fontFamily: sans, fontSize: 12.5, color: C.ink2, lineHeight: 1.45 }}>{item.caption}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
