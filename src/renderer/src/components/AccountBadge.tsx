import { useAccount } from '../account'
import { useI18n } from '../i18n'

// Shows whether the data is synced to an account or only on this device.
export function AccountBadge(): React.JSX.Element | null {
  const account = useAccount()
  const { t } = useI18n()
  if (!account) return null

  return account.mode === 'cloud' ? (
    <div className="account">
      <span className="account-email" title={account.email}>
        {account.email}
      </span>
      <button type="button" onClick={account.onSignOut}>
        {t('auth.signOut')}
      </button>
    </div>
  ) : (
    <div className="account">
      <span className="account-email">{t('auth.localOnly')}</span>
      <button type="button" onClick={account.onSignIn}>
        {t('auth.signInToSync')}
      </button>
    </div>
  )
}
