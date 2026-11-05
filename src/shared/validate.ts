// Input checks shared by the Electron main process (IPC handlers) and the browser data layer,
// so both reject exactly the same input.

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
