/** Wording and image nudges saved with the appearance. Keys are per screen. */

const SEP = '\u001f'
const TEXT_SELECTOR = 'h1,h2,h3,h4,p,button,a,li,figcaption,label,span,em,strong'

export type ImageNudge = { scale: number; x: number; y: number }

export type ElementStyle = { color?: string; background?: string }

export type AddedItem =
  | { kind: 'text'; after: string; text: string }
  | { kind: 'image'; after: string; src: string; alt?: string }

export type ThemeContent = {
  copy: Record<string, string>
  images: Record<string, ImageNudge>
  blocks: Record<string, ImageNudge>
  styles: Record<string, ElementStyle>
  added: Record<string, AddedItem>
}

export const THEME_CONTENT_EDIT = 'legacy-theme-edit'

export function emptyContent(): ThemeContent {
  return { copy: {}, images: {}, blocks: {}, styles: {}, added: {} }
}

function collectAdded(input: unknown) {
  const out: Record<string, AddedItem> = {}
  const src = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  for (const [key, value] of Object.entries(src)) {
    if (Object.keys(out).length >= 100) break
    if (!validKey(key) || !key.includes(`${SEP}add:`) || !value || typeof value !== 'object') continue
    const raw = value as Record<string, unknown>
    if (typeof raw.after !== 'string' || !validKey(raw.after)) continue
    if (raw.kind === 'text') {
      const text = sanitizeRich(typeof raw.text === 'string' ? raw.text.trim() : '')
      if (text && text.length <= 2000) out[key] = { kind: 'text', after: raw.after, text }
    } else if (raw.kind === 'image') {
      const url = typeof raw.src === 'string' ? raw.src.trim() : ''
      if (!/^https:\/\/\S+$/.test(url) || url.length > 1000) continue
      const alt = typeof raw.alt === 'string' ? raw.alt.trim().slice(0, 300) : ''
      out[key] = { kind: 'image', after: raw.after, src: url, ...(alt ? { alt } : {}) }
    }
  }
  return out
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function sanitizeContent(input: unknown): ThemeContent {
  const src = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const copyIn = src.copy && typeof src.copy === 'object' ? src.copy as Record<string, unknown> : {}
  const imagesIn = src.images && typeof src.images === 'object' ? src.images as Record<string, unknown> : {}
  const blocksIn = src.blocks && typeof src.blocks === 'object' ? src.blocks as Record<string, unknown> : {}
  const copy: Record<string, string> = {}
  for (const [key, value] of Object.entries(copyIn)) {
    if (Object.keys(copy).length >= 800) break
    if (!validKey(key) || typeof value !== 'string') continue
    const text = sanitizeRich(value.trim())
    if (!text || text.length > 2000) continue
    const original = key.split(SEP).slice(1).join(SEP)
    if (text === original) continue
    copy[key] = text
  }
  const images: Record<string, ImageNudge> = {}
  const blocks: Record<string, ImageNudge> = {}
  collectNudges(imagesIn, images, 200)
  collectNudges(blocksIn, blocks, 200)
  const stylesIn = src.styles && typeof src.styles === 'object' ? src.styles as Record<string, unknown> : {}
  const styles: Record<string, ElementStyle> = {}
  for (const [key, value] of Object.entries(stylesIn)) {
    if (Object.keys(styles).length >= 400) break
    if (!validKey(key) || !value || typeof value !== 'object') continue
    const raw = value as Record<string, unknown>
    const style: ElementStyle = {}
    if (typeof raw.color === 'string' && HEX_COLOR.test(raw.color)) style.color = raw.color.toLowerCase()
    if (typeof raw.background === 'string' && HEX_COLOR.test(raw.background)) style.background = raw.background.toLowerCase()
    if (style.color || style.background) styles[key] = style
  }
  return { copy, images, blocks, styles, added: collectAdded(src.added) }
}

function collectNudges(input: Record<string, unknown>, out: Record<string, ImageNudge>, limit: number) {
  for (const [key, value] of Object.entries(input)) {
    if (Object.keys(out).length >= limit) break
    if (!validKey(key) || !value || typeof value !== 'object') continue
    const raw = value as Record<string, unknown>
    const scale = clamp(Math.round(Number(raw.scale) * 100) / 100, 0.5, 2)
    const x = clamp(Math.round(Number(raw.x)), -480, 480)
    const y = clamp(Math.round(Number(raw.y)), -480, 480)
    if (!Number.isFinite(scale) || !Number.isFinite(x) || !Number.isFinite(y)) continue
    if (scale === 1 && x === 0 && y === 0) continue
    out[key] = { scale, x, y }
  }
}

function validKey(key: string) {
  if (key.length < 3 || key.length > 4000 || !key.startsWith('/')) return false
  const parts = key.split(SEP)
  return parts.length >= 2 && parts.every((part) => part.length > 0 && part.length < 2500)
}

let current = emptyContent()
let selectedKey = ''
let observer: MutationObserver | null = null
let editingBound = false
let notify: ((content: ThemeContent) => void) | null = null
let onSelect: ((info: { key: string; scale: number; label: string } | null) => void) | null = null
let editEnabled = false
let applying = false

export function setContentListener(fn: ((content: ThemeContent) => void) | null) {
  notify = fn
}

export function setSelectionListener(fn: typeof onSelect) {
  onSelect = fn
}

export function setEditEnabled(on: boolean) {
  editEnabled = on
  document.documentElement.classList.toggle('la-theme-edit', on)
  if (!on) {
    selectedKey = ''
    document.querySelector('[data-la-popover]')?.remove()
    onSelect?.(null)
    applyNow()
  }
}

export function setBlockScale(key: string, scale: number) {
  const prev = readNudge(key)
  writeNudge(key, { ...prev, scale: clamp(scale, 0.5, 2) })
  commit()
}

export function resetBlock(key: string) {
  writeNudge(key, { scale: 1, x: 0, y: 0 })
  commit()
}

export function watchContent(content: ThemeContent, mode: 'live' | 'edit') {
  current = content
  applyNow()
  if (!observer && document.body) {
    let queued = false
    observer = new MutationObserver(() => {
      if (applying || queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        applyNow()
      })
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  }
  if (mode === 'edit') {
    editEnabled = true
    document.documentElement.classList.add('la-theme-edit')
    bindEditing()
  }
}

export function applyNow() {
  if (!document.body) return
  applying = true
  try {
    applyAdded()
    applyCopy()
    applyImages()
    applyBlocks()
  } finally {
    applying = false
  }
}

let uploadImage: ((file: File) => Promise<string>) | null = null

export function setImageUploader(fn: typeof uploadImage) {
  uploadImage = fn
}

function addedPrefix() {
  return `${location.pathname}${SEP}add:`
}

function applyAdded() {
  const prefix = addedPrefix()
  const items = Object.entries(current.added)
    .filter(([key]) => key.startsWith(prefix))
    .sort(([a], [b]) => (a < b ? -1 : 1))
  const wanted = new Set(items.map(([key]) => key.slice(prefix.length)))
  for (const node of document.querySelectorAll<HTMLElement>('[data-la-added]')) {
    if (!wanted.has(node.dataset.laAdded || '')) node.remove()
  }
  if (!items.length) return
  const needed = new Set(items.map(([, item]) => item.after))
  const anchors = new Map<string, HTMLElement>()
  for (const el of document.querySelectorAll<HTMLElement>('body *')) {
    if (el.hasAttribute('data-la-added') || el.closest('[data-la-editor], script, style, svg')) continue
    const key = blockKey(el)
    if (needed.has(key) && !anchors.has(key)) anchors.set(key, el)
  }
  for (const [key, item] of items) {
    const id = key.slice(prefix.length)
    let node = document.querySelector<HTMLElement>(`[data-la-added="${CSS.escape(id)}"]`)
    const anchor = anchors.get(item.after)
    if (!anchor) {
      node?.remove()
      continue
    }
    const tag = item.kind === 'image' ? 'IMG' : 'P'
    if (!node || node.tagName !== tag) {
      node?.remove()
      node = document.createElement(tag)
      node.dataset.laAdded = id
      node.style.cssText = item.kind === 'image'
        ? 'display:block;width:min(100%, 520px);height:auto;margin:16px 0;border-radius:var(--la-radius-card)'
        : 'margin:12px 0;white-space:pre-wrap'
      if (item.kind === 'text') matchText(node, anchor)
    }
    if (item.kind === 'image' && node instanceof HTMLImageElement) {
      if (node.getAttribute('src') !== item.src) node.src = item.src
      if (node.alt !== (item.alt ?? '')) node.alt = item.alt ?? ''
    } else if (item.kind === 'text') {
      if (hasMarkup(item.text)) {
        if (node.dataset.laHtml !== item.text) fillRich(node, item.text)
      } else if (node.textContent !== item.text) {
        node.textContent = item.text
        delete node.dataset.laHtml
      }
    }
    let ref: Element = anchor
    for (let next = ref.nextElementSibling; next && next !== node && next.hasAttribute('data-la-added'); next = ref.nextElementSibling) {
      if ((next as HTMLElement).dataset.laAdded! > id) break
      ref = next
    }
    if (ref.nextElementSibling !== node) ref.after(node)
  }
}

function matchText(node: HTMLElement, anchor: HTMLElement) {
  const source = /^(P|LI|FIGCAPTION|BLOCKQUOTE)$/.test(anchor.tagName)
    ? anchor
    : anchor.querySelector<HTMLElement>('p') ?? anchor.parentElement?.querySelector<HTMLElement>(':scope > p') ?? null
  if (!source) {
    const bg = shownBackground(anchor).slice(1)
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(bg.slice(i, i + 2), 16))
    node.style.color = r * 0.299 + g * 0.587 + b * 0.114 < 140 ? 'var(--la-on-dark)' : 'var(--la-ink)'
    return
  }
  const shown = getComputedStyle(source)
  node.style.color = shown.color
  node.style.fontFamily = shown.fontFamily
  node.style.fontSize = shown.fontSize
  node.style.lineHeight = shown.lineHeight
}

function textNodes(el: HTMLElement) {
  return [...el.childNodes].filter((node): node is Text => (
    node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
  ))
}

const MAX_TEXT = 2000
const TEXT_ATTRS = ['placeholder', 'aria-label', 'alt', 'title'] as const

function sourceOf(shown: string) {
  const prefix = `${location.pathname}${SEP}`
  for (const [key, value] of Object.entries(current.copy)) {
    if (value === shown && key.startsWith(prefix)) return key.slice(prefix.length)
  }
  return shown
}

function sanitizeRich(value: string) {
  const doc = new DOMParser().parseFromString(`<div>${value}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return ''
  let out = ''
  const walk = (node: Node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) out += child.textContent || ''
      else if (child instanceof HTMLElement) {
        const tag = child.tagName
        if (tag === 'B' || tag === 'STRONG') { out += '<b>'; walk(child); out += '</b>' }
        else if (tag === 'I' || tag === 'EM') { out += '<i>'; walk(child); out += '</i>' }
        else if (tag === 'BR') out += '\n'
        else if (tag === 'DIV' || tag === 'P') {
          if (out && !out.endsWith('\n')) out += '\n'
          walk(child)
        } else walk(child)
      }
    }
  }
  walk(root)
  return out.replace(/<b>\s*<\/b>|<i>\s*<\/i>/g, '').replace(/\n+$/g, '').trim()
}

function hasMarkup(value: string) {
  return /<\/?[bi]>/.test(value)
}

function fillRich(host: HTMLElement, value: string) {
  host.replaceChildren()
  const clean = sanitizeRich(value)
  host.dataset.laHtml = clean
  const stack: HTMLElement[] = [host]
  for (const part of clean.split(/(<\/?b>|<\/?i>|\n)/)) {
    if (part === '<b>' || part === '<i>') {
      const el = document.createElement(part === '<b>' ? 'b' : 'i')
      stack[stack.length - 1].append(el)
      stack.push(el)
    } else if (part === '</b>' || part === '</i>') {
      if (stack.length > 1) stack.pop()
    } else if (part === '\n') stack[stack.length - 1].append(document.createElement('br'))
    else if (part) stack[stack.length - 1].append(document.createTextNode(part))
  }
}

function paintString(raw: string, next: string) {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === next) return raw
  const start = raw.indexOf(trimmed)
  if (start < 0) return next
  return raw.slice(0, start) + next + raw.slice(start + trimmed.length)
}

const paintedText = new Map<Text, string>()

function showCopy(node: Text, original: string, next: string) {
  if (hasMarkup(next)) {
    const span = document.createElement('span')
    span.dataset.laRich = original
    fillRich(span, next)
    node.replaceWith(span)
    paintedText.delete(node)
    return
  }
  const plain = next.replace(/<\/?[bi]>/g, '')
  if ((node.textContent?.trim() || '') !== plain) node.textContent = paintString(node.textContent || '', plain)
}

function applyCopy() {
  const path = location.pathname
  for (const span of document.querySelectorAll<HTMLElement>('[data-la-rich]')) {
    if (span.closest('[data-la-editor]')) continue
    const original = span.dataset.laRich || ''
    const next = current.copy[`${path}${SEP}${original}`]
    if (!next || !hasMarkup(next)) span.replaceWith(document.createTextNode(next ? next.replace(/<\/?[bi]>/g, '') : original))
    else if (span.dataset.laHtml !== next) fillRich(span, next)
  }
  for (const [node, original] of paintedText) {
    if (!node.isConnected) {
      paintedText.delete(node)
      continue
    }
    showCopy(node, original, current.copy[`${path}${SEP}${original}`] || original)
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const text = node as Text
    const parent = text.parentElement
    node = walker.nextNode()
    if (!parent || parent.closest('[data-la-editor], [data-la-added], [data-la-rich], script, style, svg')) continue
    const trimmed = text.textContent?.trim() || ''
    if (!trimmed || trimmed.length > MAX_TEXT) continue
    const next = current.copy[`${path}${SEP}${trimmed}`]
    if (!next || next === trimmed) continue
    paintedText.set(text, trimmed)
    showCopy(text, trimmed, next)
  }
  const attrSelector = TEXT_ATTRS.flatMap((attr) => [`[${attr}]`, `[data-la-src-${attr}]`]).join(',')
  for (const el of document.querySelectorAll<HTMLElement>(attrSelector)) {
    if (el.closest('[data-la-editor], [data-la-added], script, style')) continue
    for (const attr of TEXT_ATTRS) {
      const marked = el.getAttribute(`data-la-src-${attr}`)
      const raw = el.getAttribute(attr)?.trim() || ''
      const original = marked || raw
      if (!original || original.length > MAX_TEXT) continue
      const next = current.copy[`${path}${SEP}${original}`]
      const shown = (next || original).replace(/<\/?[bi]>/g, '')
      if (el.getAttribute(attr)?.trim() !== shown) el.setAttribute(attr, shown)
      if (next) el.setAttribute(`data-la-src-${attr}`, original)
      else el.removeAttribute(`data-la-src-${attr}`)
    }
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
    ...document.querySelectorAll<HTMLImageElement>('img:not([data-la-added])'),
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

const BLOCK_SELECTOR = 'section, article, header, footer, nav, main, h1, h2, h3, h4, p, button, a, li, img, figure, form, [data-la-frame]'

function blockKey(el: HTMLElement) {
  if (el.dataset.laAdded) return `${location.pathname}${SEP}block:add:${el.dataset.laAdded}`
  const parts: string[] = []
  let node: HTMLElement | null = el
  let depth = 0
  while (node && node !== document.body && depth < 7) {
    const parent: HTMLElement | null = node.parentElement
    if (!parent) break
    let index = 1
    for (const sib of parent.children) {
      if (sib === node) break
      if (sib.tagName === node.tagName && !sib.hasAttribute('data-la-added')) index += 1
    }
    parts.unshift(`${node.tagName.toLowerCase()}${index}`)
    node = parent
    depth += 1
  }
  return `${location.pathname}${SEP}block:${parts.join('.')}`
}

function nudgeKey(el: HTMLElement) {
  if (el.dataset.laAdded) return blockKey(el)
  if (el instanceof HTMLImageElement || el.hasAttribute('data-la-frame')) return imageKey(el)
  return blockKey(el)
}

function isBlockKey(key: string) {
  return key.includes(`${SEP}block:`)
}

function readNudge(key: string): ImageNudge {
  return (isBlockKey(key) ? current.blocks[key] : current.images[key]) ?? { scale: 1, x: 0, y: 0 }
}

function writeNudge(key: string, nudge: ImageNudge) {
  const clear = nudge.scale === 1 && nudge.x === 0 && nudge.y === 0
  if (isBlockKey(key)) {
    const blocks = { ...current.blocks }
    if (clear) delete blocks[key]
    else blocks[key] = nudge
    current = { ...current, blocks }
    return
  }
  const images = { ...current.images }
  if (clear) delete images[key]
  else images[key] = nudge
  current = { ...current, images }
}

function pickElement(target: Element): HTMLElement | null {
  const block = target.closest(BLOCK_SELECTOR)
  if (block instanceof HTMLElement) return block
  if (target instanceof HTMLElement && target !== document.body && target.id !== 'root') return target
  return null
}

function applyBlocks() {
  const everything = editEnabled
    || Object.keys(current.blocks).length > 0
    || Object.keys(current.styles).length > 0
  const els = everything
    ? document.querySelectorAll<HTMLElement>('body *')
    : document.querySelectorAll<HTMLElement>('[data-la-moved], [data-la-styled], .la-picked')
  for (const el of els) {
    if (el.closest('[data-la-editor], script, style, svg')) continue
    const key = blockKey(el)
    paintStyle(el, key)
    if ((el instanceof HTMLImageElement || el.hasAttribute('data-la-frame')) && !el.dataset.laAdded) continue
    paintNudge(el, key)
  }
}

function paintStyle(el: HTMLElement, key: string) {
  const style = current.styles[key]
  if (!style) {
    if (el.dataset.laStyled) {
      el.style.color = el.dataset.laColor0 ?? ''
      el.style.backgroundColor = el.dataset.laBg0 ?? ''
      el.style.backgroundImage = el.dataset.laBgImage0 ?? ''
      delete el.dataset.laStyled
      delete el.dataset.laColor0
      delete el.dataset.laBg0
      delete el.dataset.laBgImage0
    }
    return
  }
  if (!el.dataset.laStyled) {
    el.dataset.laColor0 = el.style.color
    el.dataset.laBg0 = el.style.backgroundColor
    el.dataset.laBgImage0 = el.style.backgroundImage
    el.dataset.laStyled = '1'
  }
  const color = style.color ?? el.dataset.laColor0 ?? ''
  const background = style.background ?? el.dataset.laBg0 ?? ''
  const image = style.background ? 'none' : el.dataset.laBgImage0 ?? ''
  if (el.style.color !== color) el.style.color = color
  if (el.style.backgroundColor !== background) el.style.backgroundColor = background
  if (el.style.backgroundImage !== image) el.style.backgroundImage = image
}

function writeStyle(key: string, patch: ElementStyle) {
  const styles = { ...current.styles }
  const next: ElementStyle = { ...styles[key], ...patch }
  if (!next.color) delete next.color
  if (!next.background) delete next.background
  if (next.color || next.background) styles[key] = next
  else delete styles[key]
  current = { ...current, styles }
}

function toHex(value: string) {
  for (const match of value.matchAll(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/g)) {
    if (match[4] !== undefined && Number(match[4]) < 0.5) continue
    return `#${[match[1], match[2], match[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`
  }
  return null
}

function shownBackground(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  const stack = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + Math.min(rect.height / 2, 12))
  for (const layer of stack) {
    if (!(layer instanceof HTMLElement) || layer.closest('[data-la-editor]')) continue
    const shown = getComputedStyle(layer)
    const hex = toHex(shown.backgroundImage) ?? toHex(shown.backgroundColor)
    if (hex) return hex
  }
  let node: HTMLElement | null = el
  while (node) {
    const shown = getComputedStyle(node)
    const hex = toHex(shown.backgroundImage) ?? toHex(shown.backgroundColor)
    if (hex) return hex
    node = node.parentElement
  }
  return '#ffffff'
}

