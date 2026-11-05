import { signOut } from 'firebase/auth'
import { useEffect, useState } from 'react'
import App from './App'
import { AccountContext, type Account } from './account'
import { LoginScreen } from './components/LoginScreen'
import { createDataApi, timeBasedId, type DataApi } from './data/core'
import { cloudConfigured, firebaseAuth, firebaseDb } from './data/firebase'
import { firestorePersistence } from './data/cloudPersistence'
import { useI18n } from './i18n'
import { useAuthUser } from './useAuthUser'
import type { BillsApi } from '../../shared/types'

type Mode = 'local' | 'cloud'
const MODE_KEY = 'bill-tracker:mode'

function Splash(): React.JSX.Element {
  const { t } = useI18n()
  return <div className="splash">{t('auth.loading')}</div>
}

// The data of this device only (SQLite in the Mac app, localStorage in the browser)
function LocalApp({
  getLocal,
  account
}: {
  getLocal: () => Promise<BillsApi> | BillsApi
  account: Account | null
}): React.JSX.Element {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    void Promise.resolve(getLocal()).then((api) => {
      if (!alive) return
      window.api = api
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [getLocal])

  if (!ready) return <Splash />
  return (
    <AccountContext.Provider value={account}>
      <App />
    </AccountContext.Provider>
  )
}

// The signed-in user's data, synced through Firestore
function SignedIn({ uid, email }: { uid: string; email: string }): React.JSX.Element {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    let created: DataApi | undefined
    void createDataApi(firestorePersistence(firebaseDb(), uid), timeBasedId).then((api) => {
      if (!alive) {
        api.dispose()
        return
      }
      created = api
      window.api = api
      setReady(true)
    })
    return () => {
      alive = false
      created?.dispose()
    }
  }, [uid])

  if (!ready) return <Splash />
  const account: Account = {
    mode: 'cloud',
    email,
    onSignOut: () => void signOut(firebaseAuth())
  }
  return (
    <AccountContext.Provider value={account}>
      <App />
    </AccountContext.Provider>
  )
}

function CloudApp({ onUseLocal }: { onUseLocal: () => void }): React.JSX.Element {
  const user = useAuthUser()
  if (user === undefined) return <Splash />
  if (user === null) return <LoginScreen onUseLocal={onUseLocal} />
  return <SignedIn key={user.uid} uid={user.uid} email={user.email ?? ''} />
}

export default function Root({
  getLocal
}: {
  getLocal: () => Promise<BillsApi> | BillsApi
}): React.JSX.Element {
  const [mode, setModeState] = useState<Mode>(() =>
    cloudConfigured && window.localStorage.getItem(MODE_KEY) !== 'local' ? 'cloud' : 'local'
  )
  const setMode = (m: Mode): void => {
    window.localStorage.setItem(MODE_KEY, m)
    setModeState(m)
  }

  if (!cloudConfigured) return <LocalApp getLocal={getLocal} account={null} />
  if (mode === 'local') {
    return (
      <LocalApp getLocal={getLocal} account={{ mode: 'local', onSignIn: () => setMode('cloud') }} />
    )
  }
  return <CloudApp onUseLocal={() => setMode('local')} />
}
