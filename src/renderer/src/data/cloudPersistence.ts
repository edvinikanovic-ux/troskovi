import { collection, doc, onSnapshot, writeBatch, type Firestore } from 'firebase/firestore'
import { KINDS, docId, type Item } from '../../../shared/items'
import type { Op, Persistence } from './core'

const BATCH_LIMIT = 400 // Firestore allows 500 writes per batch
const FIRST_SYNC_TIMEOUT_MS = 4000

// Stores every item as its own document in users/{uid}/items. A listener keeps the in-memory copy
// current, also with changes made on other devices. Writes are applied to the local cache at once and
// uploaded in the background, so the app stays usable offline.
export function firestorePersistence(db: Firestore, uid: string): Persistence {
  const col = collection(db, 'users', uid, 'items')
  const subscribers = new Set<(items: Item[]) => void>()
  const errorListeners = new Set<(message: string) => void>()

  const reportError = (e: unknown): void => {
    const code = (e as { code?: string }).code
    const message = code ?? (e instanceof Error ? e.message : String(e))
    console.error('Sync error:', e)
    errorListeners.forEach((cb) => cb(message))
  }

  let latest: Item[] = []
  let firstDone = false
  let resolveFirst: (items: Item[]) => void = () => {}
  const first = new Promise<Item[]>((resolve) => {
    resolveFirst = resolve
  })
  const finishFirst = (): void => {
    if (firstDone) return
    firstDone = true
    resolveFirst(latest)
  }

  const stop = onSnapshot(
    col,
    (snap) => {
      latest = snap.docs
        .map((d) => d.data() as Item)
        .filter((i) => KINDS.includes(i.kind) && typeof i.id === 'string')
      if (!firstDone) {
        // wait for the server's answer; a copy from the device cache only counts after a timeout
        if (!snap.metadata.fromCache) finishFirst()
      } else {
        subscribers.forEach((cb) => cb(latest))
      }
    },
    reportError
  )
  const timer = setTimeout(finishFirst, FIRST_SYNC_TIMEOUT_MS)

  return {
    load: () => first,

    write(ops: Op[]) {
      for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db)
        for (const op of ops.slice(i, i + BATCH_LIMIT)) {
          if (op.type === 'set') {
            // JSON round trip drops undefined fields, which Firestore rejects
            const data = JSON.parse(JSON.stringify(op.item)) as Item
            batch.set(doc(col, docId(op.item.kind, op.item.id)), data)
          } else {
            batch.delete(doc(col, docId(op.kind, op.id)))
          }
        }
        batch.commit().catch(reportError)
      }
    },

    subscribe(onItems) {
      subscribers.add(onItems)
      // changes that arrived between the first load and this subscription
      queueMicrotask(() => onItems(latest))
      return () => subscribers.delete(onItems)
    },

    onError(cb) {
      errorListeners.add(cb)
      return () => errorListeners.delete(cb)
    },

    dispose() {
      clearTimeout(timer)
      stop()
    }
  }
}