function paintNudge(el: HTMLElement, key: string) {
  const nudge = isBlockKey(key) ? current.blocks[key] : current.images[key]
  el.classList.toggle('la-picked', key === selectedKey)
  if (!nudge) {
    if (el.dataset.laMoved) {
      el.style.transform = ''
      el.style.zIndex = ''
      el.style.position = ''
      delete el.dataset.laMoved
    }
    return
  }
  const transform = `translate(${nudge.x}px, ${nudge.y}px) scale(${nudge.scale})`
  if (el.style.transform !== transform) el.style.transform = transform
  el.style.transformOrigin = 'center center'
  el.style.zIndex = '2'
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
  el.dataset.laMoved = '1'
}

function announce(el: HTMLElement, key: string) {
  const nudge = readNudge(key)
  const label = (textNodes(el)[0]?.textContent || el.getAttribute('data-la-frame') || el.tagName).trim().slice(0, 48)
  onSelect?.({ key, scale: nudge.scale, label })
}

function commit() {
  current = sanitizeContent(current)
  applyNow()
  notify?.(current)
  if (window.parent !== window) {
    window.parent.postMessage({ type: THEME_CONTENT_EDIT, content: current }, location.origin)
  }
}

function bindEditing() {
  if (editingBound) return
  editingBound = true
  document.documentElement.classList.add('la-theme-edit')
  const style = document.createElement('style')
  const textCursor = TEXT_SELECTOR.split(',').map((tag) => `html.la-theme-edit ${tag.trim()}`).join(',')
  const blockCursor = BLOCK_SELECTOR.split(',').map((tag) => `html.la-theme-edit ${tag.trim()}`).join(',')
  style.textContent = `
    ${textCursor} { cursor: text; }
    html.la-theme-edit, html.la-theme-edit * { cursor: text; }
    ${blockCursor} { cursor: grab; }
    html.la-theme-edit img, html.la-theme-edit [data-la-frame] { cursor: grab; }
    html.la-theme-edit .la-picked { outline: 2px solid var(--la-sienna); outline-offset: 3px; }
    [data-la-editor], [data-la-editor] * { cursor: auto; }
  `
  document.head.appendChild(style)

  let drag: { key: string; el: HTMLElement; pointer: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null
  let suppressClick = false

  document.addEventListener('pointerdown', (event) => {
    if (!editEnabled) return
    const target = event.target
    if (!(target instanceof Element) || target.closest('[data-la-editor], [data-la-nav]')) return
    const block = pickElement(target)
    if (!block) return
    const key = nudgeKey(block)
    const nudge = readNudge(key)
    selectedKey = key
    drag = { key, el: block, pointer: event.pointerId, sx: event.clientX, sy: event.clientY, ox: nudge.x, oy: nudge.y, moved: false }
    block.setPointerCapture?.(event.pointerId)
  }, true)

  document.addEventListener('pointermove', (event) => {
    if (!editEnabled || !drag || event.pointerId !== drag.pointer) return
    const dx = event.clientX - drag.sx
    const dy = event.clientY - drag.sy
    if (!drag.moved && Math.hypot(dx, dy) < 5) return
    drag.moved = true
    const prev = readNudge(drag.key)
    writeNudge(drag.key, { ...prev, x: clamp(drag.ox + dx, -480, 480), y: clamp(drag.oy + dy, -480, 480) })
    applyNow()
    syncImageSlider(drag.key)
  }, true)

  document.addEventListener('pointerup', (event) => {
    if (!drag || event.pointerId !== drag.pointer) return
    const moved = drag.moved
    const key = drag.key
    const el = drag.el
    drag = null
    if (moved) {
      suppressClick = true
      commit()
      if (el.isConnected) announce(el, key)
    }
  }, true)

  document.addEventListener('click', (event) => {
    if (!editEnabled) return
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('[data-la-editor]')) {
      suppressClick = false
      return
    }
    if (suppressClick) {
      suppressClick = false
      event.preventDefault()
      event.stopPropagation()
      return
    }
    const frame = target.closest('img, [data-la-frame]')
    const wording = frame instanceof HTMLImageElement ? null : wordingAt(event)
    const el = frame instanceof HTMLElement && !wording ? frame : pickElement(wording?.anchor ?? target)
    if (!el) return
    event.preventDefault()
    event.stopPropagation()
    const key = nudgeKey(el)
    selectedKey = key
    applyNow()
    announce(el, key)
    openPanel(el, wording)
  }, true)

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !editEnabled) return
    closePanel()
  })
}

