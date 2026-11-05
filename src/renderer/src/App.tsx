import { useEffect, useRef, useState } from 'react'
import { monthLabel } from './months'
import { useI18n } from './i18n'
import { LangSwitch } from './components/LangSwitch'
import { Section } from './components/Section'
import { AccountBadge } from './components/AccountBadge'
import { ThemeSwitch } from './components/ThemeSwitch'
import { MonthPicker } from './components/MonthPicker'
import { DeleteDialog } from './components/DeleteDialog'
import { StatusSelect } from './components/StatusSelect'
import type {
  BillPatch,
  Extra,
  ExtraPatch,
  Installment,
  InstallmentPatch,
  Loan,
  LoanPatch,
  MonthlyBill,
  Subscription,
  SubscriptionPatch
} from '../../shared/types'

const currency = new Intl.NumberFormat('bs-BA', { style: 'currency', currency: 'BAM' })
const formatCents = (cents: number): string => currency.format(cents / 100)

const toMonthKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

const shiftMonth = (key: string, delta: number): string => {
  const [y, m] = key.split('-').map(Number)
  return toMonthKey(new Date(y, m - 1 + delta, 1))
}

function AmountInput({
  cents,
  onCommit,
  clearZeroOnFocus = false
}: {
  cents: number
  // confirmed = Enter or the check button; plain blur only saves the amount
  onCommit: (cents: number, confirmed: boolean) => void
  clearZeroOnFocus?: boolean
}): React.JSX.Element {
  const { t } = useI18n()
  const [text, setText] = useState((cents / 100).toFixed(2))
  const inputRef = useRef<HTMLInputElement>(null)
  const skipBlur = useRef(false)

  const commit = (confirmed: boolean): void => {
    const parsed = Math.round(parseFloat(text.replace(',', '.')) * 100)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setText((cents / 100).toFixed(2))
      return
    }
    setText((parsed / 100).toFixed(2))
    if (confirmed || parsed !== cents) onCommit(parsed, confirmed)
  }

  const confirm = (): void => {
    skipBlur.current = true
    commit(true)
    inputRef.current?.blur()
  }

  return (
    <span className="amount-field">
      <input
        ref={inputRef}
        className="amount-input"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => clearZeroOnFocus && cents === 0 && setText('')}
        onBlur={() => {
          if (skipBlur.current) skipBlur.current = false
          else commit(false)
        }}
        onKeyDown={(e) => e.key === 'Enter' && confirm()}
      />
      <button
        className="confirm"
        title={t('act.saveAmount')}
        onMouseDown={(e) => e.preventDefault()}
        onClick={confirm}
      >
        ✓
      </button>
    </span>
  )
}

