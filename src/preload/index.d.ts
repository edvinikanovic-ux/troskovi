import { ElectronAPI } from '@electron-toolkit/preload'
import type { BillsApi } from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: BillsApi
  }
}