export function closePanel() {
  document.querySelector('[data-la-popover]')?.remove()
  selectedKey = ''
  onSelect?.(null)
  applyNow()
}

function readAttr(el: HTMLElement) {
  if (el.closest('[data-la-editor], script, style')) return ''
  for (const attr of TEXT_ATTRS) {
    const value = el.getAttribute(attr)?.trim() || ''
    if (value && value.length <= MAX_TEXT) return value
  }
  return ''
}

function wordingFromNode(node: Node | null): { anchor: HTMLElement; shown: string } | null {
  if (!node) return null
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node as Text
    const parent = text.parentElement
    const shown = text.textContent?.trim() || ''
    if (!parent || !shown || shown.length > MAX_TEXT) return null
    if (parent.closest('[data-la-editor], script, style')) return null
    const rich = parent.closest<HTMLElement>('[data-la-rich]')
    if (rich?.dataset.laRich) return { anchor: rich, shown: rich.dataset.laRich }
    if (parent.closest('svg')) {
      const host = parent.closest('svg')?.parentElement
      const label = host ? readAttr(host) : ''
      return label ? { anchor: host as HTMLElement, shown: label } : null
    }
    return { anchor: parent, shown }
  }
  if (node instanceof HTMLElement) {
    const label = readAttr(node)
    if (label) return { anchor: node, shown: label }
  }
  return null
}

