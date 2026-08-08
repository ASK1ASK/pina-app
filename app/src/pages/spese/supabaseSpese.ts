import { supabase, unwrap, unwrapVoid } from '../../lib/supabase'

export interface RealMember {
  id: string
  userId: string | null
  name: string
  color: string
  /** Valorizzato se ha lasciato il viaggio o ne e' stato rimosso. */
  leftAt: string | null
}

/**
 * Chi fa ancora parte della crew.
 *
 * Da usare dove si guarda avanti — chi paga una spesa nuova, a chi si assegna
 * una voce di checklist, quante persone dice la Home. NON dove si guarda
 * indietro: le spese gia' registrate, i saldi ancora aperti e le foto gia'
 * caricate devono continuare a mostrare il nome di chi le ha fatte, altrimenti
 * i conti non tornano piu' e i nomi diventano "undefined".
 */
export function membriAttivi(membri: RealMember[]): RealMember[] {
  return membri.filter((m) => !m.leftAt)
}

export interface RealExpense {
  id: string
  title: string
  icon: string
  amount: number
  paidByMemberId: string | null // null = cassa comune
  splitAmong: string[]
  note: string
  dateLabel: string
}

export interface RealSettlement {
  id: string
  fromMemberId: string
  toMemberId: string
  amount: number
  dateLabel: string
}

export interface RealCassaContribution {
  id: string
  memberId: string
  amount: number
  dateLabel: string
}

function formatDateLabel(dateStr: string): string {
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000)
  if (diffDays === 0) return 'Oggi'
  if (diffDays === 1) return 'Ieri'
  return target.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
}

// Tutta la crew del viaggio, non solo chi si e' gia' unito dall'app: un amico
// che non installa Piña deve comunque poter comparire nelle spese, nella cassa
// e tra gli assegnatari della checklist. Quando poi si unisce reclamando il suo
// posto, join_trip_claim_slot aggiorna QUESTA stessa riga, quindi spese e saldi
// accumulati prima restano attaccati a lui senza perdersi.
//
// Restituisce anche chi ha lasciato il viaggio, con leftAt valorizzato: filtrare
// qui una volta per tutte sarebbe comodo e sbagliato, perche' i suoi cento euro
// di spese e il suo nome sulle foto devono restare visibili. Chi chiama decide
// caso per caso, con membriAttivi() dove serve.
export async function fetchTripMembers(tripId: string): Promise<RealMember[]> {
  const data = unwrap(
    await supabase
      .from('trip_members')
      .select('id, user_id, display_name, color, left_at')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true }),
  )
  return (data || []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    name: m.display_name,
    color: m.color,
    leftAt: m.left_at,
  }))
}

/** Uscita volontaria dalla crew. La riga resta, con le sue spese: vedi 0008. */
export async function leaveTrip(tripId: string): Promise<void> {
  unwrapVoid(await supabase.rpc('leave_trip', { p_trip_id: tripId }))
}

/** Rimozione decisa dall'organizzatore. Stesso effetto di leaveTrip. */
export async function removeTripMember(memberId: string): Promise<void> {
  unwrapVoid(await supabase.rpc('remove_trip_member', { p_member_id: memberId }))
}

export async function fetchExpensesData(tripId: string): Promise<{
  expenses: RealExpense[]
  settlements: RealSettlement[]
  cassaContributions: RealCassaContribution[]
}> {
  const expenseRows = unwrap(
    await supabase
      .from('expenses')
      .select('*')
      .eq('trip_id', tripId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false }),
  )
  const expenseIds = (expenseRows || []).map((e) => e.id)

  const [splitRes, settlementRes, cassaRes] = await Promise.all([
    expenseIds.length
      ? supabase.from('expense_splits').select('*').in('expense_id', expenseIds)
      : Promise.resolve({ data: [] as { expense_id: string; member_id: string }[], error: null }),
    supabase.from('settlements').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
    supabase.from('cassa_contributions').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
  ])
  const splitRows = unwrap(splitRes)
  const settlementRows = unwrap(settlementRes)
  const cassaRows = unwrap(cassaRes)

  const splitsByExpense: Record<string, string[]> = {}
  ;(splitRows || []).forEach((s) => {
    ;(splitsByExpense[s.expense_id] ||= []).push(s.member_id)
  })

  const expenses: RealExpense[] = (expenseRows || []).map((e) => ({
    id: e.id,
    title: e.title,
    icon: e.icon,
    amount: Number(e.amount),
    paidByMemberId: e.paid_by_member_id,
    splitAmong: splitsByExpense[e.id] || [],
    note: e.note,
    dateLabel: formatDateLabel(e.expense_date),
  }))

  const settlements: RealSettlement[] = (settlementRows || []).map((s) => ({
    id: s.id,
    fromMemberId: s.from_member_id,
    toMemberId: s.to_member_id,
    amount: Number(s.amount),
    dateLabel: formatDateLabel(s.settlement_date),
  }))

  const cassaContributions: RealCassaContribution[] = (cassaRows || []).map((c) => ({
    id: c.id,
    memberId: c.member_id,
    amount: Number(c.amount),
    dateLabel: formatDateLabel(c.contribution_date),
  }))

  return { expenses, settlements, cassaContributions }
}

