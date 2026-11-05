// 'auto' follows the system appearance and keeps following it while the app is open.
export type ThemePref = 'light' | 'dark' | 'auto'

export const THEME_PREFS: ThemePref[] = ['light', 'auto', 'dark']

const STORAGE_KEY = 'bill-tracker:theme'

export function getSavedPref(): ThemePref {
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return saved === 'light' || saved === 'dark' || saved === 'auto' ? saved : 'auto'
}

// light/dark pin the theme through an attribute; auto removes it so the stylesheet falls back to
// the system setting (prefers-color-scheme)
export function applyPref(pref: ThemePref): void {
  if (pref === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = pref
}

export function savePref(pref: ThemePref): void {
  window.localStorage.setItem(STORAGE_KEY, pref)
  applyPref(pref)
}