function wordingAt(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Element) || target.closest('[data-la-editor]')) return null
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  const pointed = doc.caretPositionFromPoint?.(event.clientX, event.clientY)?.offsetNode
    ?? doc.caretRangeFromPoint?.(event.clientX, event.clientY)?.startContainer
    ?? null
  const fromPoint = wordingFromNode(pointed)
  if (fromPoint) return fromPoint
  let el: Element | null = target
  for (let depth = 0; el && el !== document.body && depth < 4; depth += 1) {
    if (el instanceof HTMLElement) {
      const direct = [...el.childNodes].find((child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())
      const fromChild = wordingFromNode(direct ?? null)
      if (fromChild) return fromChild
      const label = readAttr(el)
      if (label) return { anchor: el, shown: label }
    }
    el = el.parentElement
  }
  return null
}

function editorShell() {
  let shell = document.querySelector<HTMLElement>('[data-la-popover]')
  if (shell) return shell
  shell = document.createElement('div')
  shell.setAttribute('data-la-popover', '')
  shell.setAttribute('data-la-editor', '')
  shell.style.cssText = [
    'position:fixed', 'z-index:100002', 'width:min(290px, calc(100vw - 24px))',
    'background:var(--la-card)', 'color:var(--la-ink)', 'border:1px solid var(--la-line)',
    'border-radius:12px', 'padding:12px', 'box-shadow:0 12px 32px rgba(36,28,21,.18)',
    'font-family:var(--la-sans, "Source Sans 3", sans-serif)', 'font-size:14px',
  ].join(';')
  document.body.appendChild(shell)
  return shell
}

