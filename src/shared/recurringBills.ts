export interface RecurringBill {
  key: string // stable id, never change it once data exists
  name: string
  defaultAmountCents?: number // BAM, prefilled for every new month
}

// Initial list only: it is written to the database once, the first time the app runs.
// It is empty, so a fresh install starts without bills; add them in the app.
// An existing database is never touched by this list.
export const RECURRING_BILLS: RecurringBill[] = []
