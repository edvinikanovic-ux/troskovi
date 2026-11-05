import { createContext, useContext } from 'react'

export type Lang = 'bs' | 'en'

export const LANGS: Lang[] = ['bs', 'en']

const bs = {
  'section.bills': 'Računi',
  'section.extras': 'Dodatni troškovi',
  'section.extrasHint': '(npr. Gorivo, servis sata, Ray-Ban..)',
  'section.subs': 'Pretplate',
  'section.installments': 'Kartica na rate',

  'col.status': 'Status',
  'col.bill': 'Režija',
  'col.forMonth': 'Za mjesec',
  'col.name': 'Naziv',
  'col.amount': 'Iznos (KM)',
  'col.fixedAmount': 'Fiksni iznos (KM)',
  'col.rate': 'Rata (KM)',
  'col.paidCount': 'Plaćeno rata',
  'col.remaining': 'Preostalo',

  'empty.bills': 'Nema računa.',
  'empty.extras': 'Nema dodatnih troškova.',
  'empty.subs': 'Nema pretplata.',
  'empty.installments': 'Nema rata.',

  'ph.billName': 'Naziv računa',
  'ph.expenseName': 'Naziv troška',
  'ph.subName': 'Naziv pretplate',
  'ph.name': 'Naziv',
  'ph.instName': 'Naziv (npr. TV)',
  'ph.instRate': 'Rata (KM)',
  'ph.instCount': 'Broj rata',
  'ph.instPaid': 'Plaćeno rata (opciono)',

  'total.bills': 'Ukupno računi',
  'total.extras': 'Ukupno dodatni troškovi',
  'total.subs': 'Ukupno pretplate (mjesečno)',
  'total.installments': 'Ukupno preostalo za otplatu',
  'total.installmentsMonthly': 'Mjesečne rate',

  'btn.addBill': '+ Dodaj račun',
  'btn.addExtra': '+ Dodaj trošak',
  'btn.addSub': '+ Dodaj pretplatu',
  'btn.addInst': '+ Dodaj',

  'act.edit': 'Uredi',
  'act.delete': 'Obriši',
  'act.deleteBill': 'Obriši račun',
  'act.saveAmount': 'Sačuvaj iznos',
  'act.done': 'Gotovo',
  'act.move': 'Prevuci za promjenu redoslijeda (ili strelice ↑ ↓)',
  'act.moveSection': 'Prevuci sekciju na drugo mjesto (ili strelice ↑ ↓)',
  'auth.loading': 'Učitavanje…',
  'backup.export': 'Izvezi podatke',
  'backup.import': 'Uvezi podatke',
  'backup.confirm': 'Uvoz zamjenjuje sve trenutne podatke u aplikaciji. Nastaviti?',
  'theme.light': 'Svijetla tema',
  'theme.auto': 'Automatski (prati sistem)',
  'theme.dark': 'Tamna tema',

  'status.paid': 'Plaćeno',
  'status.unpaid': 'Nije plaćeno',

  'cell.unnamed': 'Bez naziva',

  'inst.less': 'Jedna rata manje',
  'inst.more': 'Plaćena još jedna rata',
  'inst.paidOff': 'Otplaćeno',
  'inst.hint':
    'Svaki mjesec preuzima broj plaćenih rata iz prethodnog i dodaje 1 (npr. 4/10 u januaru postaje 5/10 u februaru). Ako treba, ispravi broj sa − i +: izmjena važi od tog mjeseca nadalje.',

  'section.loans': 'Krediti',
  'col.debt': 'Trenutni dug (KM)',
  'empty.loans': 'Nema kredita.',
  'ph.loanName': 'Naziv (npr. Stan, Auto)',
  'ph.loanDebt': 'Trenutni dug (KM)',
  'total.loansDebt': 'Ukupan dug',
  'total.loansMonthly': 'Mjesečne rate',
  'btn.addLoan': '+ Dodaj kredit',
  'loan.confirmDelete': 'Obrisati kredit "{name}"? Brišu se svi mjeseci.',
  'loan.hint':
    'Krediti se prenose iz mjeseca u mjesec: svakog mjeseca se dug smanji za ratu, sve dok ne padne na 0. Kad dug padne na 0, u tom mjesecu piše Otplaćeno, a u narednim mjesecima se kredit više ne prikazuje. Unos odnosno ispravka važi od tog mjeseca nadalje.',

  'dlg.deleteBill': 'Obriši račun',
  'dlg.deleteSub': 'Obriši pretplatu',
  'dlg.thisBill': 'ovaj račun',
  'dlg.thisSub': 'ovu pretplatu',
  'dlg.question': 'Šta želiš obrisati za ',
  'dlg.onlyMonth': 'Samo za {month}',
  'dlg.allMonths': 'Za sve mjesece (prije i poslije)',
  'dlg.cancel': 'Otkaži',
  'dlg.noteBill': 'Brisanje za sve mjesece briše i historiju plaćanja za ovaj račun.',
  'dlg.noteSub': 'Brisanje za sve mjesece uklanja pretplatu zauvijek.'
} as const

