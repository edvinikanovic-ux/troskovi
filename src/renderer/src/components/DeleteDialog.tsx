import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n'
import { monthLabel } from '../months'

export function DeleteDialog({
  title,
  name,
  month,
  note,
  onThisMonth,
  onAllMonths,
  onCancel
}: {
  title: string
  name: string
  month: string
  note: string
  onThisMonth: () => void
  onAllMonths: () => void
  onCancel: () => void
}): React.JSX.Element {
  const { t, lang } = useI18n()
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3>{title}</h3>
        <p>
          {t('dlg.question')}
          <strong>{name}</strong>?
        </p>
        <div className="modal-actions">
          <button type="button" onClick={onThisMonth}>
            {t('dlg.onlyMonth', { month: monthLabel(month, lang) })}
          </button>
          <button type="button" className="primary danger" onClick={onAllMonths}>
            {t('dlg.allMonths')}
          </button>
          <button type="button" onClick={onCancel}>
            {t('dlg.cancel')}
          </button>
        </div>
        <small>{note}</small>
      </div>
    </div>,
    document.body
  )
}
