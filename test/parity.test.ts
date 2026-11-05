// Runs one scenario against the real SQLite layer (src/main/db.ts) and against the browser/cloud data
// layer (src/renderer/src/data/core.ts) and requires identical results. Also tests the move of data
// from SQLite to the other layer, and two devices syncing through one shared backend.
import assert from 'node:assert/strict'
import * as db from '../src/main/db'
import {
  createDataApi,
  timeBasedId,
  type DataApi,
  type Op,
  type Persistence
} from '../src/renderer/src/data/core'
import { localPersistence } from '../src/renderer/src/data/localPersistence'
import { docId, type Item } from '../src/shared/items'
import { SECTION_IDS, type SectionId } from '../src/shared/order'
import type { BillsApi } from '../src/shared/types'

db.initDb()

const sqliteApi: BillsApi = {
  list: async (m) => db.listMonth(m),
  update: async (k, m, p) => db.updatePayment(k, m, p),
  addBill: async (n) => db.addBillDef(n),
  renameBill: async (k, n) => db.renameBillDef(k, n),
  hideBill: async (k, m) => db.hideBillForMonth(k, m),
  removeBill: async (k) => db.removeBillDef(k),
  listSubscriptions: async (m) => db.listSubscriptions(m),
  addSubscription: async (n, c) => db.addSubscription(n, c),
  updateSubscription: async (i, p) => db.updateSubscription(i, p),
  hideSubscription: async (i, m) => db.hideSubscriptionForMonth(i, m),
  removeSubscription: async (i) => db.removeSubscription(i),
  listInstallments: async (m) => db.listInstallments(m),
  addInstallment: async (n, r, t, p, s) => db.addInstallment(n, r, t, p, s),
  updateInstallment: async (i, m, p) => db.updateInstallment(i, m, p),
  removeInstallment: async (i) => db.removeInstallment(i),
  listLoans: async (m) => db.listLoans(m),
  addLoan: async (n, d, r, s) => db.addLoan(n, d, r, s),
  updateLoan: async (i, m, p) => db.updateLoan(i, m, p),
  removeLoan: async (i) => db.removeLoan(i),
  listExtras: async (m) => db.listExtras(m),
  addExtra: async (m) => db.addExtra(m),
  updateExtra: async (i, p) => db.updateExtra(i, p),
  removeExtra: async (i) => db.removeExtra(i),
  reorderRows: async (l, m, i) => db.reorderRows(l, m, i),
  getSectionOrder: async () => db.getSectionOrder(),
  setSectionOrder: async (o) => db.setSectionOrder(o)
}

const memory = (): Pick<Storage, 'getItem' | 'setItem'> => {
  const data = new Map<string, string>()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}
let storeApi: DataApi

type Trace = [string, unknown][]

