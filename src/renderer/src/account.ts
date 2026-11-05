import { createContext, useContext } from 'react'

// Who is using the app: this device only (local), or a signed-in cloud account (synced).
export interface Account {
  mode: 'local' | 'cloud'
  email?: string
  onSignIn?: () => void
  onSignOut?: () => void
}

export const AccountContext = createContext<Account | null>(null)

export const useAccount = (): Account | null => useContext(AccountContext)