function place(shell: HTMLElement, anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect()
  const w = shell.offsetWidth
  const h = shell.offsetHeight
  const bar = document.querySelector('[data-la-editor]:not([data-la-popover])')?.getBoundingClientRect()
  const floor = (bar ? bar.top : window.innerHeight) - 8
  const clampTop = (y: number) => Math.max(8, Math.min(y, floor - h))
  const clampLeft = (x: number) => Math.max(8, Math.min(x, window.innerWidth - w - 8))
  let top: number
  let left = clampLeft(rect.left)
  if (rect.bottom + 8 + h <= floor) top = rect.bottom + 8
  else if (rect.top - 8 - h >= 8) top = rect.top - 8 - h
  else {
    top = clampTop(rect.top)
    if (rect.right + 8 + w <= window.innerWidth - 8) left = rect.right + 8
    else if (rect.left - 8 - w >= 8) left = rect.left - 8 - w
    else left = window.innerWidth - w - 8
  }
  shell.style.top = `${top}px`
  shell.style.left = `${left}px`
}

function kindOf(el: HTMLElement) {
  if (el instanceof HTMLImageElement || el.hasAttribute('data-la-frame')) return 'Image'
  const tag = el.tagName
  if (/^H[1-6]$/.test(tag)) return 'Heading'
  if (tag === 'BUTTON') return 'Button'
  if (tag === 'A') return 'Link'
  if (['P', 'SPAN', 'EM', 'STRONG', 'LI', 'LABEL', 'SMALL', 'FIGCAPTION'].includes(tag)) return 'Text'
  return 'Box'
}