async function scenario(api: BillsApi): Promise<Trace> {
  const trace: Trace = []
  // bill keys are random, so traces show the position instead of the key
  const bills = async (m: string): Promise<unknown> =>
    (await api.list(m)).map((b) => ({ ...b, key: undefined }))
  const keys = async (m: string): Promise<string[]> => (await api.list(m)).map((b) => b.key)
  const rec = async (label: string, value: Promise<unknown> | unknown): Promise<void> => {
    trace.push([label, await value])
  }

  // ---- bills
  await api.addBill('Struja')
  await api.addBill('Voda')
  await api.addBill('')
  const [struja, voda, blank] = await keys('2026-10')
  await rec('bills oct', bills('2026-10'))
  await api.update(struja, '2026-10', { amountCents: 4550, paid: true, forMonth: '2026-08' })
  await api.update(voda, '2026-11', { paid: true })
  await rec('bills oct after update', bills('2026-10'))
  await rec('bills nov', bills('2026-11'))
  await api.hideBill(voda, '2026-10')
  await rec('bills oct after hide', bills('2026-10'))
  await rec('bills nov after hide', bills('2026-11'))
  await api.renameBill(blank, 'Internet')
  await api.removeBill(struja)
  await rec('bills after rename+remove', bills('2026-11'))
  await rec(
    'unknown bill',
    api.update('nope', '2026-10', {}).then(
      () => 'ok',
      (e: Error) => e.message
    )
  )

  // ---- extras
  const x1 = await api.addExtra('2026-10')
  const x2 = await api.addExtra('2026-10')
  await api.addExtra('2026-11')
  await api.updateExtra(x1.id, { name: 'Gorivo', amountCents: 6000 })
  await api.updateExtra(x2.id, { name: 'Servis sata' })
  await api.removeExtra(x2.id)
  await rec('extras oct', api.listExtras('2026-10'))
  await rec('extras nov', api.listExtras('2026-11'))

  // ---- subscriptions
  await api.addSubscription('Netflix', 1299)
  await api.addSubscription('', 0)
  const subs = await api.listSubscriptions('2026-10')
  await api.hideSubscription(subs[0].id, '2026-11')
  await api.updateSubscription(subs[1].id, { name: 'Spotify', amountCents: 899 })
  await rec('subs oct', api.listSubscriptions('2026-10'))
  await rec('subs nov', api.listSubscriptions('2026-11'))
  await api.removeSubscription(subs[0].id)
  await rec('subs after remove', api.listSubscriptions('2026-12'))

  // ---- installments (the paid count carries +1 per month; a manual change re-anchors from that month)
  await api.addInstallment('TV', 5000, 10, 4, '2026-01')
  await api.addInstallment('Telefon', 3000, 3, 0, '2026-03')
  const months = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-05', '2026-08', '2026-12']
  for (const m of months) await rec(`inst ${m}`, api.listInstallments(m))
  await api.updateInstallment(1, '2026-03', { paidCount: 8 })
  for (const m of ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06']) {
    await rec(`inst after set Mar=8 ${m}`, api.listInstallments(m))
  }
  await api.updateInstallment(1, '2026-04', {
    totalCount: 6,
    name: 'TV 4K',
    installmentCents: 5500
  })
  await rec('inst after total=6', api.listInstallments('2026-05'))
  await api.removeInstallment(2)
  await rec('inst after remove', api.listInstallments('2026-05'))

  // ---- loans (debt falls by the installment each month; the payoff month is shown, later months are not)
  await api.addLoan('Stan', 3000000, 50000, '2026-10')
  await api.addLoan('Auto', 1500, 500, '2026-10')
  for (const m of ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03']) {
    await rec(`loans ${m}`, api.listLoans(m))
  }
  await api.updateLoan(1, '2026-12', { debtCents: 2850000 })
  await api.updateLoan(1, '2026-08', { debtCents: 1 }) // before the loan existed: debt change ignored
  await api.updateLoan(2, '2026-11', { name: 'Auto 2', monthlyCents: 700 })
  for (const m of ['2026-11', '2026-12', '2027-01', '2027-02']) {
    await rec(`loans after fix ${m}`, api.listLoans(m))
  }
  await api.removeLoan(2)
  await rec('loans after remove', api.listLoans('2027-01'))

  // ---- order (rows dragged in one month; rows not shown there keep their place)
  const names = async (rows: Promise<{ name: string }[]>): Promise<string[]> =>
    (await rows).map((r) => r.name)
  const idsOf = async (rows: Promise<{ id: number }[]>): Promise<string[]> =>
    (await rows).map((r) => String(r.id))

  await api.addBill('Plin')
  await api.addBill('Telefon')
  await rec('bills order oct (Voda hidden)', names(api.list('2026-10')))
  const [internet, plin, telefon] = await keys('2026-10')
  await api.reorderRows('bills', '2026-10', [telefon, internet, plin])
  await rec('bills order oct after drag', names(api.list('2026-10')))
  await rec('bills order nov after drag in oct', names(api.list('2026-11')))
  const [vodaKey, ...rest] = await keys('2026-11')
  await api.reorderRows('bills', '2026-11', [...rest, vodaKey])
  await rec('bills order nov after Voda to the end', names(api.list('2026-11')))
  await api.addBill('Grijanje')
  await rec('bills order: a new bill goes to the end', names(api.list('2026-11')))

  const x3 = await api.addExtra('2026-10')
  const x4 = await api.addExtra('2026-10')
  await api.updateExtra(x3.id, { name: 'Kino' })
  await api.updateExtra(x4.id, { name: 'Pokloni' })
  await api.reorderRows('extras', '2026-10', [String(x4.id), String(x1.id), String(x3.id)])
  await rec('extras order oct after drag', names(api.listExtras('2026-10')))
  await rec('extras order nov untouched', api.listExtras('2026-11'))
  const x5 = await api.addExtra('2026-10')
  await api.updateExtra(x5.id, { name: 'Taxi' })
  await rec('extras order: a new one goes to the end', names(api.listExtras('2026-10')))

  await api.addSubscription('HBO', 999)
  await api.addSubscription('YouTube', 1199)
  const [spotify, hbo, youtube] = await idsOf(api.listSubscriptions('2026-12'))
  await api.hideSubscription(Number(hbo), '2026-12')
  // an id deleted meanwhile (e.g. on another device) is ignored
  await api.reorderRows('subscriptions', '2026-12', [youtube, '999999', spotify])
  await rec('subs order dec after drag', names(api.listSubscriptions('2026-12')))
  await rec('subs order nov (HBO kept its place)', names(api.listSubscriptions('2026-11')))
  await api.addSubscription('Disney', 0)
  await rec('subs order: a new one goes to the end', names(api.listSubscriptions('2026-11')))

  await api.addInstallment('Laptop', 10000, 12, 0, '2026-06')
  await api.addInstallment('Frizider', 8000, 6, 0, '2026-09')
  await rec('inst order jul', names(api.listInstallments('2026-07')))
  await api.reorderRows(
    'installments',
    '2026-07',
    (await idsOf(api.listInstallments('2026-07'))).reverse()
  )
  await rec('inst order jul after drag', names(api.listInstallments('2026-07')))
  await rec('inst order oct (not started yet in jul)', names(api.listInstallments('2026-10')))

  await api.addLoan('Kartica', 1000, 500, '2026-10')
  await api.addLoan('Auto novi', 900000, 30000, '2026-10')
  await rec('loans order jan (Kartica paid off)', names(api.listLoans('2027-01')))
  await api.reorderRows('loans', '2027-01', (await idsOf(api.listLoans('2027-01'))).reverse())
  await rec('loans order jan after drag', names(api.listLoans('2027-01')))
  await rec('loans order nov after drag in jan', names(api.listLoans('2026-11')))

  await rec('sections default', api.getSectionOrder())
  await api.setSectionOrder(['loans', 'bills', 'extras', 'subscriptions', 'installments'])
  await rec('sections after drag', api.getSectionOrder())

  return trace
}

