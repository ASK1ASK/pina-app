import { useEffect, useState } from 'react'
import { EditableText } from '../components/EditableText'
import {
  computeBalances,
  loadExpensesData,
  loadStops,
  saveExpensesData,
  people,
  personOrder,
  currentUser,
  type CassaContribution,
  type Expense,
  type PersonId,
  type Settlement,
  type Stop,
} from '../lib/tripData'
import { PersonPicker } from './spese/PersonPicker'

type SheetMode = null | 'expense' | 'settlement' | 'cassa' | 'ledger'

interface ExpenseForm {
  title: string
  amount: string
  icon: string
  paidBy: PersonId
  splitAmong: PersonId[]
  note: string
}
interface SettleForm {
  from: PersonId
  to: PersonId
  amount: string
}
interface CassaForm {
  person: PersonId
  amount: string
}

function fmtAmount(n: number) {
  return n.toFixed(n % 1 ? 2 : 0)
}

function AmountEditable({ value, onSave, placeholder = '0' }: { value: string; onSave: (text: string) => void; placeholder?: string }) {
  const filled = !!value
  return (
    <EditableText
      key={value}
      initialText={value || placeholder}
      className="rounded-2xl border border-[var(--color-card-border)] bg-white px-3.5 py-2.75 font-display text-base"
      style={{ color: filled ? '#3a2a1c' : '#b39a78', fontWeight: filled ? 700 : 600, fontStyle: filled ? 'normal' : 'italic' }}
      onFocus={(e) => { if (!filled) e.currentTarget.textContent = '' }}
      onBlurText={onSave}
    />
  )
}

