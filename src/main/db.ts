import Database from 'better-sqlite3'
import { app } from 'electron'
import { randomUUID } from 'crypto'
import { join } from 'path'
import type { BackupState } from '../shared/items'
import { RECURRING_BILLS } from '../shared/recurringBills'
import type {
  BillPatch,
  Extra,
  ExtraPatch,
  Installment,
  InstallmentPatch,
  Loan,
  LoanPatch,
  MonthlyBill,
  Subscription,
  SubscriptionPatch
} from '../shared/types'

interface DefRow {
  key: string
  name: string
  default_amount_cents: number
}

interface PaymentRow {
  bill_key: string
  amount_cents: number
  paid: number
  for_month: string | null
  hidden: number
}

let db: Database.Database

// period_months and remaining_months are legacy: loans no longer use them, but existing databases
// still have the columns, so they stay (nullable) instead of rebuilding the tables again.
const LOANS_DDL = `
  CREATE TABLE IF NOT EXISTS loans (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    monthly_cents  INTEGER NOT NULL DEFAULT 0 CHECK (monthly_cents >= 0),
    period_months  INTEGER CHECK (period_months IS NULL OR period_months >= 1),
    start_month    TEXT    NOT NULL
  );
  CREATE TABLE IF NOT EXISTS loan_anchors (
    loan_id          INTEGER NOT NULL,
    month            TEXT    NOT NULL,
    debt_cents       INTEGER NOT NULL CHECK (debt_cents >= 0),
    remaining_months INTEGER CHECK (remaining_months IS NULL OR remaining_months >= 0),
    PRIMARY KEY (loan_id, month)
  );
`

