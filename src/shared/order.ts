// The order of the sections on the page and of the rows inside them, set by dragging. Shared by the
// SQLite layer (src/main/db.ts) and the browser/cloud layer, so both reorder in exactly the same way.

export type SectionId = 'bills' | 'extras' | 'subscriptions' | 'installments' | 'loans'

// the default order, also used for sections a saved order does not know yet
export const SECTION_IDS: SectionId[] = [
  'bills',
  'extras',
  'subscriptions',
  'installments',
  'loans'
]

// A saved order made usable: unknown and repeated entries are dropped, missing sections go to the end.
export function sectionOrder(saved: readonly string[] | null | undefined): SectionId[] {
  const known = (saved ?? []).filter((id): id is SectionId => SECTION_IDS.includes(id as SectionId))
  return [...new Set([...known, ...SECTION_IDS])]
}

// The whole list in its new order after the user moved the rows shown in the open month (`shown`, in
// their new order). Rows that exist but are not shown (hidden for that month, not started yet, paid
// off) keep their place; ids that are no longer in the list are ignored.
export function moveRows(all: string[], shown: string[]): string[] {
  const known = new Set(all)
  const next = shown.filter((id) => known.has(id))
  const moving = new Set(next)
  let i = 0
  return all.map((id) => (moving.has(id) ? next[i++] : id))
}