function fieldLabel(text: string) {
  const el = document.createElement('div')
  el.textContent = text
  el.style.cssText = 'font-size:12.5px;color:var(--la-ink-2);margin:10px 0 4px'
  return el
}

function swatch(label: string, value: string, onChange: (hex: string) => void) {
  const wrap = document.createElement('label')
  wrap.style.cssText = 'display:flex;align-items:center;gap:8px;flex:1;min-width:0;font-size:13px;color:var(--la-ink);cursor:pointer'
  const input = document.createElement('input')
  input.type = 'color'
  input.value = value
  input.style.cssText = 'width:30px;height:30px;padding:0;border:1px solid var(--la-line);border-radius:6px;background:transparent;cursor:pointer;flex:0 0 auto'
  input.addEventListener('input', () => onChange(input.value))
  wrap.append(input, label)
  return wrap
}

function flowAnchor(el: HTMLElement) {
  let node = el
  while (node.parentElement && node.parentElement !== document.body && node.parentElement.id !== 'root') {
    const display = getComputedStyle(node).display
    const parent = node.parentElement
    const inText = parent.closest('p, h1, h2, h3, h4, button, a, label, li')
    if (!display.startsWith('inline') && !inText) break
    node = parent
  }
  return node
}

function addedKeyOf(el: HTMLElement) {
  return `${addedPrefix()}${el.dataset.laAdded}`
}

