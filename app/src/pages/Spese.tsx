import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EditableText } from '../components/EditableText'
import { TripIdentityLink } from '../components/TripIdentityLink'
import { useAuth } from '../lib/authContext'
import { computeBalances, computeCassaTotal } from '../lib/balances'
import { pianoRimborsi, type Pagamento } from '../lib/settleUp'
import { useToast } from '../lib/toast'
import { useTripTableSync } from '../lib/useTripRealtime'
import { isUuid } from '../lib/uuid'
import {
  loadExpensesData,
  loadStops,
  saveExpensesData,
  people,
  personOrder,
  currentUser,
  type Stop,
} from '../lib/tripData'
import {
  createCassaContribution,
  createExpense,
  createSettlement,
  deleteCassaContribution as deleteCassaContributionRemote,
  deleteExpense as deleteExpenseRemote,
  deleteSettlement as deleteSettlementRemote,
  fetchExpensesData,
  fetchTripMembers,
  updateExpense as updateExpenseRemote,
  type RealMember,
} from './spese/supabaseSpese'
import { PersonPicker, type PickablePerson } from './spese/PersonPicker'

type SheetMode = null | 'expense' | 'settlement' | 'cassa' | 'ledger'

const SPESE_TABLES = ['expenses', 'settlements', 'cassa_contributions']

// I tre movimenti che entrano nei saldi. Cancellarli e' l'unico modo di
// rimediare a una cifra sbagliata: l'importo non accetta zero ne' negativi,
// quindi non si puo' compensare con un movimento opposto.
type MovimentoKind = 'expense' | 'settlement' | 'cassa'

const TESTI_ELIMINA: Record<MovimentoKind, { titolo: string; errore: string }> = {
  expense: { titolo: 'Eliminare questa spesa?', errore: 'Non siamo riusciti a eliminare la spesa.' },
  settlement: { titolo: 'Eliminare questo rimborso?', errore: 'Non siamo riusciti a eliminare il rimborso.' },
  cassa: { titolo: 'Eliminare questo contributo?', errore: 'Non siamo riusciti a eliminare il contributo.' },
}

// Forma unificata: compatibile sia con i dati demo (PersonId, un carattere)
// sia con i membri reali (id uuid da trip_members).
interface UIExpense {
  id: string
  title: string
  icon: string
  amount: number
  paidBy: string | 'cassa'
  splitAmong: string[]
  dateLabel: string
  note: string
}
interface UISettlement {
  id: string
  from: string
  to: string
  amount: number
  dateLabel?: string
}
interface UICassaContribution {
  id: string
  person: string
  amount: number
  dateLabel?: string
}

interface ExpenseForm {
  title: string
  amount: string
  icon: string
  paidBy: string
  splitAmong: string[]
  note: string
}
interface SettleForm {
  from: string
  to: string
  amount: string
}
interface CassaForm {
  person: string
  amount: string
}

function fmtAmount(n: number) {
  return n.toFixed(n % 1 ? 2 : 0)
}

function AmountEditable({ value, onSave, placeholder = '0', numeric }: { value: string; onSave: (text: string) => void; placeholder?: string; numeric?: boolean }) {
  const filled = !!value
  return (
    <EditableText
      key={value}
      initialText={value || placeholder}
      className="rounded-2xl border border-[var(--color-card-border)] bg-white px-3.5 py-2.75 font-display text-base"
      style={{ color: filled ? '#3a2a1c' : 'var(--color-eyebrow)', fontWeight: filled ? 700 : 600, fontStyle: filled ? 'normal' : 'italic' }}
      // Un campo che aspetta una cifra non deve far uscire la tastiera con le
      // lettere: al telefono erano quattro tocchi in piu' per arrivare ai
      // numeri, su un campo dove non si scrive altro (COLLAUDO #43).
      inputMode={numeric ? 'numeric' : undefined}
      // Vuoto: si toglie l'invito, che qui e' testo vero dentro al campo.
      //
      // Pieno, e solo su un importo: si seleziona tutto, cosi' la prima cifra
      // digitata sostituisce quella che c'era. Prima il cursore si piazzava e
      // basta, e per cambiare un importo gia' scritto — quelli che arrivano
      // compilati dal piano dei rimborsi lo sono sempre — bisognava cancellare
      // cifra per cifra dentro un contenteditable, che al telefono e' il lavoro
      // peggiore che ci sia.
      //
      // Sul titolo della spesa no, di proposito: un titolo si corregge e si
      // allunga, e selezionarlo tutto vorrebbe dire cancellarlo ogni volta che
      // lo si tocca per aggiungere una parola. Un importo invece si rifa'
      // sempre da capo — nessuno cambia la seconda cifra di 49.
      onFocus={(e) => {
        const el = e.currentTarget
        if (!filled) {
          el.textContent = ''
          return
        }
        if (!numeric) return
        const range = document.createRange()
        range.selectNodeContents(el)
        const selezione = window.getSelection()
        selezione?.removeAllRanges()
        selezione?.addRange(range)
      }}
      onBlurText={onSave}
    />
  )
}

