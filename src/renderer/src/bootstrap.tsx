import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Root from './Root'
import { LangProvider } from './LangProvider'
import { applyPref, getSavedPref } from './theme'
import type { BillsApi } from '../../shared/types'

// Shared start-up of the Mac app and the browser build. `getLocal` returns this device's data layer
// (the SQLite one from the Electron preload, or the localStorage one in the browser).
export function start(getLocal: () => Promise<BillsApi> | BillsApi): void {
  applyPref(getSavedPref())
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <LangProvider>
        <Root getLocal={getLocal} />
      </LangProvider>
    </StrictMode>
  )
}
