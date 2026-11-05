import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword
} from 'firebase/auth'
import { useState } from 'react'
import { firebaseAuth } from '../data/firebase'
import { useI18n, type Key } from '../i18n'

const errorKey = (e: unknown): Key => {
  switch ((e as { code?: string }).code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'auth.err.credentials'
    case 'auth/email-already-in-use':
      return 'auth.err.exists'
    case 'auth/weak-password':
      return 'auth.err.weak'
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return 'auth.err.email'
    case 'auth/network-request-failed':
      return 'auth.err.network'
    case 'auth/too-many-requests':
      return 'auth.err.tooMany'
    default:
      return 'auth.err.generic'
  }
}

export function LoginScreen({ onUseLocal }: { onUseLocal: () => void }): React.JSX.Element {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null)

  const attempt = async (action: () => Promise<unknown>, okText?: Key): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      if (okText) setMessage({ text: t(okText), bad: false })
    } catch (e) {
      setMessage({ text: t(errorKey(e)), bad: true })
    } finally {
      setBusy(false)
    }
  }

  const auth = firebaseAuth()

  return (
    <div className="login">
      <form
        className="login-card"
        onSubmit={(e) => {
          e.preventDefault()
          void attempt(() => signInWithEmailAndPassword(auth, email.trim(), password))
        }}
      >
        <h1>{t('auth.title')}</h1>
        <p className="login-intro">{t('auth.intro')}</p>
        <label className="field">
          <span>{t('auth.email')}</span>
          <input
            className="name-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t('auth.password')}</span>
          <input
            className="name-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {message && (
          <div className={`login-message${message.bad ? ' bad' : ''}`} role="alert">
            {message.text}
          </div>
        )}
        <button className="primary" type="submit" disabled={busy}>
          {t('auth.signIn')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void attempt(() => createUserWithEmailAndPassword(auth, email.trim(), password))
          }
        >
          {t('auth.createAccount')}
        </button>
        <button
          type="button"
          className="link"
          disabled={busy}
          onClick={() =>
            void attempt(() => sendPasswordResetEmail(auth, email.trim()), 'auth.resetSent')
          }
        >
          {t('auth.forgot')}
        </button>
        <button type="button" className="link" onClick={onUseLocal}>
          {t('auth.useLocal')}
        </button>
      </form>
    </div>
  )
}