export function Spese() {
  const { tripId: routeTripId } = useParams()
  const isRealTrip = isUuid(routeTripId)
  const { session } = useAuth()
  const { showError, showSuccess } = useToast()

  const [loading, setLoading] = useState(isRealTrip)
  const [loadError, setLoadError] = useState(false)
  const [realMembers, setRealMembers] = useState<RealMember[]>([])
  const [stops, setStops] = useState<Stop[]>([])
  const [expenses, setExpenses] = useState<UIExpense[]>([])
  const [settlements, setSettlements] = useState<UISettlement[]>([])
  const [cassaContributions, setCassaContributions] = useState<UICassaContribution[]>([])
  const [sheetMode, setSheetMode] = useState<SheetMode>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [balancesExpanded, setBalancesExpanded] = useState(false)
  // Chiuso quando si entra, sempre: chiudere i conti e' una cosa che si fa
  // ogni tanto, segnare una spesa e' una cosa che si fa dieci volte al giorno.
  const [pianoAperto, setPianoAperto] = useState(false)
  const [daEliminare, setDaEliminare] = useState<{ kind: MovimentoKind; id: string } | null>(null)
  const [eliminando, setEliminando] = useState(false)
  // I rimborsi ancora da registrare quando si parte dall'elenco "Per chiudere
  // i conti". Serve solo a non far richiudere il pannello dopo ogni conferma:
  // due rimborsi di fila erano due giri completi, apertura compresa.
  const [coda, setCoda] = useState<Pagamento[]>([])

  // Elenco persone unificato: il cast demo, o i membri veri del viaggio.
  // Comprende chi ha lasciato il viaggio: le sue spese, i suoi saldi e il suo
  // nome devono restare leggibili, altrimenti gli importi diventano di nessuno.
  const members: PickablePerson[] = isRealTrip
    ? realMembers.map((m) => ({ id: m.id, name: m.name, color: m.color, initial: m.name.slice(0, 1).toUpperCase() }))
    : personOrder.map((code) => ({ id: code, name: people[code].name, color: people[code].color, initial: code }))
  const membersById: Record<string, { name: string; color: string }> = Object.fromEntries(members.map((m) => [m.id, m]))
  const memberIds = members.map((m) => m.id)

  // Chi c'e' ancora: per le scelte che guardano avanti (chi paga una spesa
  // nuova, fra chi dividerla, chi versa in cassa). I rimborsi restano invece
  // aperti a tutti: un debito con chi se n'e' andato va comunque saldato.
  const usciti = new Set(realMembers.filter((m) => m.leftAt).map((m) => m.id))
  const membersAttivi = members.filter((m) => !usciti.has(m.id))

  const currentMemberId = isRealTrip
    ? realMembers.find((m) => m.userId === session?.user?.id)?.id ?? membersAttivi[0]?.id ?? ''
    : currentUser

  const [form, setForm] = useState<ExpenseForm>({ title: '', amount: '', icon: '💳', paidBy: '', splitAmong: [], note: '' })
  const [settleForm, setSettleForm] = useState<SettleForm>({ from: '', to: '', amount: '' })
  const [cassaForm, setCassaForm] = useState<CassaForm>({ person: '', amount: '' })

  useEffect(() => {
    if (isRealTrip && routeTripId) {
      setLoading(true)
      setLoadError(false)
      Promise.all([fetchTripMembers(routeTripId), fetchExpensesData(routeTripId)])
        .then(([fetchedMembers, data]) => {
          setRealMembers(fetchedMembers)
          setExpenses(data.expenses.map((e) => ({ id: e.id, title: e.title, icon: e.icon, amount: e.amount, paidBy: e.paidByMemberId ?? 'cassa', splitAmong: e.splitAmong, dateLabel: e.dateLabel, note: e.note })))
          setSettlements(data.settlements.map((s) => ({ id: s.id, from: s.fromMemberId, to: s.toMemberId, amount: s.amount, dateLabel: s.dateLabel })))
          setCassaContributions(data.cassaContributions.map((c) => ({ id: c.id, person: c.memberId, amount: c.amount, dateLabel: c.dateLabel })))
        })
        // Senza questo, un errore in caricamento lasciava la schermata bloccata
        // su "Caricamento..." per sempre, senza spiegazione.
        .catch((err) => {
          setLoadError(true)
          showError('Non siamo riusciti a caricare le spese.', err)
        })
        .finally(() => setLoading(false))
      return
    }
    setStops(loadStops())
    const data = loadExpensesData()
    setExpenses(data.expenses)
    setSettlements(data.settlements)
    setCassaContributions(data.cassaContributions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeTripId])

  async function refetchReal() {
    if (!routeTripId) return
    try {
      const data = await fetchExpensesData(routeTripId)
      setExpenses(data.expenses.map((e) => ({ id: e.id, title: e.title, icon: e.icon, amount: e.amount, paidBy: e.paidByMemberId ?? 'cassa', splitAmong: e.splitAmong, dateLabel: e.dateLabel, note: e.note })))
      setSettlements(data.settlements.map((s) => ({ id: s.id, from: s.fromMemberId, to: s.toMemberId, amount: s.amount, dateLabel: s.dateLabel })))
      setCassaContributions(data.cassaContributions.map((c) => ({ id: c.id, person: c.memberId, amount: c.amount, dateLabel: c.dateLabel })))
    } catch (err) {
      showError('Non siamo riusciti ad aggiornare le spese.', err)
    }
  }

  // Aggiornamenti live: se un altro membro aggiunge/modifica una spesa o un
  // saldo mentre siamo su questa schermata, li vediamo comparire da soli.
  useTripTableSync(isRealTrip ? routeTripId ?? null : null, SPESE_TABLES, refetchReal)

  function persistDemo(patch: { expenses?: UIExpense[]; settlements?: UISettlement[]; cassaContributions?: UICassaContribution[] }) {
    const nextExpenses = patch.expenses ?? expenses
    const nextSettlements = patch.settlements ?? settlements
    const nextCassa = patch.cassaContributions ?? cassaContributions
    if (patch.expenses) setExpenses(patch.expenses)
    if (patch.settlements) setSettlements(patch.settlements)
    if (patch.cassaContributions) setCassaContributions(patch.cassaContributions)
    saveExpensesData({
      expenses: nextExpenses as never,
      settlements: nextSettlements as never,
      cassaContributions: nextCassa as never,
    })
  }

  function todayStopName() {
    return stops.find((s) => s.kind === 'today')?.name || 'Oggi'
  }

  function closeSheet() {
    setSheetMode(null)
    setEditingId(null)
    setCoda([])
  }

  function openAddExpense() {
    setSheetMode('expense')
    setEditingId(null)
    setForm({ title: '', amount: '', icon: '💳', paidBy: currentMemberId, splitAmong: [...memberIds], note: '' })
  }
  function openEditExpense(exp: UIExpense) {
    setSheetMode('expense')
    setEditingId(exp.id)
    setForm({ title: exp.title, amount: String(exp.amount), icon: exp.icon, paidBy: exp.paidBy, splitAmong: [...exp.splitAmong], note: exp.note || '' })
  }

  function toggleSplit(id: string) {
    setForm((f) => {
      const has = f.splitAmong.includes(id)
      const next = has ? f.splitAmong.filter((c) => c !== id) : [...f.splitAmong, id]
      return { ...f, splitAmong: next.length ? next : f.splitAmong }
    })
  }

  async function saveExpenseForm() {
    const amount = parseFloat(String(form.amount).replace(',', '.')) || 0
    if (!form.title || amount <= 0) return
    const split = form.splitAmong.length ? form.splitAmong : memberIds

    if (isRealTrip && routeTripId) {
      const input = { title: form.title, icon: form.icon, amount, paidByMemberId: form.paidBy === 'cassa' ? null : form.paidBy || null, splitAmong: split, note: form.note }
      try {
        if (editingId) await updateExpenseRemote(editingId, input)
        else await createExpense(routeTripId, input)
      } catch (err) {
        // Il pannello resta aperto: cosi' quanto scritto non va perso e si puo'
        // riprovare senza reinserire tutto.
        showError('Non siamo riusciti a salvare la spesa. Controlla la connessione e riprova.', err)
        return
      }
      await refetchReal()
    } else if (editingId) {
      persistDemo({ expenses: expenses.map((e) => (e.id !== editingId ? e : { ...e, title: form.title, amount, icon: form.icon, paidBy: form.paidBy, splitAmong: split, note: form.note })) })
    } else {
      const newExp: UIExpense = { id: 'e' + Date.now(), title: form.title, amount, icon: form.icon, paidBy: form.paidBy, splitAmong: split, note: form.note, dateLabel: `Oggi · ${todayStopName()}` }
      persistDemo({ expenses: [newExp, ...expenses] })
    }
    closeSheet()
  }

  // Un solo percorso per tutti e tre i movimenti, e tutti e tre passano dalla
  // conferma: sono soldi, la cancellazione non si annulla, e un movimento
  // rifatto tornerebbe comunque con la data di oggi. Prima la spesa partiva al
  // primo tocco: ora no, altrimenti nella stessa schermata due movimenti
  // identici si comporterebbero in due modi diversi.
  async function eliminaMovimento() {
    if (!daEliminare) return
    const { kind, id } = daEliminare

    if (isRealTrip) {
      setEliminando(true)
      try {
        if (kind === 'expense') await deleteExpenseRemote(id)
        else if (kind === 'settlement') await deleteSettlementRemote(id)
        else await deleteCassaContributionRemote(id)
      } catch (err) {
        showError(TESTI_ELIMINA[kind].errore, err)
        setEliminando(false)
        return
      }
      // I saldi e il totale della cassa si ricalcolano da qui: sono derivati
      // dagli elenchi, quindi tornano da soli senza ricaricare la pagina.
      await refetchReal()
      setEliminando(false)
    } else if (kind === 'expense') {
      persistDemo({ expenses: expenses.filter((e) => e.id !== id) })
    } else if (kind === 'settlement') {
      persistDemo({ settlements: settlements.filter((s) => s.id !== id) })
    } else {
      persistDemo({ cassaContributions: cassaContributions.filter((c) => c.id !== id) })
    }

    setDaEliminare(null)
    // La spesa si cancella anche dal pannello di modifica, che va chiuso: il
    // rimborso e il contributo si cancellano dal registro, che resta aperto.
    if (kind === 'expense' && editingId === id) closeSheet()
  }

  // Pannello vuoto, come prima: resta la strada per un rimborso che il piano
  // non prevede — una cifra a meta', o un conto con chi ha lasciato il viaggio.
  function openSettlement() {
    setSheetMode('settlement')
    setCoda([])
    const other = memberIds.find((id) => id !== currentMemberId) ?? memberIds[0] ?? ''
    setSettleForm({ from: other, to: currentMemberId, amount: '' })
  }

  // Pannello gia' compilato, partendo da una riga di "Per chiudere i conti".
  // Il resto della coda viene con lui: sono i pagamenti che restano dopo
  // questo, nell'ordine in cui li propone il piano.
  function openSettlementDaPiano(indice: number) {
    const scelto = piano.pagamenti[indice]
    if (!scelto) return
    setSheetMode('settlement')
    setEditingId(null)
    // La coda comprende anche quello che stiamo per registrare: serve a
    // riconoscere, al momento della conferma, se e' ancora quello proposto.
    setCoda(piano.pagamenti.slice(indice))
    setSettleForm({ from: scelto.from, to: scelto.to, amount: String(scelto.amount) })
  }

  async function saveSettlement() {
    const amount = parseFloat(String(settleForm.amount).replace(',', '.')) || 0
    if (!settleForm.from || !settleForm.to || settleForm.from === settleForm.to || amount <= 0) return
    if (isRealTrip && routeTripId) {
      try {
        await createSettlement(routeTripId, { fromMemberId: settleForm.from, toMemberId: settleForm.to, amount })
      } catch (err) {
        showError('Non siamo riusciti a registrare il rimborso.', err)
        return
      }
      await refetchReal()
    } else {
      const rec: UISettlement = { id: 's' + Date.now(), from: settleForm.from, to: settleForm.to, amount, dateLabel: `Oggi · ${todayStopName()}` }
      persistDemo({ settlements: [rec, ...settlements] })
    }

    // Se ne restano altri, il pannello non si chiude: si ricarica col prossimo.
    // Ogni rimborso tiene la sua conferma — nessun tocco ne registra due —
    // quello che sparisce e' solo il richiudi-e-riapri fra uno e l'altro.
    //
    // Ma solo se quello appena confermato e' ancora quello proposto: se
    // l'importo o le persone sono stati cambiati a mano, il piano calcolato
    // prima non vale piu' e tirarsi dietro il resto proporrebbe cifre
    // sbagliate. In quel caso si chiude e l'elenco si rifa' sui saldi nuovi.
    const corrente = coda[0]
    const seguitoIlPiano = corrente && corrente.from === settleForm.from && corrente.to === settleForm.to && corrente.amount === amount
    const prossimo = seguitoIlPiano ? coda[1] : undefined
    if (prossimo) {
      const resto = coda.slice(1)
      setCoda(resto)
      setSettleForm({ from: prossimo.from, to: prossimo.to, amount: String(prossimo.amount) })
      showSuccess(`Rimborso registrato. Ne resta${resto.length === 1 ? '' : 'no'} ${resto.length}.`)
      return
    }
    closeSheet()
  }

  function openCassa() {
    setSheetMode('cassa')
    setCassaForm({ person: currentMemberId, amount: '' })
  }
  async function saveCassaContribution() {
    const amount = parseFloat(String(cassaForm.amount).replace(',', '.')) || 0
    if (amount <= 0 || !cassaForm.person) return
    if (isRealTrip && routeTripId) {
      try {
        await createCassaContribution(routeTripId, { memberId: cassaForm.person, amount })
      } catch (err) {
        showError('Non siamo riusciti a registrare il contributo in cassa.', err)
        return
      }
      await refetchReal()
    } else {
      const rec: UICassaContribution = { id: 'c' + Date.now(), person: cassaForm.person, amount, dateLabel: `Oggi · ${todayStopName()}` }
      persistDemo({ cassaContributions: [rec, ...cassaContributions] })
    }
    closeSheet()
  }

  function exportCsv() {
    const rows: (string | number)[][] = [['Data', 'Descrizione', 'Tipo', 'Da', 'Verso', 'Importo (€)']]
    ledgerRows.forEach((r) => rows.push([r.date, r.desc, r.typeLabel, r.who, r.toWhom, r.rawAmount]))
    rows.push([])
    rows.push(['Totale per persona'])
    balanceChips.forEach((b) => rows.push([b.name, b.amountLabel]))
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pina-spese.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // ---- derived ----
  const totalSpent = expenses.reduce((a, e) => a + e.amount, 0)
  // Il numero che il gruppo chiede per primo, e che finora si faceva a mente.
  // Solo una divisione: non entra nei saldi e non decide niente.
  //
  // Si divide per TUTTA la crew, compreso chi ha lasciato il viaggio, e non per
  // `membersAttivi`: il totale qui sopra comprende anche le spese di chi se
  // n'e' andato, quindi togliere lui dal divisore ma non le sue spese dal
  // totale gonfierebbe la media di una cifra che non corrisponde a niente.
  // Numeratore e denominatore devono parlare delle stesse persone.
  const mediaATesta = memberIds.length ? totalSpent / memberIds.length : null
  const balances = computeBalances(expenses, settlements, cassaContributions, memberIds)
  const cassaTotal = computeCassaTotal(expenses, cassaContributions)
  // I saldi dicono quanto ha ciascuno; il piano dice chi paga chi. Legge e
  // basta: `computeBalances` resta l'unica fonte.
  const piano = pianoRimborsi(balances, memberIds)

  // Quanto c'e' davvero in cassa per la spesa che stiamo compilando: se stiamo
  // modificando una spesa gia' pagata dalla cassa, il suo importo e' gia'
  // scalato da cassaTotal e va riaccreditato, altrimenti sembrerebbe che i
  // soldi non ci siano piu'.
  const paidByCassa = form.paidBy === 'cassa'
  const editedCassaExpense = editingId ? expenses.find((e) => e.id === editingId && e.paidBy === 'cassa') : undefined
  const cassaAvailable = cassaTotal + (editedCassaExpense?.amount ?? 0)
  const formAmount = parseFloat(String(form.amount).replace(',', '.')) || 0
  const cassaShortfall = paidByCassa ? Math.max(0, formAmount - cassaAvailable) : 0

  const balanceChips = memberIds.map((id) => {
    const p = membersById[id]
    const rounded = Math.round((balances[id] || 0) * 100) / 100
    let statusLabel = 'in pari', amountLabel = '0€', amountColor = '#fff1d6'
    if (rounded > 0.01) { statusLabel = 'riceve'; amountLabel = `+${fmtAmount(rounded)}€`; amountColor = '#d7ffe0' }
    else if (rounded < -0.01) { statusLabel = 'deve'; amountLabel = `-${fmtAmount(Math.abs(rounded))}€`; amountColor = '#fff1d6' }
    return { code: id, name: p?.name || '?', amountLabel, amountColor, statusLabel }
  })
  const visibleBalanceChips = balancesExpanded ? balanceChips : balanceChips.slice(0, 6)

  const groupedRecentExpenses: { label: string; items: UIExpense[] }[] = []
  expenses.slice(0, 5).forEach((exp) => {
    const g = groupedRecentExpenses[groupedRecentExpenses.length - 1]
    if (!g || g.label !== exp.dateLabel) groupedRecentExpenses.push({ label: exp.dateLabel, items: [exp] })
    else g.items.push(exp)
  })

  const badgeCls = (bg: string, color: string) => ({ background: bg, color })
  const expenseRows = expenses.map((e) => {
    const among = e.splitAmong.length ? e.splitAmong : memberIds
    const payer = e.paidBy !== 'cassa' ? membersById[e.paidBy] : null
    return {
      id: e.id, kind: 'expense' as MovimentoKind,
      date: e.dateLabel, desc: e.title, typeLabel: 'Uscita', badgeStyle: badgeCls('#fdeceb', '#c2445a'),
      who: payer ? payer.name : 'Cassa comune', toWhom: among.map((c) => membersById[c]?.name || c).join(', '),
      whoLine: `${payer ? payer.name : 'Cassa'} → ${among.map((c) => membersById[c]?.name || c).join(', ')}`,
      amountLabel: `-${e.amount}€`, amountColor: '#c2445a', rawAmount: -e.amount,
    }
  })
  const settlementRows = settlements.map((s) => {
    const fromP = membersById[s.from], toP = membersById[s.to]
    return {
      id: s.id, kind: 'settlement' as MovimentoKind,
      date: s.dateLabel || 'Oggi', desc: 'Rimborso', typeLabel: 'Rimborso', badgeStyle: badgeCls('#e9f7f0', '#3f8f5f'),
      who: fromP?.name || '?', toWhom: toP?.name || '?', whoLine: `${fromP?.name || '?'} → ${toP?.name || '?'}`,
      amountLabel: `${s.amount}€`, amountColor: '#3f8f5f', rawAmount: s.amount,
    }
  })
  const cassaRows = cassaContributions.map((c) => {
    const p = membersById[c.person]
    return {
      id: c.id, kind: 'cassa' as MovimentoKind,
      date: c.dateLabel || 'Oggi', desc: 'Contributo cassa comune', typeLabel: 'Cassa', badgeStyle: badgeCls('#fdf3d9', '#b8792e'),
      who: p?.name || '?', toWhom: 'Cassa comune', whoLine: `${p?.name || '?'} → Cassa comune`,
      amountLabel: `${c.amount}€`, amountColor: '#b8792e', rawAmount: c.amount,
    }
  })
  const ledgerRows = [...expenseRows, ...settlementRows, ...cassaRows]

  const sheetTitle = editingId ? 'Modifica spesa' : 'Nuova spesa'
  const sheetSaveLabel = editingId ? 'Salva modifiche' : 'Aggiungi spesa'

  if (loading) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md items-center justify-center bg-[var(--color-cream)] text-sm font-semibold text-[var(--color-text-secondary)]">
        Caricamento...
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 bg-[var(--color-cream)] px-8 text-center">
        <div className="text-3xl">📡</div>
        <div className="font-display text-lg font-semibold text-[var(--color-text)]">Spese non caricate</div>
        <div className="text-[12.5px] font-semibold leading-snug text-[var(--color-text-secondary)]">
          Non siamo riusciti a leggere i dati del viaggio. Controlla la connessione e riprova.
        </div>
        <button
          type="button"
          className="mt-1 rounded-full px-5 py-2.75 text-[13px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' }}
          onClick={() => window.location.reload()}
        >
          Riprova
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-svh max-w-md bg-[var(--color-cream)] px-4.5 pb-24 pt-8 text-[var(--color-text)]">
      <div className="mb-4.5 flex items-center justify-between">
        <Link to="/" className="font-display text-[19px] font-semibold italic text-[var(--color-coral)]">🦩 Piña</Link>
        <TripIdentityLink />
      </div>

      <div className="mb-4.5 font-display text-2xl font-semibold">Spese</div>

      <div className="mb-3.5 rounded-[26px] p-5 text-white shadow-[0_18px_36px_-18px_rgba(255,150,60,.5)]" style={{ background: 'linear-gradient(135deg,#ffb627,#ff8a5b)' }}>
        <div className="mb-1 text-xs font-bold text-white/85">Totale speso finora</div>
        {/*
          La media sta di fianco al totale, non sotto: e' la stessa cifra letta
          in un altro modo, non un dato in piu'. `flex-wrap` perche' su un
          totale lungo, a 375px, deve andare a capo invece di stringere il
          numero grande.
        */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <div className="font-display text-[38px] font-bold leading-none">{fmtAmount(totalSpent)}€</div>
          {mediaATesta !== null && expenses.length > 0 && (
            <div className="text-[12.5px] font-semibold text-white/85">{fmtAmount(mediaATesta)}€ a testa</div>
          )}
        </div>
        <div className="mb-4 mt-1.5 text-[12.5px] font-semibold text-white/85">{expenses.length} spes{expenses.length === 1 ? 'a' : 'e'}</div>

        <div className="grid grid-cols-3 gap-2">
          {visibleBalanceChips.map((b) => (
            <div key={b.code} className="flex min-w-0 flex-col gap-0.5 rounded-2xl border border-white/30 bg-white/20 px-2.5 py-2">
              <div className="truncate text-[11px] font-bold">{b.name}</div>
              <div className="font-display text-[15px] font-semibold" style={{ color: b.amountColor }}>{b.amountLabel}</div>
              <div className="text-[9.5px] font-semibold text-white/75">{b.statusLabel}</div>
            </div>
          ))}
        </div>
        {balanceChips.length > 6 && (
          <button type="button" className="mt-2.5 w-full text-center text-[11.5px] font-bold text-white underline" onClick={() => setBalancesExpanded((v) => !v)}>
            {balancesExpanded ? 'Mostra meno' : `Mostra tutti (${balanceChips.length})`}
          </button>
        )}
      </div>

      <div className="mb-5.5 flex gap-2.5">
        <button type="button" className="flex-1 rounded-2xl border border-[var(--color-card-border)] bg-white py-2.75 text-center text-[12.5px] font-bold text-[var(--color-text)]" onClick={openAddExpense}>＋ Aggiungi spesa</button>
        <button type="button" className="flex-1 rounded-2xl border border-[var(--color-card-border)] bg-white py-2.75 text-center text-[12.5px] font-bold text-[var(--color-text)]" onClick={openSettlement}>💸 Registra rimborso</button>
      </div>

      <div className="mb-5.5 rounded-[20px] border border-[var(--color-card-border)] bg-white p-4 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9f7f0] text-lg">🏦</div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold tracking-[.04em] text-[var(--color-eyebrow)]">Cassa comune</div>
            <div className="font-display text-lg font-semibold">{fmtAmount(cassaTotal)}€</div>
          </div>
          <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fdeee0] text-lg font-bold text-[var(--color-coral-text)]" onClick={openCassa}>＋</button>
        </div>
        <div className="mt-2 text-[11.5px] font-semibold text-[var(--color-text-secondary)]">{cassaContributions.length} contribut{cassaContributions.length === 1 ? 'o' : 'i'} disponibili</div>
      </div>

      {/*
        L'ultimo passo che i saldi non facevano: i saldi dicono "Marco -25€",
        qui c'e' scritto "Marco → Andrea 15€" e "Marco → Luca 10€". Con due
        persone e' la stessa cosa detta due volte; da tre in su e' il conto che
        finiva in testa a chi sta in piedi davanti a un bar (COLLAUDO #43).

        Chiuso di default, e sotto la cassa comune invece che attaccato ai
        saldi: aperto stava in prima pagina, ed e' la prima cosa che si leggeva
        entrando in Spese. Ma chiudere i conti si fa una volta ogni tanto —
        alla fine, o quando qualcuno se ne va — mentre entrare in Spese si fa
        dieci volte al giorno per segnare una birra. Chi lo cerca sa dov'e';
        chi non lo cerca non se lo trova addosso.
      */}
      {(expenses.length > 0 || cassaContributions.length > 0 || settlements.length > 0) && (
        <div className="mb-5.5 rounded-[20px] border border-[var(--color-card-border)] bg-white shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 p-4 text-left"
            aria-expanded={pianoAperto}
            onClick={() => setPianoAperto((v) => !v)}
          >
            <span className="text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Per chiudere i conti</span>
            <span className="shrink-0 text-[11px] font-bold text-[var(--color-coral-text)]">{pianoAperto ? '⌃' : '⌄'}</span>
          </button>

          {pianoAperto && (
            <div className="px-4 pb-4">
              {piano.pagamenti.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {piano.pagamenti.map((p, i) => (
                    <button
                      key={`${p.from}-${p.to}-${i}`}
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-bg)] p-2.5 text-left"
                      onClick={() => openSettlementDaPiano(i)}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: membersById[p.from]?.color || '#c2a97e' }}>
                        {membersById[p.from]?.name.slice(0, 1).toUpperCase() || '?'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold">
                          {membersById[p.from]?.name || '?'} <span className="text-[var(--color-text-secondary)]">→</span> {membersById[p.to]?.name || '?'}
                        </span>
                        <span className="block text-[11px] font-semibold text-[var(--color-text-secondary)]">Tocca per registrarlo</span>
                      </span>
                      <span className="shrink-0 font-display text-[15px] font-semibold" style={{ color: '#3f8f5f' }}>{fmtAmount(p.amount)}€</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-2xl bg-[#e9f7f0] p-3">
                  <span className="text-lg">✅</span>
                  {/*
                    "Siete in pari" solo a cassa vuota. Con dei soldi ancora nel
                    fondo i riquadri sopra dicono "riceve" a mezza crew, ed e'
                    vero: sono crediti verso la cassa, non fra persone. Dirlo lo
                    stesso farebbe leggere due frasi che si smentiscono a un
                    centimetro di distanza — qui si dice solo quello che riguarda
                    le persone, e la riga sotto spiega il resto.
                  */}
                  <span className="text-[12.5px] font-bold text-[#3f8f5f]">
                    {Math.abs(piano.residuoCassa) >= 0.01 ? 'Nessuno deve niente a nessuno.' : 'Siete in pari. Nessuno deve niente a nessuno.'}
                  </span>
                </div>
              )}

              {/*
                Quello che avanza non lo deve nessuno: sono soldi fermi nella
                cassa comune, che restano di chi ce li ha messi. Senza questa
                riga i conti sembrerebbero non tornare.
              */}
              {Math.abs(piano.residuoCassa) >= 0.01 && (
                <div className="mt-2.5 text-[11.5px] font-semibold leading-snug text-[var(--color-text-secondary)]">
                  {piano.residuoCassa > 0
                    ? `A parte questo, ${fmtAmount(piano.residuoCassa)}€ sono ancora nella cassa comune: restano di chi li ha versati finché non li spendete.`
                    : `Attenzione: la cassa comune ha speso ${fmtAmount(Math.abs(piano.residuoCassa))}€ più di quanto ha incassato.`}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mx-0.5 mb-3.5 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Spese recenti</span>
        <button type="button" className="text-xs font-bold text-[var(--color-coral-text)]" onClick={() => setSheetMode('ledger')}>Tutte →</button>
      </div>

      {expenses.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {groupedRecentExpenses.map((grp, gi) => (
            <div key={gi}>
              <div className="mx-0.5 mb-2 text-[11px] font-bold text-[var(--color-eyebrow)]">{grp.label}</div>
              <div className="flex flex-col gap-2.5">
                {grp.items.map((exp) => {
                  const among = exp.splitAmong.length ? exp.splitAmong : memberIds
                  const share = exp.amount / among.length
                  const payer = exp.paidBy !== 'cassa' ? membersById[exp.paidBy] : null
                  return (
                    <button key={exp.id} type="button" className="rounded-[20px] border border-[var(--color-card-border)] bg-white p-3.5 text-left shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]" onClick={() => openEditExpense(exp)}>
                      <div className="flex items-center gap-2.75">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fdeee0] text-lg">{exp.icon}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold">{exp.title}</div>
                          <div className="mt-0.25 text-[11.5px] font-semibold text-[var(--color-text-secondary)]">{payer ? `${payer.name} ha pagato` : 'Cassa comune'}</div>
                        </div>
                        <div className="shrink-0 font-display text-[17px] font-semibold">{exp.amount}€</div>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between border-t border-dashed border-[var(--color-card-border)] pt-2.5">
                        <div className="flex">
                          {among.map((id, i) => (
                            <span key={id} className="flex h-5.5 w-5.5 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white" style={{ background: membersById[id]?.color || '#c2a97e', marginLeft: i === 0 ? 0 : -7 }}>{membersById[id]?.name.slice(0, 1).toUpperCase() || '?'}</span>
                          ))}
                        </div>
                        <div className="text-[11.5px] font-semibold text-[#8a7256]">
                          {among.length > 1 ? `diviso in ${among.length} → ${fmtAmount(share)}€ a testa` : 'nessuna divisione'}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[22px] border-[1.5px] border-dashed border-[var(--color-empty-border)] px-5 py-8 text-center">
          <div className="mx-auto mb-3 h-16 w-16 rounded-full" style={{ background: 'repeating-linear-gradient(45deg,#ffe6cf,#ffe6cf 6px,#fff1e0 6px,#fff1e0 12px)' }} />
          <div className="mb-1 font-display text-base font-semibold">Nessuna spesa ancora</div>
          <div className="text-xs font-semibold text-[var(--color-text-secondary)]">Tocca ＋ per aggiungere la prima</div>
        </div>
      )}

      <button
        type="button"
        className="fixed right-5 z-20 flex h-13 w-13 items-center justify-center rounded-full text-2xl text-white shadow-[0_12px_24px_-8px_rgba(255,90,60,.55)]"
        style={{ background: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)', bottom: 'calc(6rem + var(--safe-bottom))' }}
        onClick={openAddExpense}
      >
        ＋
      </button>

      {sheetMode === 'expense' && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={closeSheet}>
          <div className="max-h-[88%] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[var(--color-bg)] p-5.5 shadow-[0_-20px_50px_-20px_rgba(0,0,0,.4)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="font-display text-lg font-bold">{sheetTitle}</div>
              <button type="button" className="text-xl text-[var(--color-text-secondary)]" onClick={closeSheet}>×</button>
            </div>

            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">La tua spesa</div>
            <AmountEditable value={form.title} placeholder="Es. Cena in centro" onSave={(text) => setForm((f) => ({ ...f, title: text }))} />

            <div className="mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Importo (€)</div>
            <AmountEditable value={form.amount} numeric onSave={(text) => setForm((f) => ({ ...f, amount: text }))} />

            <div className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Chi ha pagato</div>
            <PersonPicker members={membersAttivi} isSelected={(c) => form.paidBy === c} onClick={(c) => setForm((f) => ({ ...f, paidBy: c }))} />
            <button
              type="button"
              className="mt-2.5 flex w-full items-center gap-2.5 rounded-2xl border px-3.5 py-2.75 text-left"
              style={
                paidByCassa
                  ? { background: '#e9f7f0', borderColor: '#3f8f5f', boxShadow: '0 0 0 1.5px #3f8f5f' }
                  : { background: '#fff', borderColor: 'var(--color-card-border)' }
              }
              onClick={() => setForm((f) => ({ ...f, paidBy: 'cassa' }))}
            >
              <span className="text-lg">🏦</span>
              <span className="flex-1 text-[12.5px] font-bold">Paga con la cassa comune</span>
              <span className="shrink-0 text-[11.5px] font-semibold text-[var(--color-text-secondary)]">{fmtAmount(cassaAvailable)}€ in cassa</span>
            </button>
            {paidByCassa && cassaShortfall > 0 && (
              <div className="mt-2 rounded-xl bg-[#fdf3d9] px-3 py-2.25 text-[11.5px] font-semibold leading-snug text-[#b8792e]">
                ⚠️ In cassa ci sono {fmtAmount(cassaAvailable)}€, ne servono {fmtAmount(cassaShortfall)}€ in più. Puoi registrarla comunque, ma qualcuno dovrà aggiungere un contributo.
              </div>
            )}

            <div className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Diviso tra</div>
            <PersonPicker members={membersAttivi} isSelected={(c) => form.splitAmong.includes(c)} onClick={toggleSplit} />
            <div className="mt-2 text-[11.5px] font-semibold text-[var(--color-text-secondary)]">Diviso tra {form.splitAmong.length} persone</div>

            <div className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Note (opzionale)</div>
            <EditableText
              key={form.note}
              initialText={form.note || 'Aggiungi una nota...'}
              className="rounded-2xl border border-[var(--color-card-border)] bg-white px-3.5 py-2.75 text-[13px] font-semibold"
              style={{ color: form.note ? '#3a2a1c' : 'var(--color-eyebrow)', fontStyle: form.note ? 'normal' : 'italic' }}
              onFocus={(e) => { if (!form.note) e.currentTarget.textContent = '' }}
              onBlurText={(text) => setForm((f) => ({ ...f, note: text }))}
            />

            <div className="mt-5.5 flex gap-2.5">
              {editingId && (
                <button type="button" className="shrink-0 rounded-full bg-[#fdeceb] px-4.5 py-3.25 text-center text-[12.5px] font-bold text-[#c2445a]" onClick={() => setDaEliminare({ kind: 'expense', id: editingId })}>🗑 Elimina</button>
              )}
              <button type="button" className="flex-1 rounded-full py-3.25 text-center text-[13.5px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' }} onClick={saveExpenseForm}>{sheetSaveLabel}</button>
            </div>
          </div>
        </div>
      )}

      {sheetMode === 'settlement' && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={closeSheet}>
          <div className="w-full max-w-md rounded-t-3xl bg-[var(--color-bg)] p-5.5 shadow-[0_-20px_50px_-20px_rgba(0,0,0,.4)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-display text-lg font-bold">Registra un rimborso</div>
                {coda.length > 1 && (
                  <div className="mt-0.5 text-[11.5px] font-semibold text-[var(--color-text-secondary)]">
                    Dal piano: dopo questo ne restano {coda.length - 1}
                  </div>
                )}
              </div>
              <button type="button" className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center text-xl text-[var(--color-text-secondary)]" aria-label="Chiudi" onClick={closeSheet}>×</button>
            </div>
            {/*
              Qui, e solo qui, compare anche chi ha lasciato il viaggio: un
              conto in sospeso va chiuso comunque, e senza il suo nome nella
              lista quei soldi non avrebbero piu' modo di essere saldati.
            */}
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Chi rimborsa</div>
            <div className="mb-3.5"><PersonPicker members={members} isSelected={(c) => settleForm.from === c} onClick={(c) => setSettleForm((f) => ({ ...f, from: c }))} /></div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">A chi</div>
            <div className="mb-3.5"><PersonPicker members={members} isSelected={(c) => settleForm.to === c} onClick={(c) => setSettleForm((f) => ({ ...f, to: c }))} /></div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Importo (€)</div>
            <AmountEditable value={settleForm.amount} numeric onSave={(text) => setSettleForm((f) => ({ ...f, amount: text }))} />
            <button type="button" className="mt-5.5 w-full rounded-full py-3.25 text-center text-[13.5px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' }} onClick={saveSettlement}>
              {coda.length > 1 ? 'Conferma e passa al prossimo' : 'Conferma rimborso'}
            </button>
          </div>
        </div>
      )}

      {sheetMode === 'cassa' && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={closeSheet}>
          <div className="w-full max-w-md rounded-t-3xl bg-[var(--color-bg)] p-5.5 shadow-[0_-20px_50px_-20px_rgba(0,0,0,.4)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="font-display text-lg font-bold">Aggiungi alla cassa comune</div>
              <button type="button" className="text-xl text-[var(--color-text-secondary)]" onClick={closeSheet}>×</button>
            </div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Chi contribuisce</div>
            <div className="mb-3.5"><PersonPicker members={membersAttivi} isSelected={(c) => cassaForm.person === c} onClick={(c) => setCassaForm((f) => ({ ...f, person: c }))} /></div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Importo (€)</div>
            <AmountEditable value={cassaForm.amount} numeric onSave={(text) => setCassaForm((f) => ({ ...f, amount: text }))} />
            <button type="button" className="mt-5.5 w-full rounded-full py-3.25 text-center text-[13.5px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' }} onClick={saveCassaContribution}>Aggiungi</button>
          </div>
        </div>
      )}

      {sheetMode === 'ledger' && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={closeSheet}>
          <div className="flex h-[82%] w-full max-w-md flex-col rounded-t-3xl bg-[var(--color-bg)] shadow-[0_-20px_50px_-20px_rgba(0,0,0,.4)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5.5 pb-3.5 pt-5.5">
              <div className="font-display text-lg font-bold">Tutte le spese</div>
              <button type="button" className="text-xl text-[var(--color-text-secondary)]" onClick={closeSheet}>×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5.5">
              {ledgerRows.map((row) => (
                <div key={row.id} className="mb-2 rounded-2xl border border-[var(--color-card-border)] bg-white p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="rounded-full px-2.25 py-0.75 text-[10px] font-bold" style={row.badgeStyle}>{row.typeLabel}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-[10.5px] font-bold text-[var(--color-text-secondary)]">{row.date}</span>
                      {/*
                        Il registro e' l'unico posto dove rimborsi e contributi
                        si vedono, quindi e' l'unico posto da cui si possono
                        togliere. Il cestino c'e' anche sulle uscite, che
                        restano cancellabili pure dal loro pannello: tre
                        movimenti nello stesso elenco, tre volte la stessa
                        mossa. Bersaglio da 44px con margini negativi, cosi'
                        la riga non si alza.
                      */}
                      <button
                        type="button"
                        aria-label={`Elimina ${row.typeLabel.toLowerCase()}`}
                        className="-my-2.5 -mr-1.5 flex h-11 w-11 items-center justify-center rounded-full text-sm text-[#c2445a]"
                        onClick={() => setDaEliminare({ kind: row.kind, id: row.id })}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  <div className="mb-0.75 text-[13.5px] font-bold">{row.desc}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] font-semibold text-[#8a7256]">{row.whoLine}</span>
                    <span className="font-display text-sm font-semibold" style={{ color: row.amountColor }}>{row.amountLabel}</span>
                  </div>
                </div>
              ))}
              {ledgerRows.length === 0 && (
                <div className="py-6 text-center text-[12.5px] font-semibold text-[var(--color-text-secondary)]">Ancora nulla da mostrare.</div>
              )}
            </div>
            <div className="border-t border-dashed border-[var(--color-sand)] px-5.5 py-3.5">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Totale per persona</div>
              <div className="mb-3.5 flex flex-wrap gap-2">
                {balanceChips.map((b) => (
                  <div key={b.code} className="rounded-xl border border-[var(--color-card-border)] bg-white px-2.5 py-1.5 text-[11.5px] font-bold">{b.name}: {b.amountLabel}</div>
                ))}
              </div>
              <button type="button" className="w-full rounded-full bg-[var(--color-text-strong)] py-3 text-center text-[12.5px] font-bold text-white" onClick={exportCsv}>⬇️ Esporta su Excel (CSV)</button>
            </div>
          </div>
        </div>
      )}

      {/*
        Stessa finestra dell'eliminazione di un viaggio: quando l'app chiede
        "sei sicuro" lo fa sempre nello stesso modo. z-50 perche' deve stare
        sopra il registro e sopra il pannello della spesa, che sono a z-40.
      */}
      {daEliminare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8" onClick={() => !eliminando && setDaEliminare(null)}>
          <div className="rounded-[22px] bg-white p-6 text-center shadow-[0_30px_60px_-20px_rgba(0,0,0,.5)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2.5 text-3xl">⚠️</div>
            <div className="mb-2 font-display text-[17px] font-bold text-[var(--color-text)]">{TESTI_ELIMINA[daEliminare.kind].titolo}</div>
            <div className="mb-5 text-xs font-semibold leading-snug text-[var(--color-text-secondary)]">
              I saldi di tutta la crew si ricalcolano. L'azione non si può annullare.
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                className="flex-1 rounded-full border border-[var(--color-card-border)] bg-white py-3 text-center text-xs font-bold text-[var(--color-text)] disabled:opacity-60"
                disabled={eliminando}
                onClick={() => setDaEliminare(null)}
              >
                Annulla
              </button>
              <button
                type="button"
                className="flex-1 rounded-full bg-[#c2445a] py-3 text-center text-xs font-bold text-white disabled:opacity-60"
                disabled={eliminando}
                onClick={eliminaMovimento}
              >
                {eliminando ? 'Eliminazione...' : 'Elimina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
