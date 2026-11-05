import { LANGS, type Lang } from '../i18n'

export function LangSwitch({
  lang,
  onChange
}: {
  lang: Lang
  onChange: (lang: Lang) => void
}): React.JSX.Element {
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          className={l === lang ? 'active' : ''}
          aria-pressed={l === lang}
          onClick={() => onChange(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
