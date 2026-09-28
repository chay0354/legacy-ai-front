/** Wording and image nudges saved with the appearance. Keys are per screen. */

const SEP = '\u001f'
const TEXT_SELECTOR = 'h1,h2,h3,h4,p,button,a,li,figcaption,label,span,em,strong'

export type ImageNudge = { scale: number; x: number; y: number }

export type ThemeContent = {
  copy: Record<string, string>
  images: Record<string, ImageNudge>
}

export const THEME_CONTENT_EDIT = 'legacy-theme-edit'

export function emptyContent(): ThemeContent {
  return { copy: {}, images: {} }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function sanitizeContent(input: unknown): ThemeContent {
  const src = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const copyIn = src.copy && typeof src.copy === 'object' ? src.copy as Record<string, unknown> : {}
  const imagesIn = src.images && typeof src.images === 'object' ? src.images as Record<string, unknown> : {}
  const copy: Record<string, string> = {}
  for (const [key, value] of Object.entries(copyIn)) {
    if (Object.keys(copy).length >= 80) break
    if (!validKey(key) || typeof value !== 'string') continue
    const text = value.trim()
    if (!text || text.length > 400) continue
    const original = key.split(SEP).slice(1).join(SEP)
    if (text === original) continue
    copy[key] = text
  }
  const images: Record<string, ImageNudge> = {}
  for (const [key, value] of Object.entries(imagesIn)) {
    if (Object.keys(images).length >= 80) break
    if (!validKey(key) || !value || typeof value !== 'object') continue
    const raw = value as Record<string, unknown>
    const scale = clamp(Math.round(Number(raw.scale) * 100) / 100, 0.6, 1.8)
    const x = clamp(Math.round(Number(raw.x)), -240, 240)
    const y = clamp(Math.round(Number(raw.y)), -240, 240)
    if (!Number.isFinite(scale) || !Number.isFinite(x) || !Number.isFinite(y)) continue
    if (scale === 1 && x === 0 && y === 0) continue
    images[key] = { scale, x, y }
  }
  return { copy, images }
}

function validKey(key: string) {
  if (key.length < 3 || key.length > 360 || !key.startsWith('/')) return false
  const parts = key.split(SEP)
  return parts.length >= 2 && parts.every((part) => part.length > 0 && part.length < 220)
}

let current = emptyContent()
let selectedKey = ''
let observer: MutationObserver | null = null
let editingBound = false
let notify: ((content: ThemeContent) => void) | null = null
let applying = false

export function watchContent(content: ThemeContent, mode: 'live' | 'edit') {
  current = content
  applyNow()
  if (!observer && document.body) {
    observer = new MutationObserver(() => {
      if (!applying) applyNow()
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  }
  if (mode === 'edit') bindEditing()
}

export function applyNow() {
  if (!document.body) return
  applying = true
  try {
    applyCopy()
    applyImages()
  } finally {
    applying = false
  }
}

function textNodes(el: HTMLElement) {
  return [...el.childNodes].filter((node): node is Text => (
    node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
  ))
}

function applyCopy() {
  const path = location.pathname
  for (const el of document.querySelectorAll<HTMLElement>(TEXT_SELECTOR)) {
    if (el.closest('[data-la-editor]')) continue
    const nodes = textNodes(el)
    if (nodes.length !== 1) continue
    const marked = el.getAttribute('data-la-copy')
    const direct = nodes[0].textContent?.trim() || ''
    const original = marked || direct
    if (!original) continue
    if (!marked) el.setAttribute('data-la-copy', original)
    const next = current.copy[`${path}${SEP}${original}`]
    const shown = next ?? original
    if (nodes[0].textContent?.trim() !== shown) nodes[0].textContent = shown
  }
}

function imageKey(el: HTMLElement) {
  const frame = el.closest('[data-la-frame]')
  if (frame instanceof HTMLElement) {
    const label = frame.getAttribute('data-la-frame') || 'image'
    const same = [...document.querySelectorAll('[data-la-frame]')].filter((item) => item.getAttribute('data-la-frame') === label)
    return `${location.pathname}${SEP}frame:${label}${SEP}${Math.max(0, same.indexOf(frame))}`
  }
  let srcPath = 'image'
  if (el instanceof HTMLImageElement) {
    try { srcPath = new URL(el.currentSrc || el.src, location.origin).pathname } catch { srcPath = 'image' }
  }
  const same = [...document.querySelectorAll('img')].filter((img) => {
    try { return new URL(img.currentSrc || img.src, location.origin).pathname === srcPath } catch { return false }
  })
  return `${location.pathname}${SEP}${srcPath}${SEP}${Math.max(0, same.findIndex((img) => img === el))}`
}

function applyImages() {
  const visuals = [
    ...document.querySelectorAll<HTMLImageElement>('img'),
    ...[...document.querySelectorAll<HTMLElement>('[data-la-frame]')].filter((frame) => !frame.querySelector('img')),
  ]
  for (const el of visuals) {
    const key = imageKey(el)
    const nudge = current.images[key]
    const picked = key === selectedKey
    el.classList.toggle('la-picked', picked)
    if (!nudge) {
      if (el.dataset.laMoved) {
        el.style.transform = ''
        el.style.zIndex = ''
        el.style.position = ''
        delete el.dataset.laMoved
      }
      continue
    }
    const transform = `translate(${nudge.x}px, ${nudge.y}px) scale(${nudge.scale})`
    if (el.style.transform !== transform) el.style.transform = transform
    el.style.transformOrigin = 'center center'
    el.style.zIndex = '2'
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
    el.dataset.laMoved = '1'
  }
}

function commit() {
  current = sanitizeContent(current)
  applyNow()
  notify?.(current)
}

function bindEditing() {
  if (editingBound) return
  editingBound = true
  document.documentElement.classList.add('la-theme-edit')
  const style = document.createElement('style')
  const textCursor = TEXT_SELECTOR.split(',').map((tag) => `html.la-theme-edit ${tag.trim()}`).join(',')
  style.textContent = `
    ${textCursor} { cursor: text; }
    html.la-theme-edit img, html.la-theme-edit [data-la-frame] { cursor: grab; }
    html.la-theme-edit .la-picked { outline: 2px solid var(--la-sienna); outline-offset: 3px; }
    [data-la-editor] button, [data-la-editor] textarea, [data-la-editor] input { cursor: auto; }
  `
  document.head.appendChild(style)

  let drag: { key: string; pointer: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null

  document.addEventListener('pointerdown', (event) => {
    const target = event.target
    if (!(target instanceof Element) || target.closest('[data-la-editor]')) return
    const visual = visualFrom(target)
    if (!visual || (textFrom(target) && !(target instanceof HTMLImageElement))) return
    event.preventDefault()
    event.stopPropagation()
    const key = imageKey(visual)
    selectedKey = key
    const nudge = current.images[key] ?? { scale: 1, x: 0, y: 0 }
    drag = { key, pointer: event.pointerId, sx: event.clientX, sy: event.clientY, ox: nudge.x, oy: nudge.y, moved: false }
    openImage(visual, key)
    visual.setPointerCapture?.(event.pointerId)
  }, true)

  document.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointer) return
    const dx = event.clientX - drag.sx
    const dy = event.clientY - drag.sy
    if (!drag.moved && Math.hypot(dx, dy) < 4) return
    drag.moved = true
    const prev = current.images[drag.key] ?? { scale: 1, x: 0, y: 0 }
    current = {
      ...current,
      images: { ...current.images, [drag.key]: { ...prev, x: clamp(drag.ox + dx, -240, 240), y: clamp(drag.oy + dy, -240, 240) } },
    }
    applyNow()
    syncImageSlider(drag.key)
  }, true)

  document.addEventListener('pointerup', (event) => {
    if (!drag || event.pointerId !== drag.pointer) return
    const moved = drag.moved
    drag = null
    if (moved) commit()
  }, true)

  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element) || target.closest('[data-la-editor]')) return
    const text = textFrom(target)
    if (!text) return
    event.preventDefault()
    event.stopPropagation()
    selectedKey = ''
    openText(text)
  }, true)

  notify = (content) => {
    window.parent.postMessage({ type: THEME_CONTENT_EDIT, content }, location.origin)
  }
}

