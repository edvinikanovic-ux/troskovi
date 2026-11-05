import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { BillsApi } from '../shared/types'

// Custom APIs for renderer
const api: BillsApi = {
  list: (month) => ipcRenderer.invoke('bills:list', month),
  update: (key, month, patch) => ipcRenderer.invoke('bills:update', key, month, patch),
  addBill: (name) => ipcRenderer.invoke('defs:add', name),
  renameBill: (key, name) => ipcRenderer.invoke('defs:rename', key, name),
  hideBill: (key, month) => ipcRenderer.invoke('defs:hide', key, month),
  removeBill: (key) => ipcRenderer.invoke('defs:remove', key),
  listSubscriptions: (month) => ipcRenderer.invoke('subs:list', month),
  hideSubscription: (id, month) => ipcRenderer.invoke('subs:hide', id, month),
  addSubscription: (name, amountCents) => ipcRenderer.invoke('subs:add', name, amountCents),
  updateSubscription: (id, patch) => ipcRenderer.invoke('subs:update', id, patch),
  removeSubscription: (id) => ipcRenderer.invoke('subs:remove', id),
  listInstallments: (month) => ipcRenderer.invoke('installments:list', month),
  addInstallment: (name, installmentCents, totalCount, paidCount, startMonth) =>
    ipcRenderer.invoke(
      'installments:add',
      name,
      installmentCents,
      totalCount,
      paidCount,
      startMonth
    ),
  updateInstallment: (id, month, patch) =>
    ipcRenderer.invoke('installments:update', id, month, patch),
  removeInstallment: (id) => ipcRenderer.invoke('installments:remove', id),
  listLoans: (month) => ipcRenderer.invoke('loans:list', month),
  addLoan: (name, debtCents, monthlyCents, startMonth) =>
    ipcRenderer.invoke('loans:add', name, debtCents, monthlyCents, startMonth),
  updateLoan: (id, month, patch) => ipcRenderer.invoke('loans:update', id, month, patch),
  removeLoan: (id) => ipcRenderer.invoke('loans:remove', id),
  exportData: () => ipcRenderer.invoke('data:export'),
  listExtras: (month) => ipcRenderer.invoke('extras:list', month),
  addExtra: (month) => ipcRenderer.invoke('extras:add', month),
  updateExtra: (id, patch) => ipcRenderer.invoke('extras:update', id, patch),
  removeExtra: (id) => ipcRenderer.invoke('extras:remove', id)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
