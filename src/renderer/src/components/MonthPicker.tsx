import { useState } from 'react'
import { useI18n } from '../i18n'
import { MONTH_SHORT, monthLabel } from '../months'
import { PopoverButton } from './PopoverButton'

function MonthGrid({
  value,
  onPick
}: {
  value: string // YYYY-MM
  onPick: (month: string) => void
}): React.JSX.Element {
  const { lang } = useI18n()
  const [year, setYear] = useState(Number(value.slice(0, 4)))

  return (
    <div className="month-grid-wrap">
      <div className="year-nav">
        <button type="button" className="menu-item" onClick={() => setYear(year - 1)}>
          ‹
        </button>
        <strong>{year}</strong>
        <button type="button" className="menu-item" onClick={() => setYear(year + 1)}>
          ›
        </button>
      </div>
      <div className="month-grid">
        {MONTH_SHORT[lang].map((name, i) => {
          const key = `${year}-${String(i + 1).padStart(2, '0')}`
          return (
            <button
              key={key}
              type="button"
              className={`menu-item${key === value ? ' active' : ''}`}
              onClick={() => onPick(key)}
            >
              {name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function MonthPicker({
  value,
  onChange
}: {
  value: string
  onChange: (month: string) => void
}): React.JSX.Element {
  const { lang } = useI18n()
  return (
    <PopoverButton
      className="pop-trigger month-trigger"
      label={monthLabel(value, lang)}
      estimatedHeight={250}
    >
      {(close) => (
        <MonthGrid
          value={value}
          onPick={(m) => {
            if (m !== value) onChange(m)
            close()
          }}
        />
      )}
    </PopoverButton>
  )
}