function panelHead(shell: HTMLElement, label: string) {
  const head = document.createElement('div')
  head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px'
  const title = document.createElement('strong')
  title.textContent = label
  title.style.cssText = 'font-size:14px;font-weight:600'
  const close = document.createElement('button')
  close.type = 'button'
  close.setAttribute('aria-label', 'Close')
  close.textContent = '×'
  close.style.cssText = 'border:none;background:transparent;font-size:20px;line-height:1;color:var(--la-ink-2);cursor:pointer;padding:0 4px'
  close.addEventListener('click', () => { commit(); closePanel() })
  head.append(title, close)
  shell.append(head)
}

function pickPicture(onPicked: (url: string) => void, status: HTMLElement) {
  if (!uploadImage) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/jpeg,image/png,image/webp,image/gif'
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file || !uploadImage) return
    const before = status.textContent
    status.textContent = 'Uploading…'
    try {
      onPicked(await uploadImage(file))
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : 'Could not upload'
      return
    }
    status.textContent = before
  })
  input.click()
}

function addAfter(el: HTMLElement, item: { kind: 'text'; text: string } | { kind: 'image'; src: string }) {
  const anchor = el.dataset.laAdded ? el : flowAnchor(el)
  const after = anchor.dataset.laAdded
    ? current.added[addedKeyOf(anchor)]?.after
    : blockKey(anchor)
  if (!after) return
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const key = `${addedPrefix()}${id}`
  current = { ...current, added: { ...current.added, [key]: { ...item, after } } }
  commit()
  const node = document.querySelector<HTMLElement>(`[data-la-added="${CSS.escape(id)}"]`)
  if (!node) return
  selectedKey = blockKey(node)
  applyNow()
  node.scrollIntoView({ block: 'nearest' })
  const open = () => openAddedPanel(node)
  if (node instanceof HTMLImageElement && !node.complete) node.addEventListener('load', open, { once: true })
  open()
}

function addRow(el: HTMLElement) {
  const row = document.createElement('div')
  row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--la-line)'
  const label = document.createElement('span')
  label.textContent = 'Add after this'
  label.style.cssText = 'font-size:12.5px;color:var(--la-ink-2);flex:1'
  const text = button('+ Text', false)
  text.addEventListener('click', () => addAfter(el, { kind: 'text', text: 'New text' }))
  row.append(label, text)
  if (uploadImage) {
    const picture = button('+ Picture', false)
    picture.addEventListener('click', () => pickPicture((src) => addAfter(el, { kind: 'image', src }), label))
    row.append(picture)
  }
  return row
}

function sizeSlider(key: string) {
  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = '50'
  slider.max = '200'
  slider.value = String(Math.round(readNudge(key).scale * 100))
  slider.dataset.laSlider = key
  slider.style.cssText = 'width:100%'
  slider.addEventListener('input', () => {
    writeNudge(key, { ...readNudge(key), scale: Number(slider.value) / 100 })
    commit()
  })
  return slider
}

function richField(value: string, onChange: (next: string) => void) {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'margin-top:10px'
  const tools = document.createElement('div')
  tools.style.cssText = 'display:flex;gap:6px;margin-bottom:6px'
  const field = document.createElement('div')
  field.contentEditable = 'true'
  field.setAttribute('role', 'textbox')
  field.spellcheck = true
  field.style.cssText = 'width:100%;box-sizing:border-box;min-height:72px;max-height:180px;overflow:auto;padding:8px 10px;border:1px solid var(--la-line);border-radius:6px;background:var(--la-paper);color:var(--la-ink);font:inherit;white-space:pre-wrap'
  if (hasMarkup(value)) fillRich(field, value)
  else field.textContent = value
  const mark = (label: string, name: string, command: 'bold' | 'italic') => {
    const el = document.createElement('button')
    el.type = 'button'
    el.textContent = label
    el.setAttribute('aria-label', name)
    el.style.cssText = `width:32px;height:32px;font-family:inherit;background:transparent;color:var(--la-ink);border:1px solid var(--la-line);border-radius:6px;cursor:pointer;${command === 'bold' ? 'font-weight:700' : 'font-style:italic'}`
    el.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      field.focus()
      document.execCommand('styleWithCss', false, 'false')
      document.execCommand(command)
      onChange(sanitizeRich(field.innerHTML))
    })
    return el
  }
  tools.append(mark('B', 'Bold', 'bold'), mark('I', 'Italic', 'italic'))
  field.addEventListener('input', () => onChange(sanitizeRich(field.innerHTML)))
  wrap.append(tools, field)
  return { wrap, field }
}