function NameInput({
  value,
  onCommit,
  placeholder
}: {
  value: string
  onCommit: (name: string) => void
  placeholder?: string
}): React.JSX.Element {
  const { t } = useI18n()
  const [text, setText] = useState(value)

  const commit = (): void => {
    const trimmed = text.trim()
    setText(trimmed)
    if (trimmed !== value) onCommit(trimmed)
  }

  return (
    <input
      className="name-input"
      placeholder={placeholder ?? t('ph.expenseName')}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

function CountInput({
  value,
  onCommit,
  min = 1
}: {
  value: number
  onCommit: (n: number) => void
  min?: number
}): React.JSX.Element {
  const [text, setText] = useState(String(value))

  const commit = (): void => {
    const n = parseInt(text, 10)
    if (!Number.isInteger(n) || n < min || n > 600) {
      setText(String(value))
      return
    }
    setText(String(n))
    if (n !== value) onCommit(n)
  }

  return (
    <input
      className="name-input count-input"
      inputMode="numeric"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

// Read-only text by default; switches to the real input while the row is being edited.
function NameCell({
  value,
  editing,
  placeholder,
  onCommit
}: {
  value: string
  editing: boolean
  placeholder: string
  onCommit: (name: string) => void
}): React.JSX.Element {
  const { t } = useI18n()
  if (editing) {
    return <NameInput key={value} value={value} placeholder={placeholder} onCommit={onCommit} />
  }
  return <span className={`cell-text${value ? '' : ' muted'}`}>{value || t('cell.unnamed')}</span>
}

function AmountCell({
  cents,
  editing,
  onCommit
}: {
  cents: number
  editing: boolean
  onCommit: (cents: number, confirmed: boolean) => void
}): React.JSX.Element {
  if (editing) {
    return <AmountInput key={cents} cents={cents} onCommit={onCommit} clearZeroOnFocus />
  }
  return (
    <span className="amount-field">
      <span className="amount-text">{formatCents(cents)}</span>
      {/* invisible copy of the check button so the amount lines up with the editable version */}
      <button
        className="confirm"
        style={{ visibility: 'hidden' }}
        tabIndex={-1}
        aria-hidden
        type="button"
      >
        ✓
      </button>
    </span>
  )
}

function RowActions({
  editing,
  deleteTitle,
  onEdit,
  onDelete,
  onConfirm
}: {
  editing: boolean
  deleteTitle: string
  onEdit: () => void
  onDelete: () => void
  // for rows without an editable amount: the check that would normally sit next to it
  onConfirm?: () => void
}): React.JSX.Element {
  const { t } = useI18n()
  return (
    <span className="row-actions">
      {/* While editing, the blue check next to the amount saves and closes the row */}
      {editing && onConfirm && (
        <button
          className="confirm"
          title={t('act.done')}
          aria-label={t('act.done')}
          onClick={onConfirm}
        >
          ✓
        </button>
      )}
      {!editing && (
        <button className="icon" title={t('act.edit')} aria-label={t('act.edit')} onClick={onEdit}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      )}
      <button className="icon" title={deleteTitle} onClick={onDelete}>
        ✕
      </button>
    </span>
  )
}

// A text field whose placeholder is drawn by us, so a long one can slide to its end on hover.
function PlaceholderInput({
  placeholder,
  value,
  onChange,
  inputMode
}: {
  placeholder: string
  value: string
  onChange: (value: string) => void
  inputMode?: 'decimal' | 'numeric'
}): React.JSX.Element {
  const textRef = useRef<HTMLSpanElement>(null)

  const measure = (): void => {
    const text = textRef.current
    const box = text?.parentElement
    if (!text || !box) return
    const shift = Math.max(0, text.offsetWidth - box.clientWidth)
    text.style.setProperty('--shift', `-${shift}px`)
    text.style.setProperty('--dur', `${Math.max(0.4, shift / 45)}s`)
  }

  return (
    <div className="ph-field" onMouseEnter={measure}>
      <input
        className="name-input"
        aria-label={placeholder}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value === '' && (
        <span className="ph-box">
          <span ref={textRef} className="ph-text">
            {placeholder}
          </span>
        </span>
      )}
    </div>
  )
}

function App(): React.JSX.Element {
  const { t, lang, setLang } = useI18n()
  const [month, setMonth] = useState(() => toMonthKey(new Date()))
  const [bills, setBills] = useState<MonthlyBill[]>([])
  const [error, setError] = useState<string | null>(null)
  const [extras, setExtras] = useState<Extra[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [instName, setInstName] = useState('')
  const [instRate, setInstRate] = useState('')
  const [instCount, setInstCount] = useState('')
  const [instPaid, setInstPaid] = useState('')
  const [loans, setLoans] = useState<Loan[]>([])
  const [loanName, setLoanName] = useState('')
  const [loanDebt, setLoanDebt] = useState('')
  const [loanRate, setLoanRate] = useState('')
  const [subAmount, setSubAmount] = useState('')
  const [deleting, setDeleting] = useState<MonthlyBill | null>(null)
  const [deletingSub, setDeletingSub] = useState<Subscription | null>(null)
  const [reload, setReload] = useState(0)

  // data changed on another device / a sync problem (only the cloud data layer reports these)
  useEffect(() => {
    const offChange = window.api.onChange?.(() => setReload((n) => n + 1))
    const offError = window.api.onError?.((message) => setError(message))
    return () => {
      offChange?.()
      offError?.()
    }
  }, [])

  // errors are shown as a toast; hide it again after a few seconds
  useEffect(() => {
    if (!error) return
    const id = window.setTimeout(() => setError(null), 8000)
    return () => window.clearTimeout(id)
  }, [error])
  // Rows are read-only text until their edit button is pressed. Blank rows are always editable.
  const [editing, setEditing] = useState<Set<string>>(new Set())
  const isEditing = (id: string, name: string): boolean => name === '' || editing.has(id)
  const startEdit = (id: string): void => setEditing((prev) => new Set(prev).add(id))
  const stopEdit = (id: string): void =>
    setEditing((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  useEffect(() => {
    let stale = false
    Promise.all([
      window.api.list(month),
      window.api.listExtras(month),
      window.api.listSubscriptions(month),
      window.api.listInstallments(month),
      window.api.listLoans(month)
    ])
      .then(([rows, extraRows, subRows, instRows, loanRows]) => {
        if (stale) return
        setBills(rows)
        setExtras(extraRows)
        setSubs(subRows)
        setInstallments(instRows)
        setLoans(loanRows)
        // Blank rows open in edit mode and must stay there once they get a name,
        // otherwise the row flips to read-only while the user is still filling it in.
        const blank = [
          ...rows.filter((r) => r.name === '').map((r) => `bill:${r.key}`),
          ...extraRows.filter((r) => r.name === '').map((r) => `extra:${r.id}`),
          ...subRows.filter((r) => r.name === '').map((r) => `sub:${r.id}`),
          ...instRows.filter((r) => r.name === '').map((r) => `inst:${r.id}`)
        ]
        if (blank.length > 0) setEditing((prev) => new Set([...prev, ...blank]))
        setError(null)
      })
      .catch((e: Error) => !stale && setError(e.message))
    return () => {
      stale = true
    }
  }, [month, reload])

  const update = async (key: string, patch: BillPatch): Promise<void> => {
    try {
      await window.api.update(key, month, patch)
      setReload((n) => n + 1)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    try {
      await action()
      setReload((n) => n + 1)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const updateExtra = (id: number, patch: ExtraPatch): Promise<void> =>
    run(() => window.api.updateExtra(id, patch))

  const onAddBill = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    await run(() => window.api.addBill(''))
  }

  const deleteBill = async (scope: 'month' | 'all'): Promise<void> => {
    if (!deleting) return
    const b = deleting
    setDeleting(null)
    await run(() =>
      scope === 'month' ? window.api.hideBill(b.key, b.month) : window.api.removeBill(b.key)
    )
  }

  const deleteSub = async (scope: 'month' | 'all'): Promise<void> => {
    if (!deletingSub) return
    const x = deletingSub
    setDeletingSub(null)
    await run(() =>
      scope === 'month'
        ? window.api.hideSubscription(x.id, month)
        : window.api.removeSubscription(x.id)
    )
  }

  const updateSub = (id: number, patch: SubscriptionPatch): Promise<void> =>
    run(() => window.api.updateSubscription(id, patch))

  const onAddSub = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const parsed = Math.round(parseFloat(subAmount.replace(',', '.')) * 100)
    const amountCents = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    await run(() => window.api.addSubscription('', amountCents))
    setSubAmount('')
  }

  const updateInst = (id: number, patch: InstallmentPatch): Promise<void> =>
    run(() => window.api.updateInstallment(id, month, patch))

  const onAddInst = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const installmentCents = Math.round(parseFloat(instRate.replace(',', '.')) * 100)
    const totalCount = parseInt(instCount, 10)
    const paidCount = instPaid.trim() === '' ? 0 : parseInt(instPaid, 10)
    if (
      !instName.trim() ||
      !Number.isFinite(installmentCents) ||
      installmentCents < 0 ||
      !Number.isInteger(totalCount) ||
      totalCount < 1 ||
      !Number.isInteger(paidCount) ||
      paidCount < 0
    ) {
      return
    }
    await run(() =>
      window.api.addInstallment(instName, installmentCents, totalCount, paidCount, month)
    )
    setInstName('')
    setInstRate('')
    setInstCount('')
    setInstPaid('')
  }

  const updateLoan = (id: number, patch: LoanPatch): Promise<void> =>
    run(() => window.api.updateLoan(id, month, patch))

  const onAddLoan = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const cents = (text: string): number => Math.round(parseFloat(text.replace(',', '.')) * 100)
    const debtCents = cents(loanDebt)
    const monthlyCents = cents(loanRate)
    if (
      !loanName.trim() ||
      !Number.isFinite(debtCents) ||
      debtCents < 0 ||
      !Number.isFinite(monthlyCents) ||
      monthlyCents < 0
    ) {
      return
    }
    await run(() => window.api.addLoan(loanName, debtCents, monthlyCents, month))
    setLoanName('')
    setLoanDebt('')
    setLoanRate('')
  }

  const onRemoveLoan = (x: Loan): Promise<void> | void => {
    if (!window.confirm(t('loan.confirmDelete', { name: x.name }))) return
    return run(() => window.api.removeLoan(x.id))
  }

  const loansDebtTotal = loans.reduce((sum, x) => sum + x.debtCents, 0)
  const loanDone = (x: Loan): boolean => x.debtCents === 0
  const loansMonthlyTotal = loans.reduce((sum, x) => sum + (loanDone(x) ? 0 : x.monthlyCents), 0)

  const remaining = (x: Installment): number => (x.totalCount - x.paidCount) * x.installmentCents
  const installmentsRemaining = installments.reduce((sum, x) => sum + remaining(x), 0)
  // what is due every month: the rate of every installment that is not fully paid yet
  const installmentsMonthly = installments.reduce(
    (sum, x) => sum + (x.paidCount < x.totalCount ? x.installmentCents : 0),
    0
  )

  const subsTotal = subs.reduce((sum, x) => sum + x.amountCents, 0)

  const onExport = async (): Promise<void> => {
    const json = await window.api.exportData?.()
    if (!json) return
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `troskovi-backup-${new Date().toLocaleDateString('sv-SE')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !window.confirm(t('backup.confirm'))) return
    await run(async () => window.api.importData?.(await file.text()))
  }

  const extrasTotal = extras.reduce((sum, x) => sum + x.amountCents, 0)

  const total = bills.reduce((sum, b) => sum + b.amountCents, 0)

  return (
    <div className="app">
      <div className="titlebar" />
      <div className="topbar">
        <AccountBadge />
        <ThemeSwitch />
        <LangSwitch lang={lang} onChange={setLang} />
      </div>
      <div className="month-nav">
        <button onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <h1>{monthLabel(month, lang)}</h1>
        <button onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </div>

      {error && (
        <div className="error" role="alert" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <Section id="bills" title={t('section.bills')}>
        <table className="bills bills-main">
          <thead>
            <tr>
              <th>{t('col.status')}</th>
              <th>{t('col.bill')}</th>
              <th>{t('col.forMonth')}</th>
              <th className="right">
                <span className="amount-field">
                  <span className="amount-label">{t('col.amount')}</span>
                  {/* invisible copy of the check button so the label lines up with the input below it */}
                  <button
                    className="confirm"
                    style={{ visibility: 'hidden' }}
                    tabIndex={-1}
                    aria-hidden
                  >
                    ✓
                  </button>
                </span>
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bills.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  {t('empty.bills')}
                </td>
              </tr>
            )}
            {bills.map((b) => {
              const id = `bill:${b.key}`
              const ed = isEditing(id, b.name)
              return (
                <tr key={b.key}>
                  <td>
                    <StatusSelect paid={b.paid} onChange={(paid) => update(b.key, { paid })} />
                  </td>
                  <td>
                    <NameCell
                      value={b.name}
                      editing={ed}
                      placeholder={t('ph.billName')}
                      onCommit={(name) => run(() => window.api.renameBill(b.key, name))}
                    />
                  </td>
                  <td data-label={t('col.forMonth')}>
                    {ed ? (
                      <MonthPicker
                        value={b.forMonth}
                        onChange={(forMonth) => update(b.key, { forMonth })}
                      />
                    ) : (
                      <span className="cell-text">{monthLabel(b.forMonth, lang)}</span>
                    )}
                  </td>
                  <td className="right" data-label={t('col.amount')}>
                    <AmountCell
                      cents={b.amountCents}
                      editing={ed}
                      onCommit={(amountCents, confirmed) => {
                        if (confirmed) stopEdit(id)
                        return update(
                          b.key,
                          confirmed ? { amountCents, paid: true } : { amountCents }
                        )
                      }}
                    />
                  </td>
                  <td className="right">
                    <RowActions
                      editing={ed}
                      deleteTitle={t('act.deleteBill')}
                      onEdit={() => startEdit(id)}
                      onDelete={() => setDeleting(b)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="right table-total">
                <span>{t('total.bills')}</span>
                <strong>{formatCents(total)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>

        <form className="add-bill" onSubmit={onAddBill}>
          <button className="primary" type="submit">
            {t('btn.addBill')}
          </button>
        </form>
      </Section>

      <Section
        id="extras"
        title={
          <>
            {t('section.extras')} <span className="h2-hint">{t('section.extrasHint')}</span>
          </>
        }
      >
        <table className="bills bills-extras">
          <thead>
            <tr>
              <th>{t('col.name')}</th>
              <th className="right">
                <span className="amount-field">
                  <span className="amount-label">{t('col.amount')}</span>
                  {/* invisible copy of the check button so the label lines up with the input above it */}
                  <button
                    className="confirm"
                    style={{ visibility: 'hidden' }}
                    tabIndex={-1}
                    aria-hidden
                  >
                    ✓
                  </button>
                </span>
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {extras.length === 0 && (
              <tr>
                <td colSpan={3} className="empty">
                  {t('empty.extras')}
                </td>
              </tr>
            )}
            {extras.map((x) => {
              const id = `extra:${x.id}`
              const ed = isEditing(id, x.name)
              return (
                <tr key={x.id}>
                  <td>
                    <NameCell
                      value={x.name}
                      editing={ed}
                      placeholder={t('ph.expenseName')}
                      onCommit={(name) => updateExtra(x.id, { name })}
                    />
                  </td>
                  <td className="right" data-label={t('col.amount')}>
                    <AmountCell
                      cents={x.amountCents}
                      editing={ed}
                      onCommit={(amountCents, confirmed) => {
                        if (confirmed) stopEdit(id)
                        return updateExtra(x.id, { amountCents })
                      }}
                    />
                  </td>
                  <td className="right">
                    <RowActions
                      editing={ed}
                      deleteTitle={t('act.delete')}
                      onEdit={() => startEdit(id)}
                      onDelete={() => run(() => window.api.removeExtra(x.id))}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="right table-total">
                <span>{t('total.extras')}</span>
                <strong>{formatCents(extrasTotal)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
        <button className="primary add-extra" onClick={() => run(() => window.api.addExtra(month))}>
          {t('btn.addExtra')}
        </button>
      </Section>
      <Section id="subscriptions" title={t('section.subs')}>
        <table className="bills bills-subs">
          <thead>
            <tr>
              <th>{t('col.name')}</th>
              <th className="right">
                <span className="amount-field">
                  <span className="amount-label">{t('col.fixedAmount')}</span>
                  {/* invisible copy of the check button so the label lines up with the input above it */}
                  <button
                    className="confirm"
                    style={{ visibility: 'hidden' }}
                    tabIndex={-1}
                    aria-hidden
                  >
                    ✓
                  </button>
                </span>
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {subs.length === 0 && (
              <tr>
                <td colSpan={3} className="empty">
                  {t('empty.subs')}
                </td>
              </tr>
            )}
            {subs.map((x) => {
              const id = `sub:${x.id}`
              const ed = isEditing(id, x.name)
              return (
                <tr key={x.id}>
                  <td>
                    <NameCell
                      value={x.name}
                      editing={ed}
                      placeholder={t('ph.subName')}
                      onCommit={(name) => updateSub(x.id, { name })}
                    />
                  </td>
                  <td className="right" data-label={t('col.fixedAmount')}>
                    <AmountCell
                      cents={x.amountCents}
                      editing={ed}
                      onCommit={(amountCents, confirmed) => {
                        if (confirmed) stopEdit(id)
                        return updateSub(x.id, { amountCents })
                      }}
                    />
                  </td>
                  <td className="right">
                    <RowActions
                      editing={ed}
                      deleteTitle={t('act.delete')}
                      onEdit={() => startEdit(id)}
                      onDelete={() => setDeletingSub(x)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="right table-total">
                <span>{t('total.subs')}</span>
                <strong>{formatCents(subsTotal)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
        <form className="add-sub" onSubmit={onAddSub}>
          <button className="primary" type="submit">
            {t('btn.addSub')}
          </button>
        </form>
      </Section>

      <Section id="installments" title={t('section.installments')}>
        <table className="bills bills-installments">
          <thead>
            <tr>
              <th>{t('col.name')}</th>
              <th className="right">
                <span className="amount-field">
                  <span className="amount-label">{t('col.rate')}</span>
                  {/* invisible copy of the check button so the label lines up with the input below it */}
                  <button
                    className="confirm"
                    style={{ visibility: 'hidden' }}
                    tabIndex={-1}
                    aria-hidden
                  >
                    ✓
                  </button>
                </span>
              </th>
              <th>{t('col.paidCount')}</th>
              <th className="right">{t('col.remaining')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {installments.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  {t('empty.installments')}
                </td>
              </tr>
            )}
            {installments.map((x) => {
              const id = `inst:${x.id}`
              const ed = isEditing(id, x.name)
              return (
                <tr key={x.id}>
                  <td>
                    <NameCell
                      value={x.name}
                      editing={ed}
                      placeholder={t('ph.name')}
                      onCommit={(name) => updateInst(x.id, { name })}
                    />
                  </td>
                  <td className="right" data-label={t('col.rate')}>
                    <AmountCell cents={x.installmentCents} editing={false} onCommit={() => {}} />
                  </td>
                  <td data-label={t('col.paidCount')}>
                    <span className="stepper">
                      <button
                        className="icon"
                        title={t('inst.less')}
                        disabled={x.paidCount <= 0}
                        onClick={() => updateInst(x.id, { paidCount: x.paidCount - 1 })}
                      >
                        −
                      </button>
                      <span className="stepper-value">{x.paidCount} /</span>
                      {ed ? (
                        <CountInput
                          key={`${x.id}-${x.totalCount}`}
                          value={x.totalCount}
                          onCommit={(totalCount) => updateInst(x.id, { totalCount })}
                        />
                      ) : (
                        <span className="stepper-value">{x.totalCount}</span>
                      )}
                      <button
                        className="icon"
                        title={t('inst.more')}
                        disabled={x.paidCount >= x.totalCount}
                        onClick={() => updateInst(x.id, { paidCount: x.paidCount + 1 })}
                      >
                        +
                      </button>
                    </span>
                  </td>
                  <td className="right" data-label={t('col.remaining')}>
                    {x.paidCount >= x.totalCount ? (
                      <span className="paid-off">{t('inst.paidOff')}</span>
                    ) : (
                      formatCents(remaining(x))
                    )}
                  </td>
                  <td className="right">
                    <RowActions
                      editing={ed}
                      deleteTitle={t('act.delete')}
                      onEdit={() => startEdit(id)}
                      onConfirm={() => stopEdit(id)}
                      onDelete={() => run(() => window.api.removeInstallment(x.id))}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="right table-total">
                <span>{t('total.installmentsMonthly')}</span>
                <strong>{formatCents(installmentsMonthly)}</strong>
                <span className="total-gap">{t('total.installments')}</span>
                <strong>{formatCents(installmentsRemaining)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="hint">{t('inst.hint')}</p>
        <form className="add-inst" onSubmit={onAddInst}>
          <PlaceholderInput
            placeholder={t('ph.instName')}
            value={instName}
            onChange={setInstName}
          />
          <PlaceholderInput
            placeholder={t('ph.instRate')}
            inputMode="decimal"
            value={instRate}
            onChange={setInstRate}
          />
          <PlaceholderInput
            placeholder={t('ph.instCount')}
            inputMode="numeric"
            value={instCount}
            onChange={setInstCount}
          />
          <PlaceholderInput
            placeholder={t('ph.instPaid')}
            inputMode="numeric"
            value={instPaid}
            onChange={setInstPaid}
          />
          <button className="primary" type="submit">
            {t('btn.addInst')}
          </button>
        </form>
      </Section>

      <Section id="loans" title={t('section.loans')}>
        <table className="bills bills-loans">
          <thead>
            <tr>
              <th>{t('col.name')}</th>
              <th className="right">
                <span className="amount-field">
                  <span className="amount-label">{t('col.debt')}</span>
                  {/* invisible copy of the check button so the label lines up with the input below it */}
                  <button
                    className="confirm"
                    style={{ visibility: 'hidden' }}
                    tabIndex={-1}
                    aria-hidden
                  >
                    ✓
                  </button>
                </span>
              </th>
              <th className="right">
                <span className="amount-field">
                  <span className="amount-label">{t('col.rate')}</span>
                  <button
                    className="confirm"
                    style={{ visibility: 'hidden' }}
                    tabIndex={-1}
                    aria-hidden
                  >
                    ✓
                  </button>
                </span>
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loans.length === 0 && (
              <tr>
                <td colSpan={4} className="empty">
                  {t('empty.loans')}
                </td>
              </tr>
            )}
            {loans.map((x) => {
              const id = `loan:${x.id}`
              const ed = isEditing(id, x.name)
              return (
                <tr key={x.id}>
                  <td>
                    <NameCell
                      value={x.name}
                      editing={ed}
                      placeholder={t('ph.loanName')}
                      onCommit={(name) => updateLoan(x.id, { name })}
                    />
                  </td>
                  <td className="right" data-label={t('col.debt')}>
                    {!ed && loanDone(x) ? (
                      <span className="paid-off">{t('inst.paidOff')}</span>
                    ) : (
                      <AmountCell
                        cents={x.debtCents}
                        editing={ed}
                        onCommit={(debtCents, confirmed) => {
                          if (confirmed) stopEdit(id)
                          return updateLoan(x.id, { debtCents })
                        }}
                      />
                    )}
                  </td>
                  <td className="right" data-label={t('col.rate')}>
                    <AmountCell
                      cents={x.monthlyCents}
                      editing={ed}
                      onCommit={(monthlyCents, confirmed) => {
                        if (confirmed) stopEdit(id)
                        return updateLoan(x.id, { monthlyCents })
                      }}
                    />
                  </td>
                  <td className="right">
                    <RowActions
                      editing={ed}
                      deleteTitle={t('act.delete')}
                      onEdit={() => startEdit(id)}
                      onDelete={() => onRemoveLoan(x)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="right table-total">
                <span>{t('total.loansMonthly')}</span>
                <strong>{formatCents(loansMonthlyTotal)}</strong>
                <span className="total-gap">{t('total.loansDebt')}</span>
                <strong>{formatCents(loansDebtTotal)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="hint">{t('loan.hint')}</p>
        <form className="add-loan" onSubmit={onAddLoan}>
          <PlaceholderInput
            placeholder={t('ph.loanName')}
            value={loanName}
            onChange={setLoanName}
          />
          <PlaceholderInput
            placeholder={t('ph.loanDebt')}
            inputMode="decimal"
            value={loanDebt}
            onChange={setLoanDebt}
          />
          <PlaceholderInput
            placeholder={t('ph.instRate')}
            inputMode="decimal"
            value={loanRate}
            onChange={setLoanRate}
          />
          <button className="primary" type="submit">
            {t('btn.addLoan')}
          </button>
        </form>
      </Section>

      {window.api.exportData && (
        <div className="backup">
          <button type="button" onClick={onExport}>
            {t('backup.export')}
          </button>
          {window.api.importData && (
            <label className="button-like">
              <input type="file" accept="application/json,.json" onChange={onImport} />
              <span>{t('backup.import')}</span>
            </label>
          )}
        </div>
      )}

      {deleting && (
        <DeleteDialog
          title={t('dlg.deleteBill')}
          name={deleting.name || t('dlg.thisBill')}
          month={deleting.month}
          note={t('dlg.noteBill')}
          onThisMonth={() => deleteBill('month')}
          onAllMonths={() => deleteBill('all')}
          onCancel={() => setDeleting(null)}
        />
      )}
      {deletingSub && (
        <DeleteDialog
          title={t('dlg.deleteSub')}
          name={deletingSub.name || t('dlg.thisSub')}
          month={month}
          note={t('dlg.noteSub')}
          onThisMonth={() => deleteSub('month')}
          onAllMonths={() => deleteSub('all')}
          onCancel={() => setDeletingSub(null)}
        />
      )}
    </div>
  )
}

export default App
