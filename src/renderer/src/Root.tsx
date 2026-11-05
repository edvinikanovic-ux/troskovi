import { useEffect, useState } from 'react'
import App from './App'
import { useI18n } from './i18n'
import type { BillsApi } from '../../shared/types'

function Splash(): React.JSX.Element {
  const { t } = useI18n()
  return <div className="splash">{t('auth.loading')}</div>
}

// Waits for this device's data layer (SQLite in the Mac app, localStorage in the browser)
export default function Root({
  getLocal
}: {
  getLocal: () => Promise<BillsApi> | BillsApi
}): React.JSX.Element {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    void Promise.resolve(getLocal()).then((api) => {
      if (!alive) return
      // In the Mac app window.api is already this object, and Electron makes it read-only
      if (window.api !== api) window.api = api
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [getLocal])

  return ready ? <App /> : <Splash />
}