export type Key = keyof typeof bs

const en: Record<Key, string> = {
  'section.bills': 'Bills',
  'section.extras': 'Extra expenses',
  'section.extrasHint': '(e.g. Fuel, watch service, Ray-Ban..)',
  'section.subs': 'Subscriptions',
  'section.installments': 'Installment card',

  'col.status': 'Status',
  'col.bill': 'Utility',
  'col.forMonth': 'For month',
  'col.name': 'Name',
  'col.amount': 'Amount (KM)',
  'col.fixedAmount': 'Fixed amount (KM)',
  'col.rate': 'Installment (KM)',
  'col.paidCount': 'Installments paid',
  'col.remaining': 'Remaining',

  'empty.bills': 'No bills.',
  'empty.extras': 'No extra expenses.',
  'empty.subs': 'No subscriptions.',
  'empty.installments': 'No installments.',

  'ph.billName': 'Bill name',
  'ph.expenseName': 'Expense name',
  'ph.subName': 'Subscription name',
  'ph.name': 'Name',
  'ph.instName': 'Name (e.g. TV)',
  'ph.instRate': 'Installment (KM)',
  'ph.instCount': 'Number of installments',
  'ph.instPaid': 'Installments paid (optional)',

  'total.bills': 'Total bills',
  'total.extras': 'Total extra expenses',
  'total.subs': 'Total subscriptions (monthly)',
  'total.installments': 'Total remaining to pay off',
  'total.installmentsMonthly': 'Monthly installments',

  'btn.addBill': '+ Add bill',
  'btn.addExtra': '+ Add expense',
  'btn.addSub': '+ Add subscription',
  'btn.addInst': '+ Add',

  'act.edit': 'Edit',
  'act.delete': 'Delete',
  'act.deleteBill': 'Delete bill',
  'act.saveAmount': 'Save amount',
  'act.done': 'Done',
  'act.move': 'Drag to reorder (or use the ↑ ↓ keys)',
  'act.moveSection': 'Drag the section to another place (or use the ↑ ↓ keys)',
  'auth.loading': 'Loading…',
  'backup.export': 'Export data',
  'backup.import': 'Import data',
  'backup.confirm': 'Importing replaces all current data in the app. Continue?',
  'theme.light': 'Light theme',
  'theme.auto': 'Automatic (follow system)',
  'theme.dark': 'Dark theme',

  'status.paid': 'Paid',
  'status.unpaid': 'Not paid',

  'cell.unnamed': 'Unnamed',

  'inst.less': 'One installment less',
  'inst.more': 'One more installment paid',
  'inst.paidOff': 'Paid off',
  'inst.hint':
    'Each month takes the paid installments count from the previous month and adds 1 (e.g. 4/10 in January becomes 5/10 in February). If needed, correct it with − and +: the change applies from that month onward.',

  'section.loans': 'Loans',
  'col.debt': 'Current debt (KM)',
  'empty.loans': 'No loans.',
  'ph.loanName': 'Name (e.g. Apartment, Car)',
  'ph.loanDebt': 'Current debt (KM)',
  'total.loansDebt': 'Total debt',
  'total.loansMonthly': 'Monthly installments',
  'btn.addLoan': '+ Add loan',
  'loan.confirmDelete': 'Delete loan "{name}"? All months are removed.',
  'loan.hint':
    'Loans carry over from month to month: each month the debt goes down by the installment, until it reaches 0. When the debt reaches 0, that month shows Paid off and the loan no longer appears in later months. An entry or correction applies from that month onward.',

  'dlg.deleteBill': 'Delete bill',
  'dlg.deleteSub': 'Delete subscription',
  'dlg.thisBill': 'this bill',
  'dlg.thisSub': 'this subscription',
  'dlg.question': 'What do you want to delete for ',
  'dlg.onlyMonth': 'Only for {month}',
  'dlg.allMonths': 'For all months (before and after)',
  'dlg.cancel': 'Cancel',
  'dlg.noteBill': 'Deleting for all months also deletes the payment history of this bill.',
  'dlg.noteSub': 'Deleting for all months removes the subscription permanently.'
}

const dictionaries: Record<Lang, Record<Key, string>> = { bs, en }

export type T = (key: Key, params?: Record<string, string | number>) => string

export function makeT(lang: Lang): T {
  return (key, params) => {
    let text = dictionaries[lang][key]
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replace(`{${name}}`, String(value))
    }
    return text
  }
}

export interface I18n {
  lang: Lang
  setLang: (lang: Lang) => void
  t: T
}

export const I18nContext = createContext<I18n>({
  lang: 'bs',
  setLang: () => {},
  t: makeT('bs')
})

export const useI18n = (): I18n => useContext(I18nContext)
