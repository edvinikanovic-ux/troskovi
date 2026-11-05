import { useState } from 'react'
import { useI18n, type Key } from '../i18n'
import { THEME_PREFS, getSavedPref, savePref, type ThemePref } from '../theme'

const ICON_PROPS = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
} as const

const ICONS: Record<ThemePref, React.JSX.Element> = {
  light: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  auto: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" />
    </svg>
  ),
  dark: (
    <svg {...ICON_PROPS}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  )
}

const LABELS: Record<ThemePref, Key> = {
  light: 'theme.light',
  auto: 'theme.auto',
  dark: 'theme.dark'
}

export function ThemeSwitch(): React.JSX.Element {
  const { t } = useI18n()
  const [pref, setPref] = useState<ThemePref>(getSavedPref)

  return (
    <div className="theme-switch" role="group" aria-label="Theme">
      {THEME_PREFS.map((p) => (
        <button
          key={p}
          type="button"
          className={p === pref ? 'active' : ''}
          aria-pressed={p === pref}
          title={t(LABELS[p])}
          aria-label={t(LABELS[p])}
          onClick={() => {
            savePref(p)
            setPref(p)
          }}
        >
          {ICONS[p]}
        </button>
      ))}
    </div>
  )
}