interface ExpenseInput {
  title: string
  icon: string
  amount: number
  paidByMemberId: string | null
  splitAmong: string[]
  note: string
}

export async function createExpense(tripId: string, input: ExpenseInput): Promise<RealExpense> {
  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      trip_id: tripId,
      title: input.title,
      icon: input.icon,
      amount: input.amount,
      paid_by_member_id: input.paidByMemberId,
      note: input.note,
    })
    .select()
    .single()
  if (error || !expense) throw error ?? new Error('Errore durante la creazione della spesa.')
  if (input.splitAmong.length) {
    unwrapVoid(
      await supabase.from('expense_splits').insert(input.splitAmong.map((memberId) => ({ expense_id: expense.id, member_id: memberId }))),
    )
  }
  return {
    id: expense.id,
    title: expense.title,
    icon: expense.icon,
    amount: Number(expense.amount),
    paidByMemberId: expense.paid_by_member_id,
    splitAmong: input.splitAmong,
    note: expense.note,
    dateLabel: formatDateLabel(expense.expense_date),
  }
}

export async function updateExpense(expenseId: string, input: ExpenseInput): Promise<void> {
  unwrapVoid(
    await supabase
      .from('expenses')
      .update({
        title: input.title,
        icon: input.icon,
        amount: input.amount,
        paid_by_member_id: input.paidByMemberId,
        note: input.note,
      })
      .eq('id', expenseId),
  )
  unwrapVoid(await supabase.from('expense_splits').delete().eq('expense_id', expenseId))
  if (input.splitAmong.length) {
    unwrapVoid(
      await supabase.from('expense_splits').insert(input.splitAmong.map((memberId) => ({ expense_id: expenseId, member_id: memberId }))),
    )
  }
}

export async function deleteExpense(expenseId: string): Promise<void> {
  unwrapVoid(await supabase.from('expenses').delete().eq('id', expenseId))
}

export async function createSettlement(tripId: string, input: { fromMemberId: string; toMemberId: string; amount: number }): Promise<void> {
  unwrapVoid(
    await supabase.from('settlements').insert({ trip_id: tripId, from_member_id: input.fromMemberId, to_member_id: input.toMemberId, amount: input.amount }),
  )
}

export async function createCassaContribution(tripId: string, input: { memberId: string; amount: number }): Promise<void> {
  unwrapVoid(await supabase.from('cassa_contributions').insert({ trip_id: tripId, member_id: input.memberId, amount: input.amount }))
}

// Rimborsi e contributi entrano in computeBalances esattamente come le spese:
// senza un modo di toglierli, una cifra sbagliata o un versamento registrato
// due volte falsava i conti di tutta la crew per il resto del viaggio, e
// l'importo non accetta zero ne' valori negativi, quindi non si poteva
// nemmeno compensare con un movimento opposto.
//
// Non serve alcuna migrazione: le due tabelle stanno fra le trip_scoped_tables
// della 0001, che ricevono una policy "for all" — la cancellazione e' gia'
// compresa, per chiunque sia nella crew.

export async function deleteSettlement(settlementId: string): Promise<void> {
  unwrapVoid(await supabase.from('settlements').delete().eq('id', settlementId))
}

export async function deleteCassaContribution(contributionId: string): Promise<void> {
  unwrapVoid(await supabase.from('cassa_contributions').delete().eq('id', contributionId))
}
