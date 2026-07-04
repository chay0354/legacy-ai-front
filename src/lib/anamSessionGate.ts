import type { AnamClient } from '@anam-ai/js-sdk'

const STOP_TIMEOUT_MS = 10000
/** Anam Free plan needs several seconds after stop before a new session is allowed. */
const SLOT_RELEASE_MS = 6000
const SLOT_BUFFER_MS = 3000

let activeClient: AnamClient | null = null
let stopPromise: Promise<void> | null = null
let slotReadyAt = 0
let releaseChain = Promise.resolve()

export function registerAnamClient(client: AnamClient) {
  activeClient = client
}

export function unregisterAnamClient(client: AnamClient) {
  if (activeClient === client) activeClient = null
}

export function getActiveAnamClient() {
  return activeClient
}

export function sleep(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms))
}

async function stopClient(client: AnamClient) {
  await Promise.race([
    client.stopStreaming?.().catch(() => {}) ?? Promise.resolve(),
    sleep(STOP_TIMEOUT_MS),
  ])
}

async function releaseSlotNow(cooldownMs: number, extraClient?: AnamClient | null) {
  if (stopPromise) {
    await Promise.race([stopPromise, sleep(STOP_TIMEOUT_MS)])
    stopPromise = null
  }

  const tracked = activeClient
  activeClient = null

  const clients = new Set<AnamClient>()
  if (tracked) clients.add(tracked)
  if (extraClient) clients.add(extraClient)

  for (const client of clients) {
    await stopClient(client)
  }

  if (cooldownMs > 0) await sleep(cooldownMs)
  slotReadyAt = Date.now() + SLOT_BUFFER_MS
}

/**
 * Stop any active client, optionally an extra one, then wait for Anam to release the slot.
 */
export async function ensureAnamSlotFree(cooldownMs = SLOT_RELEASE_MS, extraClient?: AnamClient | null) {
  const waitMs = Math.max(0, slotReadyAt - Date.now())
  if (waitMs > 0) await sleep(waitMs)

  releaseChain = releaseChain.then(() => releaseSlotNow(cooldownMs, extraClient))
  await releaseChain
}

/** Alias for ensureAnamSlotFree — kept for older call sites / HMR. */
export const stopActiveAnamSession = ensureAnamSlotFree

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void ensureAnamSlotFree(0)
  })
}