async function main(): Promise<void> {
  storeApi = await createDataApi(localPersistence(memory()))
  const [fromSqlite, fromStore] = [await scenario(sqliteApi), await scenario(storeApi)]
  assert.equal(fromStore.length, fromSqlite.length)
  fromSqlite.forEach(([label, value], i) => {
    assert.deepEqual(
      JSON.parse(JSON.stringify(fromStore[i][1])),
      JSON.parse(JSON.stringify(value)),
      label
    )
  })
  console.log(`parity ok: ${fromSqlite.length} checkpoints identical`)

  // ---- the browser layer rejects the same bad input as the IPC handlers
  await assert.rejects(storeApi.list('2026-13'), /Invalid month/)
  await assert.rejects(storeApi.update('x', '2026-10', { amountCents: -1 }), /Invalid amount/)
  await assert.rejects(storeApi.addInstallment('  ', 1, 1, 0, '2026-10'), /Invalid name/)
  await assert.rejects(storeApi.addInstallment('A', 1, 0, 0, '2026-10'), /Invalid count/)
  await assert.rejects(storeApi.addLoan('L', 1.5, 1, '2026-10'), /Invalid amount/)
  await assert.rejects(storeApi.reorderRows('bills', '2026-10', ['a', 'a']), /Invalid order/)
  await assert.rejects(storeApi.reorderRows('loans', '2026-10', ['x']), /Invalid order/)
  await assert.rejects(storeApi.reorderRows('nope' as SectionId, '2026-10', []), /Invalid list/)
  await assert.rejects(storeApi.reorderRows('bills', '2026-13', []), /Invalid month/)
  await assert.rejects(storeApi.setSectionOrder(['bills']), /Invalid order/)
  await assert.rejects(
    storeApi.setSectionOrder(['bills', 'bills', 'extras', 'subscriptions', 'loans']),
    /Invalid order/
  )
  console.log('validation ok')

  // ---- export / import round trip
  const backup = await storeApi.exportData()
  const other = await createDataApi(localPersistence(memory()))
  await other.importData(backup)
  assert.deepEqual(await other.listLoans('2027-01'), await storeApi.listLoans('2027-01'))
  assert.deepEqual(
    await other.listInstallments('2026-05'),
    await storeApi.listInstallments('2026-05')
  )
  for (const m of ['2026-10', '2026-11', '2026-12']) {
    assert.deepEqual(await other.list(m), await storeApi.list(m), `backup bills ${m}`)
    assert.deepEqual(await other.listExtras(m), await storeApi.listExtras(m), `backup extras ${m}`)
    assert.deepEqual(
      await other.listSubscriptions(m),
      await storeApi.listSubscriptions(m),
      `backup subs ${m}`
    )
  }
  assert.deepEqual(await other.getSectionOrder(), await storeApi.getSectionOrder())
  await assert.rejects(other.importData('{"nope":1}'), /Invalid backup/)
  await assert.rejects(other.importData('not json'), /Invalid backup/)
  console.log('backup round trip ok')

  // ---- a backup from before rows could be dragged: no sortOrder, no sectionOrder; rows keep the
  // order by id they had, and new rows go after them
  const legacy = await createDataApi(localPersistence(memory()))
  const legacyBackup = JSON.parse(backup)
  delete legacyBackup.sectionOrder
  legacyBackup.subs = [
    { id: 7, name: 'B', amountCents: 0 },
    { id: 3, name: 'A', amountCents: 0 }
  ]
  await legacy.importData(JSON.stringify(legacyBackup))
  await legacy.addSubscription('C', 0)
  assert.deepEqual(
    (await legacy.listSubscriptions('2026-10')).map((x) => x.name),
    ['A', 'B', 'C']
  )
  assert.deepEqual(await legacy.getSectionOrder(), SECTION_IDS)
  const [a, , c] = await legacy.listSubscriptions('2026-10')
  await legacy.reorderRows('subscriptions', '2026-10', [String(c.id), String(a.id)])
  assert.deepEqual(
    (await legacy.listSubscriptions('2026-10')).map((x) => x.name),
    ['C', 'B', 'A']
  )
  console.log('old backup order ok')

  // ---- the real SQLite data moves over: export from SQLite, import into the other layer
  const moved = await createDataApi(localPersistence(memory()))
  await moved.importData(JSON.stringify(db.exportState()))
  const allMonths = [
    '2025-12',
    '2026-01',
    '2026-03',
    '2026-05',
    '2026-07',
    '2026-10',
    '2026-11',
    '2026-12',
    '2027-01',
    '2027-03'
  ]
  for (const m of allMonths) {
    assert.deepEqual(await moved.list(m), await sqliteApi.list(m), `moved bills ${m}`)
    assert.deepEqual(await moved.listExtras(m), await sqliteApi.listExtras(m), `moved extras ${m}`)
    assert.deepEqual(
      await moved.listSubscriptions(m),
      await sqliteApi.listSubscriptions(m),
      `moved subs ${m}`
    )
    assert.deepEqual(
      await moved.listInstallments(m),
      await sqliteApi.listInstallments(m),
      `moved installments ${m}`
    )
    assert.deepEqual(await moved.listLoans(m), await sqliteApi.listLoans(m), `moved loans ${m}`)
  }
  assert.deepEqual(await moved.getSectionOrder(), await sqliteApi.getSectionOrder())
  console.log('sqlite -> cloud move ok')

  await syncTests()
}

