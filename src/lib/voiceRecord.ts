export const VOICE_SCRIPT = [
  'Hello. My name is here, and these are the stories I want to leave behind.',
  'I grew up in a place I loved, with people who shaped who I became.',
  'If there is one thing I would want you to remember, it is to be kind, and to be brave.',
]

export function pickMime(candidates: string[]): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return candidates.find((t) => MediaRecorder.isTypeSupported(t))
}

export function createMediaRecorder(stream: MediaStream): { recorder: MediaRecorder; mimeType: string } {
  const mime = pickMime(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'])
  try {
    if (mime) return { recorder: new MediaRecorder(stream, { mimeType: mime }), mimeType: mime }
  } catch {
    /* fall back to browser default */
  }
  return { recorder: new MediaRecorder(stream), mimeType: 'audio/webm' }
}

/** Encode a browser recording as 16-bit PCM mono WAV for reliable playback + storage. */
export async function blobToWav(blob: Blob, targetRate = 16000): Promise<Blob> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioCtx()
  try {
    let decoded: AudioBuffer
    try {
      decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
    } catch {
      throw new Error('Could not process the recording — try re-recording in Chrome or Edge.')
    }
    const rate = Math.min(targetRate, decoded.sampleRate)
    const length = Math.ceil(decoded.duration * rate)
    const offline = new OfflineAudioContext(1, length, rate)
    const src = offline.createBufferSource()
    src.buffer = decoded
    src.connect(offline.destination)
    src.start()
    const rendered = await offline.startRendering()
    const samples = rendered.getChannelData(0)
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
    }
    writeStr(0, 'RIFF')
    view.setUint32(4, 36 + samples.length * 2, true)
    writeStr(8, 'WAVE')
    writeStr(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, rate, true)
    view.setUint32(28, rate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeStr(36, 'data')
    view.setUint32(40, samples.length * 2, true)
    let offset = 44
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
    return new Blob([buffer], { type: 'audio/wav' })
  } finally {
    await ctx.close()
  }
}
