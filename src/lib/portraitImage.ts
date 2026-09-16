/**
 * Prepare a portrait for Anam Cara 4.
 *
 * Cara 4 wants a square ≥1152px with room around the head, shoulders, and chest
 * so it can crop landscape (1152×768) or portrait (768×1152) without outpainting.
 * A tight center-crop of a webcam frame is exactly what makes the generated
 * face warp — we contain + inset instead of chopping the subject.
 */

const PORTRAIT_MIN_PX = 1152
const PORTRAIT_TARGET_PX = 1536
const PORTRAIT_HARD_MIN_PX = 640
const SUBJECT_SCALE = 0.78
const ANAM_MAX_BYTES = 4_200_000
const PAD_FILL = '#e8dcc8'

export function loadImageFile(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image'))
    img.src = URL.createObjectURL(file)
  })
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process photo'))), 'image/jpeg', quality)
  })
}

async function jpegUnderLimit(canvas: HTMLCanvasElement): Promise<Blob> {
  for (const q of [0.92, 0.86, 0.78, 0.7]) {
    const blob = await canvasToJpeg(canvas, q)
    if (blob.size <= ANAM_MAX_BYTES) return blob
  }
  const small = document.createElement('canvas')
  small.width = PORTRAIT_MIN_PX
  small.height = PORTRAIT_MIN_PX
  const ctx = small.getContext('2d')!
  ctx.drawImage(canvas, 0, 0, PORTRAIT_MIN_PX, PORTRAIT_MIN_PX)
  return canvasToJpeg(small, 0.75)
}

function fillSquareCanvas(out: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process photo')
  ctx.fillStyle = PAD_FILL
  ctx.fillRect(0, 0, out, out)
  return { canvas, ctx }
}

/** Draw a source (image or video frame) contained + inset on a square canvas. */
function composeSquare(
  source: CanvasImageSource,
  sw: number,
  sh: number,
  opts: { mirror?: boolean } = {},
): HTMLCanvasElement {
  if (sw < PORTRAIT_HARD_MIN_PX || sh < PORTRAIT_HARD_MIN_PX) {
    throw new Error('That photo is too small. Use a clearer photo of your face, taken a little farther back.')
  }
  const out = Math.min(Math.max(Math.max(sw, sh), PORTRAIT_MIN_PX), PORTRAIT_TARGET_PX)
  const { canvas, ctx } = fillSquareCanvas(out)

  // Soft backdrop from the source so padding is not a hard box.
  ctx.save()
  ctx.filter = 'blur(22px) saturate(0.85) brightness(1.05)'
  const cover = Math.max(out / sw, out / sh)
  ctx.drawImage(source, (out - sw * cover) / 2, (out - sh * cover) / 2, sw * cover, sh * cover)
  ctx.restore()

  const inner = out * SUBJECT_SCALE
  const contain = Math.min(inner / sw, inner / sh)
  const dw = sw * contain
  const dh = sh * contain
  const dx = (out - dw) / 2
  const dy = (out - dh) / 2

  if (opts.mirror) {
    ctx.translate(out, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(source, 0, 0, sw, sh, out - dx - dw, dy, dw, dh)
  } else {
    ctx.drawImage(source, 0, 0, sw, sh, dx, dy, dw, dh)
  }
  return canvas
}

/** Normalize an uploaded photo: contain in a square with Anam-safe margins. Never center-crop. */
export async function normalizePortrait(file: File | Blob): Promise<Blob> {
  const img = await loadImageFile(file)
  try {
    const canvas = composeSquare(img, img.width, img.height)
    return jpegUnderLimit(canvas)
  } finally {
    URL.revokeObjectURL(img.src)
  }
}

/** Capture the live camera frame the same way — full frame, padded, not a tight crop. */
export async function capturePortraitFromVideo(
  video: HTMLVideoElement,
  opts: { mirror?: boolean } = {},
): Promise<Blob> {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) throw new Error('Camera is not ready yet.')
  const canvas = composeSquare(video, vw, vh, opts)
  return jpegUnderLimit(canvas)
}
