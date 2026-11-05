import type { SectionId } from './order'

export interface MonthlyBill {
  key: string // id from recurringBills.ts
  name: string
  month: string // YYYY-MM, the month the row is shown under
  forMonth: string // YYYY-MM, the month the payment covers (defaults to month)
  amountCents: number // BAM
  paid: boolean
}

export interface BillPatch {
  paid?: boolean
  forMonth?: string
  amountCents?: number
}

export interface Extra {
  id: number
  month: string // YYYY-MM
  name: string
  amountCents: number // BAM
}

export interface ExtraPatch {
  name?: string
  amountCents?: number
}

export interface Subscription {
  id: number
  name: string
  amountCents: number // fixed monthly amount, BAM
}

export interface SubscriptionPatch {
  name?: string
  amountCents?: number
}

export interface Installment {
  id: number
  name: string
  installmentCents: number // monthly installment, BAM
  totalCount: number // number of installments
  paidCount: number // installments paid as of the listed month (0..totalCount)
}

export interface InstallmentPatch {
  name?: string
  installmentCents?: number
  totalCount?: number
  paidCount?: number
}

export interface Loan {
  id: number
  name: string
  debtCents: number // remaining debt as of the listed month, BAM
  monthlyCents: number // monthly installment
}

export interface LoanPatch {
  name?: string
  monthlyCents?: number
  // the state as of the month being edited; it carries forward from that month
  debtCents?: number
}

export interface BillsApi {
  list: (month: string) => Promise<MonthlyBill[]> // month: YYYY-MM
  update: (key: string, month: string, patch: BillPatch) => Promise<void>
  addBill: (name: string) => Promise<void>
  renameBill: (key: string, name: string) => Promise<void>
  hideBill: (key: string, month: string) => Promise<void> // only that month
  removeBill: (key: string) => Promise<void> // all months
  listSubscriptions: (month: string) => Promise<Subscription[]>
  addSubscription: (name: string, amountCents: number) => Promise<void>
  updateSubscription: (id: number, patch: SubscriptionPatch) => Promise<void>
  hideSubscription: (id: number, month: string) => Promise<void> // only that month
  removeSubscription: (id: number) => Promise<void> // all months
  listInstallments: (month: string) => Promise<Installment[]>
  addInstallment: (
    name: string,
    installmentCents: number,
    totalCount: number,
    paidCount: number,
    startMonth: string
  ) => Promise<void>
  updateInstallment: (id: number, month: string, patch: InstallmentPatch) => Promise<void>
  removeInstallment: (id: number) => Promise<void>
  listLoans: (month: string) => Promise<Loan[]>
  addLoan: (
    name: string,
    debtCents: number,
    monthlyCents: number,
    startMonth: string
  ) => Promise<void>
  updateLoan: (id: number, month: string, patch: LoanPatch) => Promise<void>
  removeLoan: (id: number) => Promise<void>
  listExtras: (month: string) => Promise<Extra[]>
  addExtra: (month: string) => Promise<Extra>
  updateExtra: (id: number, patch: ExtraPatch) => Promise<void>
  removeExtra: (id: number) => Promise<void>
  // Drag and drop: `ids` are the rows shown in `month` in their new order (bill keys, or the ids of
  // the other lists as text). Extra expenses are ordered per month, the other lists for all months.
  reorderRows: (list: SectionId, month: string, ids: string[]) => Promise<void>
  getSectionOrder: () => Promise<SectionId[]>
  setSectionOrder: (order: SectionId[]) => Promise<void>
  // Backup: the Electron app (SQLite) can export; the browser/cloud data layer can export and import.
  exportData?: () => Promise<string>
  importData?: (json: string) => Promise<void>
  // Browser/cloud data layer only: tell the UI when data changed (e.g. on another device) or failed
  onChange?: (cb: () => void) => () => void
  onError?: (cb: (message: string) => void) => () => void
  dispose?: () => void
}