function visualFrom(target: Element) {
  const img = target.closest('img')
  if (img instanceof HTMLImageElement) return img
  const frame = target.closest('[data-la-frame]')
  if (frame instanceof HTMLElement && !frame.querySelector('img')) return frame
  return null
}

function textFrom(target: Element) {
  if (target.closest('[data-la-editor], input, textarea')) return null
  const el = target.closest(TEXT_SELECTOR)
  if (!(el instanceof HTMLElement)) return null
  const nodes = textNodes(el)
  if (nodes.length !== 1) return null
  const text = nodes[0].textContent?.trim() || ''
  if (!text || text.length > 400 || /^\$\d/.test(text)) return null
  return el
}

function editorShell() {
  let shell = document.querySelector<HTMLElement>('[data-la-editor]')
  if (shell) return shell
  shell = document.createElement('div')
  shell.setAttribute('data-la-editor', '')
  shell.style.cssText = [
    'position:fixed', 'z-index:100000', 'width:min(300px, calc(100vw - 24px))',
    'background:var(--la-card)', 'color:var(--la-ink)', 'border:1px solid var(--la-line)',
    'border-radius:12px', 'padding:12px', 'box-shadow:0 12px 32px rgba(36,28,21,.18)',
    'font-family:var(--la-sans, "Source Sans 3", sans-serif)', 'font-size:14px',
  ].join(';')
  document.body.appendChild(shell)
  return shell
}

