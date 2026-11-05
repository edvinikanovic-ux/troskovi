// Input checks shared by the Electron main process (IPC handlers) and the browser data layer,
// so both reject exactly the same input.
import { SECTION_IDS, type SectionId } from './order'

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export function assertMonth(month: string): void {
  if (!MONTH_RE.test(month)) throw new Error('Invalid month')
}

export function assertAmount(cents: number | undefined): void {
  if (cents !== undefined && (!Number.isInteger(cents) || cents < 0)) {
    throw new Error('Invalid amount')
  }
}

export function assertCount(n: number | undefined, min: number): void {
  if (n !== undefined && (!Number.isInteger(n) || n < min || n > 600)) {
    throw new Error('Invalid count')
  }
}

export function assertId(id: number): void {
  if (!Number.isInteger(id)) throw new Error('Invalid id')
}

export function assertKey(key: string): void {
  if (typeof key !== 'string' || !key) throw new Error('Invalid bill')
}

// Empty names are allowed: new rows are created blank and named in place.
export function cleanName(name: string): string {
  const trimmed = String(name).trim()
  if (trimmed.length > 100) throw new Error('Invalid name')
  return trimmed
}

// Installments need a real name from the start.
export function requireName(name: string): string {
  const trimmed = String(name).trim()
  if (!trimmed || trimmed.length > 100) throw new Error('Invalid name')
  return trimmed
}

// A new row order: bill keys, or the numeric ids of the other lists (as text), each at most once.
export function assertRowIds(list: SectionId, ids: string[]): void {
  if (!SECTION_IDS.includes(list)) throw new Error('Invalid list')
  const valid = (id: unknown): boolean =>
    typeof id === 'string' && (list === 'bills' ? id !== '' : /^\d+$/.test(id))
  if (
    !Array.isArray(ids) ||
    ids.length > 1000 ||
    !ids.every(valid) ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error('Invalid order')
  }
}

// every section exactly once
export function assertSectionOrder(order: SectionId[]): void {
  if (
    !Array.isArray(order) ||
    order.length !== SECTION_IDS.length ||
    !SECTION_IDS.every((id) => order.includes(id))
  ) {
    throw new Error('Invalid order')
  }
}
