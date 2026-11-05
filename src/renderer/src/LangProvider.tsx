import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nContext, LANGS, makeT, type Lang } from './i18n'

const STORAGE_KEY = 'bill-tracker:lang'

const initialLang = (): Lang => {
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return LANGS.find((l) => l === saved) ?? 'bs'
}

export function LangProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo(
    () => ({
      lang,
      t: makeT(lang),
      setLang: (next: Lang) => {
        window.localStorage.setItem(STORAGE_KEY, next)
        setLangState(next)
      }
    }),
    [lang]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