function openAddedPanel(el: HTMLElement) {
  const key = addedKeyOf(el)
  const item = current.added[key]
  if (!item) return
  const styleKey = blockKey(el)
  const shell = editorShell()
  shell.innerHTML = ''
  panelHead(shell, item.kind === 'image' ? 'Your picture' : 'Your text')

  let field: HTMLElement | null = null
  const status = document.createElement('span')
  status.style.cssText = 'font-size:12.5px;color:var(--la-ink-2);flex:1'
  if (item.kind === 'text') {
    const editor = richField(item.text, (text) => {
      if (!text.replace(/<\/?[bi]>/g, '').trim()) return
      current = { ...current, added: { ...current.added, [key]: { ...item, text } } }
      commit()
    })
    field = editor.field
    shell.append(editor.wrap)
    const colors = document.createElement('div')
    colors.style.cssText = 'display:flex;gap:12px;margin-top:12px'
    colors.append(swatch('Text', current.styles[styleKey]?.color ?? toHex(getComputedStyle(el).color) ?? '#241c15', (hex) => {
      writeStyle(styleKey, { color: hex })
      commit()
    }))
    colors.append(swatch('Background', current.styles[styleKey]?.background ?? shownBackground(el), (hex) => {
      writeStyle(styleKey, { background: hex })
      commit()
    }))
    shell.append(colors)
  } else {
    const replace = button('Replace picture', false)
    replace.style.marginTop = '10px'
    replace.addEventListener('click', () => pickPicture((src) => {
      current = { ...current, added: { ...current.added, [key]: { ...item, src } } }
      commit()
    }, status))
    shell.append(replace)
  }

  shell.append(fieldLabel('Size'), sizeSlider(styleKey))

  const foot = document.createElement('div')
  foot.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px'
  status.textContent = 'Drag it on the page to move.'
  const remove = button('Delete', false)
  remove.style.color = 'var(--la-error)'
  remove.addEventListener('click', () => {
    const added = { ...current.added }
    delete added[key]
    const styles = { ...current.styles }
    delete styles[styleKey]
    const blocks = { ...current.blocks }
    delete blocks[styleKey]
    current = { ...current, added, styles, blocks }
    commit()
    closePanel()
  })
  foot.append(status, remove)
  shell.append(foot, addRow(el))

  place(shell, el)
  if (field) {
    field.focus()
    if (field.textContent === 'New text') {
      const range = document.createRange()
      range.selectNodeContents(field)
      const selection = getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }
}

function openPanel(el: HTMLElement, wording: { anchor: HTMLElement; shown: string } | null) {
  const added = el.closest<HTMLElement>('[data-la-added]')
  if (added) {
    openAddedPanel(added)
    return
  }
  const moveKey = nudgeKey(el)
  const colorEl = wording?.anchor ?? el
  const colorKey = blockKey(colorEl)
  const backKey = blockKey(el)
  const isImage = kindOf(el) === 'Image'
  const original = wording ? sourceOf(wording.shown.trim()) : ''
  const copyKey = wording ? `${location.pathname}${SEP}${original}` : ''

  const shell = editorShell()
  shell.innerHTML = ''
  panelHead(shell, kindOf(wording?.anchor ?? el))

  let field: HTMLElement | null = null
  if (wording) {
    const editor = richField(current.copy[copyKey] ?? wording.shown.trim(), (text) => {
      const copy = { ...current.copy }
      const plain = text.replace(/<\/?[bi]>/g, '').trim()
      if (!plain || text === original) delete copy[copyKey]
      else copy[copyKey] = text
      current = { ...current, copy }
      commit()
    })
    field = editor.field
    shell.append(editor.wrap)
  }

  const colors = document.createElement('div')
  colors.style.cssText = 'display:flex;gap:12px;margin-top:12px'
  if (!isImage) {
    colors.append(swatch('Text', current.styles[colorKey]?.color ?? toHex(getComputedStyle(colorEl).color) ?? '#241c15', (hex) => {
      writeStyle(colorKey, { color: hex })
      commit()
    }))
  }
  colors.append(swatch('Background', current.styles[backKey]?.background ?? shownBackground(el), (hex) => {
    writeStyle(backKey, { background: hex })
    commit()
  }))
  shell.append(colors)

  shell.append(fieldLabel('Size'), sizeSlider(moveKey))

  const foot = document.createElement('div')
  foot.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px'
  const hint = document.createElement('span')
  hint.textContent = 'Drag it on the page to move.'
  hint.style.cssText = 'font-size:12.5px;color:var(--la-ink-2)'
  const reset = button('Undo changes', false)
  reset.addEventListener('click', () => {
    const copy = { ...current.copy }
    if (copyKey) delete copy[copyKey]
    const styles = { ...current.styles }
    delete styles[colorKey]
    delete styles[backKey]
    current = { ...current, copy, styles }
    writeNudge(moveKey, { scale: 1, x: 0, y: 0 })
    commit()
    openPanel(el, wording ? { anchor: wording.anchor, shown: original } : null)
  })
  foot.append(hint, reset)
  shell.append(foot, addRow(el))

  place(shell, wording?.anchor ?? el)
  field?.focus()
}

function syncImageSlider(key: string) {
  const slider = document.querySelector<HTMLInputElement>(`[data-la-slider="${CSS.escape(key)}"]`)
  const nudge = readNudge(key)
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
