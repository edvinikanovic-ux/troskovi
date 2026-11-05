import { type Item, type Kind, docId, isBackupState, stateToItems } from '../../../shared/items'
import type { Op, Persistence } from './core'

const ITEMS_KEY = 'bill-tracker:items:v2'
// first browser version stored one grouped document; read it once and move it over
const LEGACY_KEY = 'bill-tracker:data:v1'

// Keeps all items in localStorage (this device only).
export function localPersistence(storage: Pick<Storage, 'getItem' | 'setItem'>): Persistence {
  const read = (): Item[] => {
    const raw = storage.getItem(ITEMS_KEY)
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed as Item[]
      } catch {
        // unreadable: start empty rather than crash the app
      }
      return []
    }
    const legacy = storage.getItem(LEGACY_KEY)
    if (legacy) {
      try {
        const parsed: unknown = JSON.parse(legacy)
        if (isBackupState(parsed)) return stateToItems(parsed)
      } catch {
        // ignore
      }
    }
    return []
  }

  const stored = new Map<string, Item>()
  for (const i of read()) stored.set(docId(i.kind, i.id), i)

  const apply = (op: Op): void => {
    if (op.type === 'set') stored.set(docId(op.item.kind, op.item.id), op.item)
    else stored.delete(docId(op.kind as Kind, op.id))
  }

  return {
    async load() {
      return [...stored.values()]
    },
    write(ops) {
      ops.forEach(apply)
      storage.setItem(ITEMS_KEY, JSON.stringify([...stored.values()]))
    }
  }
}