export function Spese() {
  const [stops, setStops] = useState<Stop[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [cassaContributions, setCassaContributions] = useState<CassaContribution[]>([])
  const [sheetMode, setSheetMode] = useState<SheetMode>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ExpenseForm>({ title: '', amount: '', icon: '💳', paidBy: currentUser, splitAmong: [...personOrder], note: '' })
  const [settleForm, setSettleForm] = useState<SettleForm>({ from: personOrder[1] ?? personOrder[0], to: personOrder[0], amount: '' })
  const [cassaForm, setCassaForm] = useState<CassaForm>({ person: currentUser, amount: '' })
  const [balancesExpanded, setBalancesExpanded] = useState(false)

  useEffect(() => {
    setStops(loadStops())
    const data = loadExpensesData()
    setExpenses(data.expenses)
    setSettlements(data.settlements)
    setCassaContributions(data.cassaContributions)
  }, [])

  function persist(patch: { expenses?: Expense[]; settlements?: Settlement[]; cassaContributions?: CassaContribution[] }) {
    const nextExpenses = patch.expenses ?? expenses
    const nextSettlements = patch.settlements ?? settlements
    const nextCassa = patch.cassaContributions ?? cassaContributions
    if (patch.expenses) setExpenses(patch.expenses)
    if (patch.settlements) setSettlements(patch.settlements)
    if (patch.cassaContributions) setCassaContributions(patch.cassaContributions)
    saveExpensesData({ expenses: nextExpenses, settlements: nextSettlements, cassaContributions: nextCassa })
  }

  function todayStopName() {
    return stops.find((s) => s.kind === 'today')?.name || 'Oggi'
  }

  function closeSheet() {
    setSheetMode(null)
    setEditingId(null)
  }

  function openAddExpense() {
    setSheetMode('expense')
    setEditingId(null)
    setForm({ title: '', amount: '', icon: '💳', paidBy: currentUser, splitAmong: [...personOrder], note: '' })
  }
  function openEditExpense(exp: Expense) {
    setSheetMode('expense')
    setEditingId(exp.id)
    setForm({ title: exp.title, amount: String(exp.amount), icon: exp.icon, paidBy: exp.paidBy as PersonId, splitAmong: [...exp.splitAmong], note: exp.note || '' })
  }

  function toggleSplit(code: PersonId) {
    setForm((f) => {
      const has = f.splitAmong.includes(code)
      const next = has ? f.splitAmong.filter((c) => c !== code) : [...f.splitAmong, code]
      return { ...f, splitAmong: next.length ? next : f.splitAmong }
    })
  }

  function saveExpenseForm() {
    const amount = parseFloat(String(form.amount).replace(',', '.')) || 0
    if (!form.title || amount <= 0) return
    const split = form.splitAmong.length ? form.splitAmong : personOrder
    if (editingId) {
      persist({ expenses: expenses.map((e) => (e.id !== editingId ? e : { ...e, title: form.title, amount, icon: form.icon, paidBy: form.paidBy, splitAmong: split, note: form.note })) })
    } else {
      const newExp: Expense = { id: 'e' + Date.now(), title: form.title, amount, icon: form.icon, paidBy: form.paidBy, splitAmong: split, note: form.note, dateLabel: `Oggi · ${todayStopName()}` }
      persist({ expenses: [newExp, ...expenses] })
    }
    closeSheet()
  }

  function deleteExpense() {
    if (!editingId) return
    persist({ expenses: expenses.filter((e) => e.id !== editingId) })
    closeSheet()
  }

  function openSettlement() {
    setSheetMode('settlement')
    setSettleForm({ from: personOrder[1] ?? personOrder[0], to: personOrder[0], amount: '' })
  }
  function saveSettlement() {
    const amount = parseFloat(String(settleForm.amount).replace(',', '.')) || 0
    if (!settleForm.from || !settleForm.to || settleForm.from === settleForm.to || amount <= 0) return
    const rec: Settlement = { id: 's' + Date.now(), from: settleForm.from, to: settleForm.to, amount, dateLabel: `Oggi · ${todayStopName()}` }
    persist({ settlements: [rec, ...settlements] })
    closeSheet()
  }

  function openCassa() {
    setSheetMode('cassa')
    setCassaForm({ person: currentUser, amount: '' })
  }
  function saveCassaContribution() {
    const amount = parseFloat(String(cassaForm.amount).replace(',', '.')) || 0
    if (amount <= 0) return
    const rec: CassaContribution = { id: 'c' + Date.now(), person: cassaForm.person, amount, dateLabel: `Oggi · ${todayStopName()}` }
    persist({ cassaContributions: [rec, ...cassaContributions] })
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
  const balances = computeBalances(expenses, settlements)
  const cassaTotal = cassaContributions.reduce((a, c) => a + c.amount, 0) - expenses.filter((e) => e.paidBy === 'cassa').reduce((a, e) => a + e.amount, 0)

  const balanceChips = personOrder.map((code) => {
    const p = people[code]
    const rounded = Math.round((balances[code] || 0) * 100) / 100
    let statusLabel = 'in pari', amountLabel = '0€', amountColor = '#fff1d6'
    if (rounded > 0.01) { statusLabel = 'riceve'; amountLabel = `+${fmtAmount(rounded)}€`; amountColor = '#d7ffe0' }
    else if (rounded < -0.01) { statusLabel = 'deve'; amountLabel = `-${fmtAmount(Math.abs(rounded))}€`; amountColor = '#fff1d6' }
    return { code, name: p.name, amountLabel, amountColor, statusLabel }
  })
  const visibleBalanceChips = balancesExpanded ? balanceChips : balanceChips.slice(0, 6)

  const groupedRecentExpenses: { label: string; items: Expense[] }[] = []
  expenses.slice(0, 5).forEach((exp) => {
    const g = groupedRecentExpenses[groupedRecentExpenses.length - 1]
    if (!g || g.label !== exp.dateLabel) groupedRecentExpenses.push({ label: exp.dateLabel, items: [exp] })
    else g.items.push(exp)
  })

  const badgeCls = (bg: string, color: string) => ({ background: bg, color })
  const expenseRows = expenses.map((e) => {
    const among = e.splitAmong.length ? e.splitAmong : personOrder
    const payer = e.paidBy !== 'cassa' ? people[e.paidBy] : null
    return {
      id: e.id,
      date: e.dateLabel, desc: e.title, typeLabel: 'Uscita', badgeStyle: badgeCls('#fdeceb', '#c2445a'),
      who: payer ? payer.name : 'Cassa comune', toWhom: among.map((c) => people[c]?.name || c).join(', '),
      whoLine: `${payer ? payer.name : 'Cassa'} → ${among.map((c) => people[c]?.name || c).join(', ')}`,
      amountLabel: `-${e.amount}€`, amountColor: '#c2445a', rawAmount: -e.amount,
    }
  })
  const settlementRows = settlements.map((s) => {
    const fromP = people[s.from], toP = people[s.to]
    return {
      id: s.id, date: s.dateLabel || 'Oggi', desc: 'Rimborso', typeLabel: 'Rimborso', badgeStyle: badgeCls('#e9f7f0', '#3f8f5f'),
      who: fromP.name, toWhom: toP.name, whoLine: `${fromP.name} → ${toP.name}`,
      amountLabel: `${s.amount}€`, amountColor: '#3f8f5f', rawAmount: s.amount,
    }
  })
  const cassaRows = cassaContributions.map((c) => {
    const p = people[c.person]
    return {
      id: c.id, date: c.dateLabel || 'Oggi', desc: 'Contributo cassa comune', typeLabel: 'Cassa', badgeStyle: badgeCls('#fdf3d9', '#b8792e'),
      who: p.name, toWhom: 'Cassa comune', whoLine: `${p.name} → Cassa comune`,
      amountLabel: `${c.amount}€`, amountColor: '#b8792e', rawAmount: c.amount,
    }
  })
  const ledgerRows = [...expenseRows, ...settlementRows, ...cassaRows]

  const sheetTitle = editingId ? 'Modifica spesa' : 'Nuova spesa'
  const sheetSaveLabel = editingId ? 'Salva modifiche' : 'Aggiungi spesa'

  return (
    <div className="mx-auto min-h-svh max-w-md bg-[var(--color-cream)] px-4.5 pb-24 pt-8 text-[var(--color-text)]">
      <div className="mb-4.5 flex items-center justify-between">
        <a href="/" className="font-display text-[19px] font-semibold italic text-[var(--color-coral)]">🦩 Piña</a>
        <a href="/" className="whitespace-nowrap rounded-xl border border-[var(--color-card-border)] bg-white px-3.5 py-1.75 text-xs font-bold text-[var(--color-text)]">🏠 Home</a>
      </div>

      <div className="mb-4.5 font-display text-2xl font-semibold">Spese</div>

      <div className="mb-3.5 rounded-[26px] p-5 text-white shadow-[0_18px_36px_-18px_rgba(255,150,60,.5)]" style={{ background: 'linear-gradient(135deg,#ffb627,#ff8a5b)' }}>
        <div className="mb-1 text-xs font-bold text-white/85">Totale speso finora</div>
        <div className="font-display text-[38px] font-bold leading-none">{fmtAmount(totalSpent)}€</div>
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
          <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fdeee0] text-lg font-bold text-[var(--color-coral)]" onClick={openCassa}>＋</button>
        </div>
        <div className="mt-2 text-[11.5px] font-semibold text-[var(--color-text-secondary)]">{cassaContributions.length} contribut{cassaContributions.length === 1 ? 'o' : 'i'} disponibili</div>
      </div>

      <div className="mx-0.5 mb-3.5 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Spese recenti</span>
        <button type="button" className="text-xs font-bold text-[var(--color-coral)]" onClick={() => setSheetMode('ledger')}>Tutte →</button>
      </div>

      {expenses.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {groupedRecentExpenses.map((grp, gi) => (
            <div key={gi}>
              <div className="mx-0.5 mb-2 text-[11px] font-bold text-[var(--color-eyebrow)]">{grp.label}</div>
              <div className="flex flex-col gap-2.5">
                {grp.items.map((exp) => {
                  const among = exp.splitAmong.length ? exp.splitAmong : personOrder
                  const share = exp.amount / among.length
                  const payer = exp.paidBy !== 'cassa' ? people[exp.paidBy] : null
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
                          {among.map((code, i) => (
                            <span key={code} className="flex h-5.5 w-5.5 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white" style={{ background: people[code].color, marginLeft: i === 0 ? 0 : -7 }}>{code}</span>
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
        className="fixed bottom-24 right-5 z-20 flex h-13 w-13 items-center justify-center rounded-full text-2xl text-white shadow-[0_12px_24px_-8px_rgba(255,90,60,.55)]"
        style={{ background: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' }}
        onClick={openAddExpense}
      >
        ＋
      </button>

      {sheetMode === 'expense' && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={closeSheet}>
          <div className="max-h-[88%] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[var(--color-bg)] p-5.5 shadow-[0_-20px_50px_-20px_rgba(0,0,0,.4)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="font-display text-lg font-bold">{sheetTitle}</div>
              <button type="button" className="text-xl text-[#c2a97e]" onClick={closeSheet}>×</button>
            </div>

            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">La tua spesa</div>
            <AmountEditable value={form.title} placeholder="Es. Cena in centro" onSave={(text) => setForm((f) => ({ ...f, title: text }))} />

            <div className="mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Importo (€)</div>
            <AmountEditable value={form.amount} onSave={(text) => setForm((f) => ({ ...f, amount: text }))} />

            <div className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Chi ha pagato</div>
            <PersonPicker isSelected={(c) => form.paidBy === c} onClick={(c) => setForm((f) => ({ ...f, paidBy: c }))} />

            <div className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Diviso tra</div>
            <PersonPicker isSelected={(c) => form.splitAmong.includes(c)} onClick={toggleSplit} />
            <div className="mt-2 text-[11.5px] font-semibold text-[var(--color-text-secondary)]">Diviso tra {form.splitAmong.length} persone</div>

            <div className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Note (opzionale)</div>
            <EditableText
              key={form.note}
              initialText={form.note || 'Aggiungi una nota...'}
              className="rounded-2xl border border-[var(--color-card-border)] bg-white px-3.5 py-2.75 text-[13px] font-semibold"
              style={{ color: form.note ? '#3a2a1c' : '#b39a78', fontStyle: form.note ? 'normal' : 'italic' }}
              onFocus={(e) => { if (!form.note) e.currentTarget.textContent = '' }}
              onBlurText={(text) => setForm((f) => ({ ...f, note: text }))}
            />

            <div className="mt-5.5 flex gap-2.5">
              {editingId && (
                <button type="button" className="shrink-0 rounded-full bg-[#fdeceb] px-4.5 py-3.25 text-center text-[12.5px] font-bold text-[#c2445a]" onClick={deleteExpense}>🗑 Elimina</button>
              )}
              <button type="button" className="flex-1 rounded-full py-3.25 text-center text-[13.5px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' }} onClick={saveExpenseForm}>{sheetSaveLabel}</button>
            </div>
          </div>
        </div>
      )}

      {sheetMode === 'settlement' && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={closeSheet}>
          <div className="w-full max-w-md rounded-t-3xl bg-[var(--color-bg)] p-5.5 shadow-[0_-20px_50px_-20px_rgba(0,0,0,.4)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="font-display text-lg font-bold">Registra un rimborso</div>
              <button type="button" className="text-xl text-[#c2a97e]" onClick={closeSheet}>×</button>
            </div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Chi rimborsa</div>
            <div className="mb-3.5"><PersonPicker isSelected={(c) => settleForm.from === c} onClick={(c) => setSettleForm((f) => ({ ...f, from: c }))} /></div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">A chi</div>
            <div className="mb-3.5"><PersonPicker isSelected={(c) => settleForm.to === c} onClick={(c) => setSettleForm((f) => ({ ...f, to: c }))} /></div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Importo (€)</div>
            <AmountEditable value={settleForm.amount} onSave={(text) => setSettleForm((f) => ({ ...f, amount: text }))} />
            <button type="button" className="mt-5.5 w-full rounded-full py-3.25 text-center text-[13.5px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' }} onClick={saveSettlement}>Conferma rimborso</button>
          </div>
        </div>
      )}

      {sheetMode === 'cassa' && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={closeSheet}>
          <div className="w-full max-w-md rounded-t-3xl bg-[var(--color-bg)] p-5.5 shadow-[0_-20px_50px_-20px_rgba(0,0,0,.4)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="font-display text-lg font-bold">Aggiungi alla cassa comune</div>
              <button type="button" className="text-xl text-[#c2a97e]" onClick={closeSheet}>×</button>
            </div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Chi contribuisce</div>
            <div className="mb-3.5"><PersonPicker isSelected={(c) => cassaForm.person === c} onClick={(c) => setCassaForm((f) => ({ ...f, person: c }))} /></div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Importo (€)</div>
            <AmountEditable value={cassaForm.amount} onSave={(text) => setCassaForm((f) => ({ ...f, amount: text }))} />
            <button type="button" className="mt-5.5 w-full rounded-full py-3.25 text-center text-[13.5px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' }} onClick={saveCassaContribution}>Aggiungi</button>
          </div>
        </div>
      )}

      {sheetMode === 'ledger' && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={closeSheet}>
          <div className="flex h-[82%] w-full max-w-md flex-col rounded-t-3xl bg-[var(--color-bg)] shadow-[0_-20px_50px_-20px_rgba(0,0,0,.4)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5.5 pb-3.5 pt-5.5">
              <div className="font-display text-lg font-bold">Tutte le spese</div>
              <button type="button" className="text-xl text-[#c2a97e]" onClick={closeSheet}>×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5.5">
              {ledgerRows.map((row) => (
                <div key={row.id} className="mb-2 rounded-2xl border border-[var(--color-card-border)] bg-white p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="rounded-full px-2.25 py-0.75 text-[10px] font-bold" style={row.badgeStyle}>{row.typeLabel}</span>
                    <span className="text-[10.5px] font-bold text-[var(--color-text-secondary)]">{row.date}</span>
                  </div>
                  <div className="mb-0.75 text-[13.5px] font-bold">{row.desc}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] font-semibold text-[#8a7256]">{row.whoLine}</span>
                    <span className="font-display text-sm font-semibold" style={{ color: row.amountColor }}>{row.amountLabel}</span>
                  </div>
                </div>
              ))}
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
    </div>
  )
}
