import {
  type Item,
  type ItemOf,
  type Kind,
  docId,
  isBackupState,
  itemsToState,
  stateToItems
} from '../../../shared/items'
import { moveRows, sectionOrder, type SectionId } from '../../../shared/order'
import type {
  BillPatch,
  BillsApi,
  Extra,
  ExtraPatch,
  Installment,
  InstallmentPatch,
  Loan,
  LoanPatch,
  MonthlyBill,
  Subscription,
  SubscriptionPatch
} from '../../../shared/types'
import {
  assertAmount,
  assertCount,
  assertId,
  assertKey,
  assertMonth,
  assertRowIds,
  assertSectionOrder,
  cleanName,
  requireName
} from '../../../shared/validate'

// The data layer used wherever there is no Electron main process: the browser (PWA) and the cloud.
// It implements the same BillsApi and the same rules as src/main/db.ts (SQLite); keep them in step.
// test/parity.test.ts runs one scenario against both. Where the data is actually stored is
// decided by a Persistence (localStorage in the browser).

export type Op = { type: 'set'; item: Item } | { type: 'delete'; kind: Kind; id: string }

export interface Persistence {
  // all stored items (for the cloud: waits for the first sync)
  load(): Promise<Item[]>
  // apply changes; must take effect locally right away, the upload may finish later (or offline)
  write(ops: Op[]): void
  // called with the full, current list whenever the stored items change from outside
  subscribe?(onItems: (items: Item[]) => void): () => void
  onError?(cb: (message: string) => void): () => void
  dispose?(): void
}

export type IdKind = 'extra' | 'sub' | 'inst' | 'loan'
export type NewId = (kind: IdKind, existing: number[]) => number

// 1, 2, 3...: fine for one device
export const sequentialId: NewId = (_kind, existing) =>
  existing.reduce((max, n) => Math.max(max, n), 0) + 1

// unique across devices that cannot see each other's counters (still a whole number JS can hold)
export const timeBasedId: NewId = () => Date.now() * 1000 + Math.floor(Math.random() * 1000)

export type DataApi = BillsApi &
  Required<Pick<BillsApi, 'exportData' | 'importData' | 'onChange' | 'onError' | 'dispose'>>

const newKey = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `b-${Date.now()}-${Math.random().toString(36).slice(2)}`

const monthsBetween = (from: string, to: string): number => {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return Math.max(0, (ty - fy) * 12 + (tm - fm))
}

const previousMonth = (month: string): string => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const clamp = (n: number, min: number, max: number): number => Math.min(Math.max(n, min), max)

// rows without a sortOrder (saved before rows could be dragged) sort by id, as they did before
type Ordered = { id: string; sortOrder?: number }
const orderOf = (row: Ordered): number => row.sortOrder ?? Number(row.id)
const byOrder = (a: Ordered, b: Ordered): number =>
  orderOf(a) - orderOf(b) || Number(a.id) - Number(b.id)
const byDefOrder = (a: ItemOf<'def'>, b: ItemOf<'def'>): number =>
  a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)
// a new row goes to the end
const nextOrder = (rows: Ordered[]): number =>
  rows.reduce((m, r) => Math.max(m, orderOf(r)), -1) + 1

const ROW_KINDS = {
  extras: 'extra',
  subscriptions: 'sub',
  installments: 'inst',
  loans: 'loan'
} as const

