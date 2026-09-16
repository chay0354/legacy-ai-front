/**
 * Square portrait for display + Anam. Fill the frame (cover) so the photo
 * is not stamped inside a padded box — that looked like a picture-in-picture.
 */

const PORTRAIT_MIN_PX = 1152
const PORTRAIT_TARGET_PX = 1536
const PORTRAIT_HARD_MIN_PX = 640
const ANAM_MAX_BYTES = 4_200_000

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

/** Center-cover into a square — the photo fills the frame edge to edge. */
function composeSquare(
  source: CanvasImageSource,
  sw: number,
  sh: number,
  opts: { mirror?: boolean } = {},
): HTMLCanvasElement {
  if (sw < PORTRAIT_HARD_MIN_PX || sh < PORTRAIT_HARD_MIN_PX) {
    throw new Error('That photo is too small. Use a clearer photo of your face, taken a little farther back.')
  }
  const crop = Math.min(sw, sh)
  const out = Math.min(Math.max(crop, PORTRAIT_MIN_PX), PORTRAIT_TARGET_PX)
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process photo')

  const sx = (sw - crop) / 2
  const sy = (sh - crop) / 2
  if (opts.mirror) {
    ctx.translate(out, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(source, sx, sy, crop, crop, 0, 0, out, out)
  return canvas
}

/** Normalize an uploaded photo to a full-bleed square JPEG. */
export async function normalizePortrait(file: File | Blob): Promise<Blob> {
  const img = await loadImageFile(file)
  try {
    const canvas = composeSquare(img, img.width, img.height)
    return jpegUnderLimit(canvas)
  } finally {
    URL.revokeObjectURL(img.src)
  }
}

/** Capture the live camera frame as a full-bleed square. */
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