// A shared "cloud" that several devices talk to; every write is pushed to all subscribers,
// like Firestore snapshot listeners do.
function fakeCloud(): { device: () => Persistence; docs: Map<string, Item> } {
  const docs = new Map<string, Item>()
  const listeners = new Set<(items: Item[]) => void>()
  const push = (): void => listeners.forEach((cb) => cb([...docs.values()]))
  return {
    docs,
    device: () => ({
      load: async () => [...docs.values()],
      write: (ops: Op[]) => {
        for (const op of ops) {
          if (op.type === 'set') docs.set(docId(op.item.kind, op.item.id), op.item)
          else docs.delete(docId(op.kind, op.id))
        }
        push()
      },
      subscribe: (cb) => {
        listeners.add(cb)
        return () => listeners.delete(cb)
      }
    })
  }
}

async function syncTests(): Promise<void> {
  const cloud = fakeCloud()
  const phone: DataApi = await createDataApi(cloud.device(), timeBasedId)
  const mac: DataApi = await createDataApi(cloud.device(), timeBasedId)
  let macChanges = 0
  const stop = mac.onChange(() => macChanges++)

  // a change on the phone shows up on the Mac without any export/import
  await phone.addBill('Struja')
  assert.deepEqual(
    (await mac.list('2026-10')).map((b) => b.name),
    ['Struja']
  )
  assert.ok(macChanges > 0, 'the Mac is told that data changed')
  const [bill] = await mac.list('2026-10')
  await mac.update(bill.key, '2026-10', { amountCents: 4550, paid: true })
  assert.deepEqual(
    (await phone.list('2026-10')).map((b) => [b.amountCents, b.paid]),
    [[4550, true]]
  )

  // two devices edit different things: nothing is overwritten
  await phone.update(bill.key, '2026-11', { paid: true })
  await mac.update(bill.key, '2026-12', { amountCents: 1000 })
  assert.deepEqual((await mac.list('2026-11'))[0].paid, true)
  assert.deepEqual((await phone.list('2026-12'))[0].amountCents, 1000)

  // new rows created on both devices get different ids
  const ids = new Set<number>()
  for (let i = 0; i < 30; i++) {
    ids.add((await phone.addExtra('2026-10')).id)
    ids.add((await mac.addExtra('2026-10')).id)
  }
  assert.equal(ids.size, 60, 'ids are unique across devices')
  assert.equal((await phone.listExtras('2026-10')).length, 60)

  // the order set on one device is the order on the other
  await phone.addBill('Voda')
  const order = (await phone.list('2026-10')).map((b) => b.key).reverse()
  await phone.reorderRows('bills', '2026-10', order)
  assert.deepEqual(
    (await mac.list('2026-10')).map((b) => b.name),
    ['Voda', 'Struja']
  )
  await mac.setSectionOrder(['extras', 'bills', 'subscriptions', 'installments', 'loans'])
  assert.deepEqual((await phone.getSectionOrder())[0], 'extras')
  await phone.removeBill(order[0])

  // a deletion on one device reaches the other
  await mac.removeBill(bill.key)
  assert.deepEqual(await phone.list('2026-10'), [])
  assert.equal(cloud.docs.size, 61, 'only the 60 extra expenses and the section order are left')

  // a brand new device sees everything after its first sync
  const tablet = await createDataApi(cloud.device(), timeBasedId)
  assert.equal((await tablet.listExtras('2026-10')).length, 60)

  stop()
  for (const d of [phone, mac, tablet]) d.dispose()
  console.log('two-device sync ok')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