export async function createDataApi(
  persistence: Persistence,
  newId: NewId = sequentialId
): Promise<DataApi> {
  const items = new Map<string, Item>()
  const replaceAll = (list: Item[]): void => {
    items.clear()
    for (const i of list) items.set(docId(i.kind, i.id), i)
  }
  replaceAll(await persistence.load())

  const listeners = new Set<() => void>()
  const emit = (): void => listeners.forEach((cb) => cb())
  const stopListening = persistence.subscribe?.((list) => {
    replaceAll(list)
    emit()
  })

  const get = <K extends Kind>(kind: K, id: string): ItemOf<K> | undefined =>
    items.get(docId(kind, id)) as ItemOf<K> | undefined
  const all = <K extends Kind>(kind: K): ItemOf<K>[] =>
    [...items.values()].filter((i): i is ItemOf<K> => i.kind === kind)
  const withPrefix = <K extends Kind>(kind: K, prefix: string): ItemOf<K>[] =>
    all(kind).filter((i) => i.id.startsWith(prefix))

  const set = (item: Item): Op => ({ type: 'set', item })
  const del = (kind: Kind, id: string): Op => ({ type: 'delete', kind, id })
  const commit = (...ops: Op[]): void => {
    for (const op of ops) {
      if (op.type === 'set') items.set(docId(op.item.kind, op.item.id), op.item)
      else items.delete(docId(op.kind, op.id))
    }
    persistence.write(ops)
    emit()
  }

  const freshId = (kind: IdKind, items_: { id: string }[]): string => {
    const existing = items_.map((i) => Number(i.id))
    let id = newId(kind, existing)
    while (existing.includes(id)) id++
    return String(id)
  }

  // the latest `${id}|${month}` item for one id at or before `month`
  const latest = <K extends 'instmonth' | 'loananchor'>(
    kind: K,
    id: string,
    month: string
  ): { month: string; item: ItemOf<K> } | undefined => {
    let best: { month: string; item: ItemOf<K> } | undefined
    for (const candidate of withPrefix(kind, `${id}|`) as Item[]) {
      const itemMonth = candidate.id.slice(id.length + 1)
      if (itemMonth > month) continue
      if (!best || itemMonth > best.month) best = { month: itemMonth, item: candidate as ItemOf<K> }
    }
    return best
  }

  const paymentFor = (def: ItemOf<'def'>, month: string): ItemOf<'payment'> =>
    get('payment', `${def.id}|${month}`) ?? {
      kind: 'payment',
      id: `${def.id}|${month}`,
      amountCents: def.defaultAmountCents,
      paid: false,
      forMonth: null,
      hidden: false
    }

  const defOf = (key: string): ItemOf<'def'> => {
    const def = get('def', key)
    if (!def) throw new Error('Unknown bill')
    return def
  }

  const loanAt = (loan: ItemOf<'loan'>, month: string): Loan | null => {
    const anchor = latest('loananchor', loan.id, month)
    if (!anchor) return null
    const elapsed = monthsBetween(anchor.month, month)
    return {
      id: Number(loan.id),
      name: loan.name,
      debtCents: Math.max(0, anchor.item.debtCents - loan.monthlyCents * elapsed),
      monthlyCents: loan.monthlyCents
    }
  }

  return {
    // ---------- bills
    async list(month: string): Promise<MonthlyBill[]> {
      assertMonth(month)
      return all('def')
        .sort(byDefOrder)
        .flatMap((def) => {
          const p = get('payment', `${def.id}|${month}`)
          if (p?.hidden) return []
          return [
            {
              key: def.id,
              name: def.name,
              month,
              forMonth: p?.forMonth ?? month,
              amountCents: p ? p.amountCents : def.defaultAmountCents,
              paid: p ? p.paid : false
            }
          ]
        })
    },

    async update(key: string, month: string, patch: BillPatch): Promise<void> {
      assertMonth(month)
      assertAmount(patch.amountCents)
      if (patch.forMonth !== undefined) assertMonth(patch.forMonth)
      const base = paymentFor(defOf(key), month)
      commit(
        set({
          ...base,
          paid: patch.paid ?? base.paid,
          forMonth: patch.forMonth ?? base.forMonth,
          amountCents: patch.amountCents ?? base.amountCents
        })
      )
    },

    async addBill(name: string): Promise<void> {
      const clean = cleanName(name)
      const defs = all('def')
      const sortOrder = defs.reduce((m, d) => Math.max(m, d.sortOrder), -1) + 1
      commit(set({ kind: 'def', id: newKey(), name: clean, defaultAmountCents: 0, sortOrder }))
    },

    async renameBill(key: string, name: string): Promise<void> {
      assertKey(key)
      const clean = cleanName(name)
      const def = get('def', key)
      if (def) commit(set({ ...def, name: clean }))
    },

    async hideBill(key: string, month: string): Promise<void> {
      assertMonth(month)
      assertKey(key)
      commit(set({ ...paymentFor(defOf(key), month), hidden: true }))
    },

    async removeBill(key: string): Promise<void> {
      assertKey(key)
      commit(del('def', key), ...withPrefix('payment', `${key}|`).map((p) => del('payment', p.id)))
    },

    // ---------- subscriptions
    async listSubscriptions(month: string): Promise<Subscription[]> {
      assertMonth(month)
      return all('sub')
        .sort(byOrder)
        .filter((s) => !get('subhidden', `${s.id}|${month}`))
        .map((s) => ({ id: Number(s.id), name: s.name, amountCents: s.amountCents }))
    },

    async addSubscription(name: string, amountCents: number): Promise<void> {
      assertAmount(amountCents)
      const clean = cleanName(name)
      const subs = all('sub')
      commit(
        set({
          kind: 'sub',
          id: freshId('sub', subs),
          name: clean,
          amountCents,
          sortOrder: nextOrder(subs)
        })
      )
    },

    async updateSubscription(id: number, patch: SubscriptionPatch): Promise<void> {
      assertId(id)
      assertAmount(patch.amountCents)
      const sub = get('sub', String(id))
      if (sub) {
        commit(
          set({
            ...sub,
            name: patch.name ?? sub.name,
            amountCents: patch.amountCents ?? sub.amountCents
          })
        )
      }
    },

    async hideSubscription(id: number, month: string): Promise<void> {
      assertId(id)
      assertMonth(month)
      commit(set({ kind: 'subhidden', id: `${id}|${month}` }))
    },

    async removeSubscription(id: number): Promise<void> {
      assertId(id)
      commit(
        del('sub', String(id)),
        ...withPrefix('subhidden', `${id}|`).map((h) => del('subhidden', h.id))
      )
    },

    // ---------- installments
    async listInstallments(month: string): Promise<Installment[]> {
      assertMonth(month)
      return all('inst')
        .filter((r) => r.startMonth <= month)
        .sort(byOrder)
        .map((r) => {
          const entry = latest('instmonth', r.id, month)
          const from = entry
            ? { month: entry.month, paid: entry.item.paidCount }
            : { month: r.startMonth, paid: r.paidCount }
          return {
            id: Number(r.id),
            name: r.name,
            installmentCents: r.installmentCents,
            totalCount: r.totalCount,
            paidCount: Math.min(r.totalCount, from.paid + monthsBetween(from.month, month))
          }
        })
    },

    async addInstallment(
      name: string,
      installmentCents: number,
      totalCount: number,
      paidCount: number,
      startMonth: string
    ): Promise<void> {
      assertMonth(startMonth)
      const clean = requireName(name)
      assertAmount(installmentCents)
      assertCount(totalCount, 1)
      assertCount(paidCount, 0)
      const rows = all('inst')
      commit(
        set({
          kind: 'inst',
          id: freshId('inst', rows),
          name: clean,
          installmentCents,
          totalCount,
          paidCount: clamp(paidCount, 0, totalCount),
          startMonth,
          sortOrder: nextOrder(rows)
        })
      )
    },

    async updateInstallment(id: number, month: string, patch: InstallmentPatch): Promise<void> {
      assertId(id)
      assertMonth(month)
      assertAmount(patch.installmentCents)
      assertCount(patch.totalCount, 1)
      assertCount(patch.paidCount, 0)
      const row = get('inst', String(id))
      if (!row) return
      const total = patch.totalCount ?? row.totalCount
      const ops: Op[] = [
        set({
          ...row,
          name: patch.name ?? row.name,
          installmentCents: patch.installmentCents ?? row.installmentCents,
          totalCount: total,
          paidCount: Math.min(row.paidCount, total)
        })
      ]
      if (patch.paidCount !== undefined) {
        ops.push(
          set({
            kind: 'instmonth',
            id: `${id}|${month}`,
            paidCount: clamp(patch.paidCount, 0, total)
          })
        )
      }
      commit(...ops)
    },

    async removeInstallment(id: number): Promise<void> {
      assertId(id)
      commit(
        del('inst', String(id)),
        ...withPrefix('instmonth', `${id}|`).map((m) => del('instmonth', m.id))
      )
    },

    // ---------- loans
    async listLoans(month: string): Promise<Loan[]> {
      assertMonth(month)
      const before = previousMonth(month)
      return all('loan')
        .sort(byOrder)
        .flatMap((r) => {
          const loan = loanAt(r, month)
          if (!loan) return []
          if (loanAt(r, before)?.debtCents === 0) return []
          return [loan]
        })
    },

    async addLoan(
      name: string,
      debtCents: number,
      monthlyCents: number,
      startMonth: string
    ): Promise<void> {
      assertMonth(startMonth)
      assertAmount(debtCents)
      assertAmount(monthlyCents)
      const clean = cleanName(name)
      const rows = all('loan')
      const id = freshId('loan', rows)
      commit(
        set({
          kind: 'loan',
          id,
          name: clean,
          monthlyCents,
          startMonth,
          sortOrder: nextOrder(rows)
        }),
        set({ kind: 'loananchor', id: `${id}|${startMonth}`, debtCents })
      )
    },

    async updateLoan(id: number, month: string, patch: LoanPatch): Promise<void> {
      assertId(id)
      assertMonth(month)
      assertAmount(patch.debtCents)
      assertAmount(patch.monthlyCents)
      const row = get('loan', String(id))
      if (!row) return
      const ops: Op[] = [
        set({
          ...row,
          name: patch.name ?? row.name,
          monthlyCents: patch.monthlyCents ?? row.monthlyCents
        })
      ]
      // editing a month before the loan existed makes no sense; ignore the debt change
      if (patch.debtCents !== undefined && loanAt(row, month)) {
        ops.push(set({ kind: 'loananchor', id: `${id}|${month}`, debtCents: patch.debtCents }))
      }
      commit(...ops)
    },

    async removeLoan(id: number): Promise<void> {
      assertId(id)
      commit(
        del('loan', String(id)),
        ...withPrefix('loananchor', `${id}|`).map((a) => del('loananchor', a.id))
      )
    },

    // ---------- extra expenses
    async listExtras(month: string): Promise<Extra[]> {
      assertMonth(month)
      return all('extra')
        .filter((x) => x.month === month)
        .sort(byOrder)
        .map((x) => ({
          id: Number(x.id),
          month: x.month,
          name: x.name,
          amountCents: x.amountCents
        }))
    },

    async addExtra(month: string): Promise<Extra> {
      assertMonth(month)
      const rows = all('extra')
      const id = freshId('extra', rows)
      const sortOrder = nextOrder(rows.filter((x) => x.month === month))
      commit(set({ kind: 'extra', id, month, name: '', amountCents: 0, sortOrder }))
      return { id: Number(id), month, name: '', amountCents: 0 }
    },

    async updateExtra(id: number, patch: ExtraPatch): Promise<void> {
      assertId(id)
      assertAmount(patch.amountCents)
      const extra = get('extra', String(id))
      if (extra) {
        commit(
          set({
            ...extra,
            name: patch.name ?? extra.name,
            amountCents: patch.amountCents ?? extra.amountCents
          })
        )
      }
    },

    async removeExtra(id: number): Promise<void> {
      assertId(id)
      commit(del('extra', String(id)))
    },

    // ---------- order
    async reorderRows(list: SectionId, month: string, ids: string[]): Promise<void> {
      assertMonth(month)
      assertRowIds(list, ids)
      // every row of the list, also the ones not shown in this month, so those keep their place
      const rows: ItemOf<'def' | 'extra' | 'sub' | 'inst' | 'loan'>[] =
        list === 'bills'
          ? all('def').sort(byDefOrder)
          : all(ROW_KINDS[list])
              .filter((r) => r.kind !== 'extra' || r.month === month)
              .sort(byOrder)
      const byId = new Map(rows.map((r) => [r.id, r]))
      // only rows whose place changed are written (each one is a document in the cloud)
      const ops = moveRows(
        rows.map((r) => r.id),
        ids
      ).flatMap((id, i) => {
        const row = byId.get(id)
        return row && row.sortOrder !== i ? [set({ ...row, sortOrder: i })] : []
      })
      if (ops.length > 0) commit(...ops)
    },

    async getSectionOrder(): Promise<SectionId[]> {
      return sectionOrder(get('pref', 'sectionOrder')?.value)
    },

    async setSectionOrder(order: SectionId[]): Promise<void> {
      assertSectionOrder(order)
      commit(set({ kind: 'pref', id: 'sectionOrder', value: [...order] }))
    },

    // ---------- backup
    async exportData(): Promise<string> {
      return JSON.stringify(itemsToState([...items.values()]), null, 2)
    },

    async importData(json: string): Promise<void> {
      let parsed: unknown
      try {
        parsed = JSON.parse(json)
      } catch {
        throw new Error('Invalid backup file')
      }
      if (!isBackupState(parsed)) throw new Error('Invalid backup file')
      const incoming = stateToItems(parsed)
      const keep = new Set(incoming.map((i) => docId(i.kind, i.id)))
      const stale = [...items.values()].filter((i) => !keep.has(docId(i.kind, i.id)))
      commit(...stale.map((i) => del(i.kind, i.id)), ...incoming.map(set))
    },

    onChange(cb: () => void): () => void {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },

    onError(cb: (message: string) => void): () => void {
      return persistence.onError?.(cb) ?? (() => {})
    },

    dispose(): void {
      stopListening?.()
      persistence.dispose?.()
    }
  }
}
