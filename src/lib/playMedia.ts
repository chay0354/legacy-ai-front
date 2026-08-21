/** Chrome throws when play() is still pending and src / srcObject / load() changes. */

export function isPlayInterrupted(err: unknown): boolean {
  const name = err instanceof DOMException ? err.name : ''
  const msg = err instanceof Error ? err.message : String(err)
  return name === 'AbortError'
    || /interrupted by a (new load request|pause)/i.test(msg)
}

/** play() that ignores the expected interrupt / autoplay errors. */
export function playMedia(el: HTMLMediaElement | null | undefined): Promise<void> {
  if (!el) return Promise.resolve()
  return el.play().then(() => undefined).catch((err: unknown) => {
    if (isPlayInterrupted(err)) return
    if (err instanceof DOMException && err.name === 'NotAllowedError') return
  })
}

/** Pause and detach before a new srcObject so play() is not interrupted mid-flight. */
export function bindMediaStream(
  el: HTMLMediaElement | null | undefined,
  stream: MediaStream | null,
): Promise<void> {
  if (!el) return Promise.resolve()
  try { el.pause() } catch { /* ignore */ }
  el.srcObject = stream
  if (!stream) return Promise.resolve()
  return playMedia(el)
}
