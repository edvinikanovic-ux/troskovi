// The data of the app as a flat set of small records ("items"). Every bill, payment, expense, rate...
// is one item, so a sync backend (Firestore) can store each as its own document and two devices that
// edit different things never overwrite each other. The browser/cloud data layer works on this shape.
import type { Extra, Subscription } from './types'

export type Item =
  | { kind: 'def'; id: string; name: string; defaultAmountCents: number; sortOrder: number }
  | {
      kind: 'payment' // id: `${billKey}|${month}`
      id: string
      amountCents: number
      paid: boolean
      forMonth: string | null
      hidden: boolean
    }
  | { kind: 'extra'; id: string; month: string; name: string; amountCents: number }
  | { kind: 'sub'; id: string; name: string; amountCents: number }
  | { kind: 'subhidden'; id: string } // id: `${subId}|${month}`
  | {
      kind: 'inst'
      id: string
      name: string
      installmentCents: number
      totalCount: number
      paidCount: number // paid installments at startMonth
      startMonth: string
    }
  | { kind: 'instmonth'; id: string; paidCount: number } // id: `${instId}|${month}`
  | { kind: 'loan'; id: string; name: string; monthlyCents: number; startMonth: string }
  | { kind: 'loananchor'; id: string; debtCents: number } // id: `${loanId}|${month}`

export type Kind = Item['kind']

export const KINDS: Kind[] = [
  'def',
  'payment',
  'extra',
  'sub',
  'subhidden',
  'inst',
  'instmonth',
  'loan',
  'loananchor'
]

export const docId = (kind: Kind, id: string): string => `${kind}:${id}`

export type ItemOf<K extends Kind> = Extract<Item, { kind: K }>

// ---- backup file: the same data in the older, grouped JSON shape. It is what "Export data"
// writes and what the Electron app (SQLite) can export, so data can move between devices.

export interface BackupState {
  version: 1
  defs: { key: string; name: string; defaultAmountCents: number; sortOrder: number }[]
  payments: Record<
    string,
    { amountCents: number; paid: boolean; forMonth: string | null; hidden: boolean }
  >
  extras: Extra[]
  subs: Subscription[]
  subHidden: string[]
  installments: {
    id: number
    name: string
    installmentCents: number
    totalCount: number
    paidCount: number
    startMonth: string
  }[]
  installmentMonths: Record<string, number>
  loans: { id: number; name: string; monthlyCents: number; startMonth: string }[]
  loanAnchors: Record<string, number>
}

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const isStr = (x: unknown): x is string => typeof x === 'string'

export function isBackupState(x: unknown): x is BackupState {
  if (!isObject(x) || x.version !== 1) return false
  const arrays = ['defs', 'extras', 'subs', 'subHidden', 'installments', 'loans']
  if (!arrays.every((k) => Array.isArray(x[k]))) return false
  const maps = ['payments', 'installmentMonths', 'loanAnchors']
  if (!maps.every((k) => isObject(x[k]))) return false
  const s = x as unknown as BackupState
  return (
    s.defs.every((d) => isObject(d) && isStr(d.key) && isStr(d.name) && isNum(d.sortOrder)) &&
    Object.values(s.payments).every(
      (p) => isObject(p) && isNum(p.amountCents) && typeof p.paid === 'boolean'
    ) &&
    s.extras.every((e) => isObject(e) && isNum(e.id) && isStr(e.month) && isNum(e.amountCents)) &&
    s.subs.every((e) => isObject(e) && isNum(e.id) && isStr(e.name) && isNum(e.amountCents)) &&
    s.subHidden.every(isStr) &&
    s.installments.every(
      (e) => isObject(e) && isNum(e.id) && isStr(e.startMonth) && isNum(e.totalCount)
    ) &&
    Object.values(s.installmentMonths).every(isNum) &&
    s.loans.every((e) => isObject(e) && isNum(e.id) && isStr(e.startMonth)) &&
    Object.values(s.loanAnchors).every(isNum)
  )
}

export function stateToItems(s: BackupState): Item[] {
  const items: Item[] = []
  for (const d of s.defs) {
    items.push({
      kind: 'def',
      id: d.key,
      name: d.name,
      defaultAmountCents: d.defaultAmountCents ?? 0,
      sortOrder: d.sortOrder
    })
  }
  for (const [id, p] of Object.entries(s.payments)) {
    items.push({
      kind: 'payment',
      id,
      amountCents: p.amountCents,
      paid: p.paid,
      forMonth: p.forMonth ?? null,
      hidden: !!p.hidden
    })
  }
  for (const e of s.extras) {
    items.push({
      kind: 'extra',
      id: String(e.id),
      month: e.month,
      name: e.name,
      amountCents: e.amountCents
    })
  }
  for (const e of s.subs) {
    items.push({ kind: 'sub', id: String(e.id), name: e.name, amountCents: e.amountCents })
  }
  for (const id of s.subHidden) items.push({ kind: 'subhidden', id })
  for (const e of s.installments) {
    items.push({
      kind: 'inst',
      id: String(e.id),
      name: e.name,
      installmentCents: e.installmentCents,
      totalCount: e.totalCount,
      paidCount: e.paidCount,
      startMonth: e.startMonth
    })
  }
  for (const [id, paidCount] of Object.entries(s.installmentMonths)) {
    items.push({ kind: 'instmonth', id, paidCount })
  }
  for (const e of s.loans) {
    items.push({
      kind: 'loan',
      id: String(e.id),
      name: e.name,
      monthlyCents: e.monthlyCents,
      startMonth: e.startMonth
    })
  }
  for (const [id, debtCents] of Object.entries(s.loanAnchors)) {
    items.push({ kind: 'loananchor', id, debtCents })
  }
  return items
}

export function itemsToState(items: Item[]): BackupState {
  const s: BackupState = {
    version: 1,
    defs: [],
    payments: {},
    extras: [],
    subs: [],
    subHidden: [],
    installments: [],
    installmentMonths: {},
    loans: [],
    loanAnchors: {}
  }
  for (const i of items) {
    switch (i.kind) {
      case 'def':
        s.defs.push({
          key: i.id,
          name: i.name,
          defaultAmountCents: i.defaultAmountCents,
          sortOrder: i.sortOrder
        })
        break
      case 'payment':
        s.payments[i.id] = {
          amountCents: i.amountCents,
          paid: i.paid,
          forMonth: i.forMonth,
          hidden: i.hidden
        }
        break
      case 'extra':
        s.extras.push({
          id: Number(i.id),
          month: i.month,
          name: i.name,
          amountCents: i.amountCents
        })
        break
      case 'sub':
        s.subs.push({ id: Number(i.id), name: i.name, amountCents: i.amountCents })
        break
      case 'subhidden':
        s.subHidden.push(i.id)
        break
      case 'inst':
        s.installments.push({
          id: Number(i.id),
          name: i.name,
          installmentCents: i.installmentCents,
          totalCount: i.totalCount,
          paidCount: i.paidCount,
          startMonth: i.startMonth
        })
        break
      case 'instmonth':
        s.installmentMonths[i.id] = i.paidCount
        break
      case 'loan':
        s.loans.push({
          id: Number(i.id),
          name: i.name,
          monthlyCents: i.monthlyCents,
          startMonth: i.startMonth
        })
        break
      case 'loananchor':
        s.loanAnchors[i.id] = i.debtCents
        break
    }
  }
  s.defs.sort((a, b) => a.sortOrder - b.sortOrder)
  return s
}
