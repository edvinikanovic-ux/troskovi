import { ipcMain } from 'electron'
import {
  assertAmount,
  assertCount,
  assertId,
  assertKey,
  assertMonth,
  cleanName,
  requireName
} from '../shared/validate'
import {
  addBillDef,
  addExtra,
  addInstallment,
  addLoan,
  addSubscription,
  hideBillForMonth,
  hideSubscriptionForMonth,
  listExtras,
  listInstallments,
  listLoans,
  listMonth,
  listSubscriptions,
  exportState,
  removeBillDef,
  renameBillDef,
  removeExtra,
  removeInstallment,
  removeLoan,
  removeSubscription,
  updateExtra,
  updateInstallment,
  updateLoan,
  updatePayment,
  updateSubscription
} from './db'
import type {
  BillPatch,
  ExtraPatch,
  InstallmentPatch,
  LoanPatch,
  SubscriptionPatch
} from '../shared/types'

export function registerIpc(): void {
  ipcMain.handle('bills:list', (_, month: string) => {
    assertMonth(month)
    return listMonth(month)
  })
  ipcMain.handle('bills:update', (_, key: string, month: string, patch: BillPatch) => {
    assertMonth(month)
    assertAmount(patch.amountCents)
    if (patch.forMonth !== undefined) assertMonth(patch.forMonth)
    updatePayment(key, month, patch)
  })
  ipcMain.handle('defs:add', (_, name: string) => {
    // A new bill starts with an empty name that is filled in directly in the table
    addBillDef(cleanName(name))
  })
  ipcMain.handle('defs:rename', (_, key: string, name: string) => {
    assertKey(key)
    renameBillDef(key, cleanName(name))
  })
  ipcMain.handle('defs:hide', (_, key: string, month: string) => {
    assertMonth(month)
    assertKey(key)
    hideBillForMonth(key, month)
  })
  ipcMain.handle('defs:remove', (_, key: string) => {
    assertKey(key)
    removeBillDef(key)
  })
  ipcMain.handle('subs:list', (_, month: string) => {
    assertMonth(month)
    return listSubscriptions(month)
  })
  ipcMain.handle('subs:hide', (_, id: number, month: string) => {
    assertId(id)
    assertMonth(month)
    hideSubscriptionForMonth(id, month)
  })
  ipcMain.handle('subs:add', (_, name: string, amountCents: number) => {
    assertAmount(amountCents)
    addSubscription(cleanName(name), amountCents)
  })
  ipcMain.handle('subs:update', (_, id: number, patch: SubscriptionPatch) => {
    assertId(id)
    assertAmount(patch.amountCents)
    updateSubscription(id, patch)
  })
  ipcMain.handle('subs:remove', (_, id: number) => {
    assertId(id)
    removeSubscription(id)
  })
  ipcMain.handle('installments:list', (_, month: string) => {
    assertMonth(month)
    return listInstallments(month)
  })
  ipcMain.handle(
    'installments:add',
    (
      _,
      name: string,
      installmentCents: number,
      totalCount: number,
      paidCount: number,
      startMonth: string
    ) => {
      assertMonth(startMonth)
      const trimmed = requireName(name)
      assertAmount(installmentCents)
      assertCount(totalCount, 1)
      assertCount(paidCount, 0)
      addInstallment(trimmed, installmentCents, totalCount, paidCount, startMonth)
    }
  )
  ipcMain.handle('installments:update', (_, id: number, month: string, patch: InstallmentPatch) => {
    assertId(id)
    assertMonth(month)
    assertAmount(patch.installmentCents)
    assertCount(patch.totalCount, 1)
    assertCount(patch.paidCount, 0)
    updateInstallment(id, month, patch)
  })
  ipcMain.handle('installments:remove', (_, id: number) => {
    assertId(id)
    removeInstallment(id)
  })
  ipcMain.handle('loans:list', (_, month: string) => {
    assertMonth(month)
    return listLoans(month)
  })
  ipcMain.handle(
    'loans:add',
    (_, name: string, debtCents: number, monthlyCents: number, startMonth: string) => {
      assertMonth(startMonth)
      assertAmount(debtCents)
      assertAmount(monthlyCents)
      addLoan(cleanName(name), debtCents, monthlyCents, startMonth)
    }
  )
  ipcMain.handle('loans:update', (_, id: number, month: string, patch: LoanPatch) => {
    assertId(id)
    assertMonth(month)
    assertAmount(patch.debtCents)
    assertAmount(patch.monthlyCents)
    updateLoan(id, month, patch)
  })
  ipcMain.handle('loans:remove', (_, id: number) => {
    assertId(id)
    removeLoan(id)
  })
  ipcMain.handle('data:export', () => JSON.stringify(exportState(), null, 2))
  ipcMain.handle('extras:list', (_, month: string) => {
    assertMonth(month)
    return listExtras(month)
  })
  ipcMain.handle('extras:add', (_, month: string) => {
    assertMonth(month)
    return addExtra(month)
  })
  ipcMain.handle('extras:update', (_, id: number, patch: ExtraPatch) => {
    assertId(id)
    assertAmount(patch.amountCents)
    updateExtra(id, patch)
  })
  ipcMain.handle('extras:remove', (_, id: number) => {
    assertId(id)
    removeExtra(id)
  })
}