function place(shell: HTMLElement, anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect()
  const top = rect.bottom + 8 + shell.offsetHeight > window.innerHeight ? Math.max(8, rect.top - shell.offsetHeight - 8) : rect.bottom + 8
  shell.style.top = `${top}px`
  shell.style.left = `${Math.min(Math.max(8, rect.left), window.innerWidth - shell.offsetWidth - 8)}px`
}

function openText(el: HTMLElement) {
  const nodes = textNodes(el)
  if (nodes.length !== 1) return
  const original = el.getAttribute('data-la-copy') || nodes[0].textContent?.trim() || ''
  el.setAttribute('data-la-copy', original)
  const key = `${location.pathname}${SEP}${original}`
  const shell = editorShell()
  shell.innerHTML = ''
  const title = document.createElement('div')
  title.textContent = 'Edit text'
  title.style.cssText = 'font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px;color:var(--la-ink-2)'
  const field = document.createElement('textarea')
  field.value = current.copy[key] ?? original
  field.style.cssText = 'width:100%;box-sizing:border-box;min-height:72px;padding:8px;border:1px solid var(--la-line);border-radius:6px;background:var(--la-paper);color:var(--la-ink);font:inherit'
  const row = document.createElement('div')
  row.style.cssText = 'display:flex;gap:8px;margin-top:8px'
  const done = button('Done', true)
  const reset = button('Reset', false)
  field.addEventListener('input', () => {
    const text = field.value.trim()
    const copy = { ...current.copy }
    if (!text || text === original) delete copy[key]
    else copy[key] = text
    current = { ...current, copy }
    applyNow()
    commit()
  })
  done.addEventListener('click', () => { commit(); shell.remove() })
  reset.addEventListener('click', () => {
    const copy = { ...current.copy }
    delete copy[key]
    current = { ...current, copy }
    field.value = original
    commit()
  })
  row.append(done, reset)
  shell.append(title, field, row)
  place(shell, el)
  field.focus()
}

function openImage(el: HTMLElement, key: string) {
  const shell = editorShell()
  const nudge = current.images[key] ?? { scale: 1, x: 0, y: 0 }
  shell.innerHTML = ''
  const title = document.createElement('div')
  title.textContent = 'Image'
  title.style.cssText = 'font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px;color:var(--la-ink-2)'
  const label = document.createElement('label')
  label.style.cssText = 'display:flex;flex-direction:column;gap:4px'
  label.append('Size')
  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = '60'
  slider.max = '180'
  slider.value = String(Math.round(nudge.scale * 100))
  slider.dataset.laSlider = key
  const hint = document.createElement('div')
  hint.textContent = 'Drag the image to move it.'
  hint.style.cssText = 'margin-top:6px;color:var(--la-ink-2);font-size:13px'
  const reset = button('Reset', false)
  reset.style.marginTop = '8px'
  slider.addEventListener('input', () => {
    const prev = current.images[key] ?? { scale: 1, x: 0, y: 0 }
    current = { ...current, images: { ...current.images, [key]: { ...prev, scale: Number(slider.value) / 100 } } }
    applyNow()
    commit()
  })
  reset.addEventListener('click', () => {
    const images = { ...current.images }
    delete images[key]
    current = { ...current, images }
    slider.value = '100'
    commit()
  })
  label.append(slider)
  shell.append(title, label, hint, reset)
  place(shell, el)
}

function syncImageSlider(key: string) {
  const slider = document.querySelector<HTMLInputElement>(`[data-la-slider="${CSS.escape(key)}"]`)
  const nudge = current.images[key]
  if (slider && nudge) slider.value = String(Math.round(nudge.scale * 100))
}

function button(label: string, primary: boolean) {
  const el = document.createElement('button')
  el.type = 'button'
  el.textContent = label
  el.style.cssText = primary
    ? 'background:var(--la-sienna);color:var(--la-on-primary);border:none;border-radius:6px;padding:7px 12px;font:inherit'
    : 'background:transparent;color:var(--la-ink);border:1px solid var(--la-line);border-radius:6px;padding:7px 12px;font:inherit'
  return el
}
