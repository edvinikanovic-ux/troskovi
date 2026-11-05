import { useI18n } from '../i18n'
import { PopoverButton } from './PopoverButton'

export function StatusSelect({
  paid,
  onChange
}: {
  paid: boolean
  onChange: (paid: boolean) => void
}): React.JSX.Element {
  const { t } = useI18n()
  return (
    <PopoverButton
      className={`pop-trigger status ${paid ? 'is-paid' : 'is-unpaid'}`}
      label={paid ? t('status.paid') : t('status.unpaid')}
    >
      {(close) => (
        <div className="menu">
          {[
            { value: false, text: t('status.unpaid') },
            { value: true, text: t('status.paid') }
          ].map((o) => (
            <button
              key={String(o.value)}
              type="button"
              className={`menu-item${o.value === paid ? ' active' : ''}`}
              onClick={() => {
                if (o.value !== paid) onChange(o.value)
                close()
              }}
            >
              <span className={`dot ${o.value ? 'is-paid' : 'is-unpaid'}`} />
              {o.text}
            </button>
          ))}
        </div>
      )}
    </PopoverButton>
  )
}