export function initDb(): void {
  db = new Database(join(app.getPath('userData'), 'bills.db'))
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      bill_key     TEXT    NOT NULL,
      month        TEXT    NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
      paid         INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (bill_key, month)
    );
    CREATE TABLE IF NOT EXISTS extras (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      month        TEXT    NOT NULL,
      name         TEXT    NOT NULL DEFAULT '',
      amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0)
    );
    CREATE INDEX IF NOT EXISTS idx_extras_month ON extras (month);
    CREATE TABLE IF NOT EXISTS installments (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT    NOT NULL,
      installment_cents INTEGER NOT NULL DEFAULT 0 CHECK (installment_cents >= 0),
      total_count      INTEGER NOT NULL CHECK (total_count >= 1),
      paid_count       INTEGER NOT NULL DEFAULT 0 CHECK (paid_count >= 0 AND paid_count <= total_count),
      start_month      TEXT    NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS subscription_hidden (
      sub_id INTEGER NOT NULL,
      month  TEXT    NOT NULL,
      PRIMARY KEY (sub_id, month)
    );
    CREATE TABLE IF NOT EXISTS installment_months (
      inst_id    INTEGER NOT NULL,
      month      TEXT    NOT NULL,
      paid_count INTEGER NOT NULL CHECK (paid_count >= 0),
      PRIMARY KEY (inst_id, month)
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0)
    );
  `)
  db.exec(LOANS_DDL)
  migrateLoansToOptionalTerm()
  seedBillDefs()
  // installments created before the automatic counter get today's month as their start
  const instCols = db.prepare('PRAGMA table_info(installments)').all() as { name: string }[]
  if (!instCols.some((c) => c.name === 'start_month')) {
    db.exec("ALTER TABLE installments ADD COLUMN start_month TEXT NOT NULL DEFAULT ''")
  }
  db.prepare("UPDATE installments SET start_month = ? WHERE start_month = ''").run(currentMonth())
  const cols = db.prepare('PRAGMA table_info(payments)').all() as { name: string }[]
  if (!cols.some((c) => c.name === 'for_month')) {
    db.exec('ALTER TABLE payments ADD COLUMN for_month TEXT')
  }
  if (!cols.some((c) => c.name === 'hidden')) {
    db.exec('ALTER TABLE payments ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0')
  }
}

// Loans were first created with a mandatory term. Rebuild the tables so period and remaining
// months can be empty (SQLite cannot drop a NOT NULL constraint in place).
function migrateLoansToOptionalTerm(): void {
  const cols = db.prepare('PRAGMA table_info(loans)').all() as { name: string; notnull: number }[]
  if (cols.find((c) => c.name === 'period_months')?.notnull !== 1) return
  db.transaction(() => {
    db.exec(`
      ALTER TABLE loans RENAME TO loans_old;
      ALTER TABLE loan_anchors RENAME TO loan_anchors_old;
      ${LOANS_DDL}
      INSERT INTO loans SELECT id, name, monthly_cents, period_months, start_month FROM loans_old;
      INSERT INTO loan_anchors SELECT loan_id, month, debt_cents, remaining_months FROM loan_anchors_old;
      DROP TABLE loans_old;
      DROP TABLE loan_anchors_old;
    `)
  })()
}

// The bill list lives in the DB. The table is created and seeded once from RECURRING_BILLS,
// so deleting every bill later does not bring the seed back.
function seedBillDefs(): void {
  const exists = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'bill_defs'")
    .get()
  if (exists) return
  db.transaction(() => {
    db.exec(`
      CREATE TABLE bill_defs (
        key                  TEXT    PRIMARY KEY,
        name                 TEXT    NOT NULL,
        default_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (default_amount_cents >= 0),
        sort_order           INTEGER NOT NULL
      );
    `)
    const insert = db.prepare(
      'INSERT INTO bill_defs (key, name, default_amount_cents, sort_order) VALUES (?, ?, ?, ?)'
    )
    RECURRING_BILLS.forEach((b, i) => insert.run(b.key, b.name, b.defaultAmountCents ?? 0, i))
  })()
}

export function listMonth(month: string): MonthlyBill[] {
  const defs = db
    .prepare('SELECT key, name, default_amount_cents FROM bill_defs ORDER BY sort_order, rowid')
    .all() as DefRow[]
  const rows = db
    .prepare('SELECT bill_key, amount_cents, paid, for_month, hidden FROM payments WHERE month = ?')
    .all(month) as PaymentRow[]
  const byKey = new Map(rows.map((r) => [r.bill_key, r]))
  return defs
    .filter((def) => byKey.get(def.key)?.hidden !== 1)
    .map((def) => {
      const row = byKey.get(def.key)
      return {
        key: def.key,
        name: def.name,
        month,
        forMonth: row?.for_month ?? month,
        amountCents: row ? row.amount_cents : def.default_amount_cents,
        paid: row ? row.paid === 1 : false
      }
    })
}

export function addBillDef(name: string): void {
  db.prepare(
    `INSERT INTO bill_defs (key, name, sort_order)
     VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM bill_defs))`
  ).run(randomUUID(), name)
}

export function renameBillDef(key: string, name: string): void {
  db.prepare('UPDATE bill_defs SET name = ? WHERE key = ?').run(name, key)
}

// Hides the bill for one month only; the bill and its other months stay untouched.
export function hideBillForMonth(key: string, month: string): void {
  const def = db.prepare('SELECT default_amount_cents FROM bill_defs WHERE key = ?').get(key) as
    { default_amount_cents: number } | undefined
  if (!def) throw new Error('Unknown bill')
  db.transaction(() => {
    db.prepare(
      'INSERT OR IGNORE INTO payments (bill_key, month, amount_cents) VALUES (?, ?, ?)'
    ).run(key, month, def.default_amount_cents)
    db.prepare('UPDATE payments SET hidden = 1 WHERE bill_key = ? AND month = ?').run(key, month)
  })()
}

// Removes the bill and its payment history.
export function removeBillDef(key: string): void {
  db.transaction(() => {
    db.prepare('DELETE FROM payments WHERE bill_key = ?').run(key)
    db.prepare('DELETE FROM bill_defs WHERE key = ?').run(key)
  })()
}

export function updatePayment(key: string, month: string, patch: BillPatch): void {
  const def = db.prepare('SELECT default_amount_cents FROM bill_defs WHERE key = ?').get(key) as
    { default_amount_cents: number } | undefined
  if (!def) throw new Error('Unknown bill')
  db.transaction(() => {
    db.prepare(
      'INSERT OR IGNORE INTO payments (bill_key, month, amount_cents) VALUES (?, ?, ?)'
    ).run(key, month, def.default_amount_cents)
    if (patch.paid !== undefined) {
      db.prepare('UPDATE payments SET paid = ? WHERE bill_key = ? AND month = ?').run(
        patch.paid ? 1 : 0,
        key,
        month
      )
    }
    if (patch.forMonth !== undefined) {
      db.prepare('UPDATE payments SET for_month = ? WHERE bill_key = ? AND month = ?').run(
        patch.forMonth,
        key,
        month
      )
    }
    if (patch.amountCents !== undefined) {
      db.prepare('UPDATE payments SET amount_cents = ? WHERE bill_key = ? AND month = ?').run(
        patch.amountCents,
        key,
        month
      )
    }
  })()
}

interface ExtraRow {
  id: number
  month: string
  name: string
  amount_cents: number
}

const toExtra = (r: ExtraRow): Extra => ({
  id: r.id,
  month: r.month,
  name: r.name,
  amountCents: r.amount_cents
})

export function listExtras(month: string): Extra[] {
  const rows = db
    .prepare('SELECT * FROM extras WHERE month = ? ORDER BY id')
    .all(month) as ExtraRow[]
  return rows.map(toExtra)
}

export function addExtra(month: string): Extra {
  const info = db.prepare('INSERT INTO extras (month) VALUES (?)').run(month)
  const row = db.prepare('SELECT * FROM extras WHERE id = ?').get(info.lastInsertRowid) as ExtraRow
  return toExtra(row)
}

export function updateExtra(id: number, patch: ExtraPatch): void {
  db.transaction(() => {
    if (patch.name !== undefined) {
      db.prepare('UPDATE extras SET name = ? WHERE id = ?').run(patch.name, id)
    }
    if (patch.amountCents !== undefined) {
      db.prepare('UPDATE extras SET amount_cents = ? WHERE id = ?').run(patch.amountCents, id)
    }
  })()
}

export function removeExtra(id: number): void {
  db.prepare('DELETE FROM extras WHERE id = ?').run(id)
}

interface SubscriptionRow {
  id: number
  name: string
  amount_cents: number
}

export function listSubscriptions(month: string): Subscription[] {
  const rows = db
    .prepare(
      `SELECT * FROM subscriptions
       WHERE id NOT IN (SELECT sub_id FROM subscription_hidden WHERE month = ?)
       ORDER BY id`
    )
    .all(month) as SubscriptionRow[]
  return rows.map((r) => ({ id: r.id, name: r.name, amountCents: r.amount_cents }))
}

export function addSubscription(name: string, amountCents: number): void {
  db.prepare('INSERT INTO subscriptions (name, amount_cents) VALUES (?, ?)').run(name, amountCents)
}

export function updateSubscription(id: number, patch: SubscriptionPatch): void {
  db.transaction(() => {
    if (patch.name !== undefined) {
      db.prepare('UPDATE subscriptions SET name = ? WHERE id = ?').run(patch.name, id)
    }
    if (patch.amountCents !== undefined) {
      db.prepare('UPDATE subscriptions SET amount_cents = ? WHERE id = ?').run(
        patch.amountCents,
        id
      )
    }
  })()
}

// Hides the subscription for one month only.
export function hideSubscriptionForMonth(id: number, month: string): void {
  db.prepare('INSERT OR IGNORE INTO subscription_hidden (sub_id, month) VALUES (?, ?)').run(
    id,
    month
  )
}

// Removes the subscription from every month.
export function removeSubscription(id: number): void {
  db.transaction(() => {
    db.prepare('DELETE FROM subscription_hidden WHERE sub_id = ?').run(id)
    db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id)
  })()
}

interface InstallmentRow {
  id: number
  name: string
  installment_cents: number
  total_count: number
  paid_count: number // paid installments at start_month
  start_month: string // YYYY-MM the counter was last anchored
}

const monthsBetween = (from: string, to: string): number => {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return Math.max(0, (ty - fy) * 12 + (tm - fm))
}

const currentMonth = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// The paid count carries from month to month: a month takes the previous month's count and adds 1
// (4/10 in January is 5/10 in February), capped at the total. It starts from the count entered when
// the installment was added; a manual change in a month becomes the new starting point from that
// month on, so earlier months are not touched.
export function listInstallments(month: string): Installment[] {
  const rows = db
    .prepare('SELECT * FROM installments WHERE start_month <= ? ORDER BY id')
    .all(month) as InstallmentRow[]
  const latestEntry = db.prepare(
    `SELECT month, paid_count FROM installment_months
     WHERE inst_id = ? AND month <= ? ORDER BY month DESC LIMIT 1`
  )
  return rows.map((r) => {
    const entry = latestEntry.get(r.id, month) as { month: string; paid_count: number } | undefined
    const from = entry ?? { month: r.start_month, paid_count: r.paid_count }
    const paid = Math.min(r.total_count, from.paid_count + monthsBetween(from.month, month))
    return {
      id: r.id,
      name: r.name,
      installmentCents: r.installment_cents,
      totalCount: r.total_count,
      paidCount: paid
    }
  })
}

// startMonth is the month that was open when the installment was added
export function addInstallment(
  name: string,
  installmentCents: number,
  totalCount: number,
  paidCount: number,
  startMonth: string
): void {
  db.prepare(
    'INSERT INTO installments (name, installment_cents, total_count, paid_count, start_month) VALUES (?, ?, ?, ?, ?)'
  ).run(
    name,
    installmentCents,
    totalCount,
    Math.min(Math.max(paidCount, 0), totalCount),
    startMonth
  )
}

// name, rate and total apply to every month; a paidCount change counts from the given month on
export function updateInstallment(id: number, month: string, patch: InstallmentPatch): void {
  const row = db.prepare('SELECT * FROM installments WHERE id = ?').get(id) as
    InstallmentRow | undefined
  if (!row) return
  const total = patch.totalCount ?? row.total_count
  db.transaction(() => {
    db.prepare(
      'UPDATE installments SET name = ?, installment_cents = ?, total_count = ?, paid_count = ? WHERE id = ?'
    ).run(
      patch.name ?? row.name,
      patch.installmentCents ?? row.installment_cents,
      total,
      Math.min(row.paid_count, total),
      id
    )
    if (patch.paidCount !== undefined) {
      db.prepare(
        `INSERT INTO installment_months (inst_id, month, paid_count) VALUES (?, ?, ?)
         ON CONFLICT (inst_id, month) DO UPDATE SET paid_count = excluded.paid_count`
      ).run(id, month, Math.min(Math.max(patch.paidCount, 0), total))
    }
  })()
}

export function removeInstallment(id: number): void {
  db.transaction(() => {
    db.prepare('DELETE FROM installment_months WHERE inst_id = ?').run(id)
    db.prepare('DELETE FROM installments WHERE id = ?').run(id)
  })()
}

interface LoanRow {
  id: number
  name: string
  monthly_cents: number
  period_months: number | null // legacy, unused
  start_month: string
}

interface AnchorRow {
  month: string
  debt_cents: number
}

// A loan is stored as "anchors": the debt as of a given month. Any later month is projected from
// the latest anchor at or before it: each month the installment comes off the debt (down to 0).
// Editing a month writes a new anchor there, so earlier months stay put.
function loanAt(row: LoanRow, month: string): Loan | null {
  const anchor = db
    .prepare(
      `SELECT month, debt_cents FROM loan_anchors
       WHERE loan_id = ? AND month <= ? ORDER BY month DESC LIMIT 1`
    )
    .get(row.id, month) as AnchorRow | undefined
  if (!anchor) return null
  const elapsed = monthsBetween(anchor.month, month)
  return {
    id: row.id,
    name: row.name,
    debtCents: Math.max(0, anchor.debt_cents - row.monthly_cents * elapsed),
    monthlyCents: row.monthly_cents
  }
}

const previousMonth = (month: string): string => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// A loan is listed from the month it was entered. The month its debt reaches 0 is still listed
// (shown as paid off); the months after that no longer carry it.
export function listLoans(month: string): Loan[] {
  const rows = db.prepare('SELECT * FROM loans ORDER BY id').all() as LoanRow[]
  const before = previousMonth(month)
  return rows.flatMap((r) => {
    const loan = loanAt(r, month)
    if (!loan) return []
    if (loanAt(r, before)?.debtCents === 0) return []
    return [loan]
  })
}

export function addLoan(
  name: string,
  debtCents: number,
  monthlyCents: number,
  startMonth: string
): void {
  db.transaction(() => {
    const info = db
      .prepare('INSERT INTO loans (name, monthly_cents, start_month) VALUES (?, ?, ?)')
      .run(name, monthlyCents, startMonth)
    db.prepare('INSERT INTO loan_anchors (loan_id, month, debt_cents) VALUES (?, ?, ?)').run(
      info.lastInsertRowid,
      startMonth,
      debtCents
    )
  })()
}

export function updateLoan(id: number, month: string, patch: LoanPatch): void {
  const row = db.prepare('SELECT * FROM loans WHERE id = ?').get(id) as LoanRow | undefined
  if (!row) return
  db.transaction(() => {
    db.prepare('UPDATE loans SET name = ?, monthly_cents = ? WHERE id = ?').run(
      patch.name ?? row.name,
      patch.monthlyCents ?? row.monthly_cents,
      id
    )
    if (patch.debtCents !== undefined) {
      // editing a month before the loan existed makes no sense; ignore it
      if (!loanAt(row, month)) return
      db.prepare(
        `INSERT INTO loan_anchors (loan_id, month, debt_cents) VALUES (?, ?, ?)
         ON CONFLICT (loan_id, month) DO UPDATE SET debt_cents = excluded.debt_cents`
      ).run(id, month, patch.debtCents)
    }
  })()
}

export function removeLoan(id: number): void {
  db.transaction(() => {
    db.prepare('DELETE FROM loan_anchors WHERE loan_id = ?').run(id)
    db.prepare('DELETE FROM loans WHERE id = ?').run(id)
  })()
}

// Everything in the app's backup format, so the data can be imported into the browser/cloud version.
export function exportState(): BackupState {
  const rows = <T>(sql: string): T[] => db.prepare(sql).all() as T[]
  const state: BackupState = {
    version: 1,
    defs: rows<{ key: string; name: string; default_amount_cents: number; sort_order: number }>(
      'SELECT key, name, default_amount_cents, sort_order FROM bill_defs ORDER BY sort_order, rowid'
    ).map((r) => ({
      key: r.key,
      name: r.name,
      defaultAmountCents: r.default_amount_cents,
      sortOrder: r.sort_order
    })),
    payments: {},
    extras: listAllExtras(),
    subs: rows<SubscriptionRow>('SELECT * FROM subscriptions ORDER BY id').map((r) => ({
      id: r.id,
      name: r.name,
      amountCents: r.amount_cents
    })),
    subHidden: rows<{ sub_id: number; month: string }>(
      'SELECT sub_id, month FROM subscription_hidden'
    ).map((r) => `${r.sub_id}|${r.month}`),
    installments: rows<InstallmentRow>('SELECT * FROM installments ORDER BY id').map((r) => ({
      id: r.id,
      name: r.name,
      installmentCents: r.installment_cents,
      totalCount: r.total_count,
      paidCount: r.paid_count,
      startMonth: r.start_month
    })),
    installmentMonths: {},
    loans: rows<LoanRow>('SELECT * FROM loans ORDER BY id').map((r) => ({
      id: r.id,
      name: r.name,
      monthlyCents: r.monthly_cents,
      startMonth: r.start_month
    })),
    loanAnchors: {}
  }
  for (const r of rows<PaymentRow & { bill_key: string; month: string }>(
    'SELECT bill_key, month, amount_cents, paid, for_month, hidden FROM payments'
  )) {
    state.payments[`${r.bill_key}|${r.month}`] = {
      amountCents: r.amount_cents,
      paid: r.paid === 1,
      forMonth: r.for_month,
      hidden: r.hidden === 1
    }
  }
  for (const r of rows<{ inst_id: number; month: string; paid_count: number }>(
    'SELECT inst_id, month, paid_count FROM installment_months'
  )) {
    state.installmentMonths[`${r.inst_id}|${r.month}`] = r.paid_count
  }
  for (const r of rows<{ loan_id: number; month: string; debt_cents: number }>(
    'SELECT loan_id, month, debt_cents FROM loan_anchors'
  )) {
    state.loanAnchors[`${r.loan_id}|${r.month}`] = r.debt_cents
  }
  return state
}

function listAllExtras(): Extra[] {
  return (db.prepare('SELECT * FROM extras ORDER BY id').all() as ExtraRow[]).map(toExtra)
}
