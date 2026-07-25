import { supabase } from '../../lib/supabase'

export interface RealMember {
  id: string
  userId: string | null
  name: string
  color: string
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

export async function fetchTripMembers(tripId: string): Promise<RealMember[]> {
  const { data } = await supabase
    .from('trip_members')
    .select('id, user_id, display_name, color')
    .eq('trip_id', tripId)
    .eq('status', 'joined')
    .order('created_at', { ascending: true })
  return (data || []).map((m) => ({ id: m.id, userId: m.user_id, name: m.display_name, color: m.color }))
}

export async function fetchExpensesData(tripId: string): Promise<{
  expenses: RealExpense[]
  settlements: RealSettlement[]
  cassaContributions: RealCassaContribution[]
}> {
  const { data: expenseRows } = await supabase
    .from('expenses')
    .select('*')
    .eq('trip_id', tripId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
  const expenseIds = (expenseRows || []).map((e) => e.id)

  const [{ data: splitRows }, { data: settlementRows }, { data: cassaRows }] = await Promise.all([
    expenseIds.length
      ? supabase.from('expense_splits').select('*').in('expense_id', expenseIds)
      : Promise.resolve({ data: [] as { expense_id: string; member_id: string }[] }),
    supabase.from('settlements').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
    supabase.from('cassa_contributions').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
  ])

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
    await supabase.from('expense_splits').insert(input.splitAmong.map((memberId) => ({ expense_id: expense.id, member_id: memberId })))
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
  await supabase
    .from('expenses')
    .update({
      title: input.title,
      icon: input.icon,
      amount: input.amount,
      paid_by_member_id: input.paidByMemberId,
      note: input.note,
    })
    .eq('id', expenseId)
  await supabase.from('expense_splits').delete().eq('expense_id', expenseId)
  if (input.splitAmong.length) {
    await supabase.from('expense_splits').insert(input.splitAmong.map((memberId) => ({ expense_id: expenseId, member_id: memberId })))
  }
}

export async function deleteExpense(expenseId: string): Promise<void> {
  await supabase.from('expenses').delete().eq('id', expenseId)
}

export async function createSettlement(tripId: string, input: { fromMemberId: string; toMemberId: string; amount: number }): Promise<void> {
  await supabase.from('settlements').insert({ trip_id: tripId, from_member_id: input.fromMemberId, to_member_id: input.toMemberId, amount: input.amount })
}

export async function createCassaContribution(tripId: string, input: { memberId: string; amount: number }): Promise<void> {
  await supabase.from('cassa_contributions').insert({ trip_id: tripId, member_id: input.memberId, amount: input.amount })
}
