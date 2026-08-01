// Logica dei conti del viaggio, tenuta fuori dall'interfaccia perche' e' la
// parte dove un errore si nota di piu' (sono soldi veri fra amici) ed e'
// l'unica che vale la pena coprire con test automatici. Vedi balances.test.ts.
//
// Modello: le spese possono essere pagate da una persona oppure dalla cassa
// comune. Un contributo in cassa vale come un pagamento anticipato, quindi
// accredita chi lo versa esattamente come una spesa pagata di tasca propria.

/** Marcatore usato al posto dell'id persona quando paga il fondo comune. */
export const CASSA = 'cassa'

export interface BalanceExpense {
  amount: number
  /** Id del membro che ha pagato, oppure CASSA. */
  paidBy: string
  /** Fra chi e' divisa; se vuoto, si divide fra tutti i membri. */
  splitAmong: string[]
}

export interface BalanceSettlement {
  from: string
  to: string
  amount: number
}

export interface BalanceContribution {
  person: string
  amount: number
}

/**
 * Saldo di ogni membro: positivo = deve ricevere, negativo = deve dare.
 *
 * Vale sempre questa proprieta', utile come verifica: la somma di tutti i
 * saldi e' uguale a quanto resta nella cassa comune, perche' i soldi ancora
 * nel fondo restano di chi li ha versati.
 */
export function computeBalances(
  expenses: BalanceExpense[],
  settlements: BalanceSettlement[],
  contributions: BalanceContribution[],
  memberIds: string[],
): Record<string, number> {
  const bal: Record<string, number> = {}
  memberIds.forEach((id) => {
    bal[id] = 0
  })

  expenses.forEach((e) => {
    const among = e.splitAmong.length ? e.splitAmong : memberIds
    if (among.length === 0) return
    const share = e.amount / among.length
    // Chi anticipa di tasca propria viene accreditato; se paga la cassa non
    // si accredita nessuno, perche' il fondo e' gia' di tutti.
    if (e.paidBy !== CASSA && bal[e.paidBy] !== undefined) bal[e.paidBy] += e.amount
    among.forEach((id) => {
      if (bal[id] !== undefined) bal[id] -= share
    })
  })

  contributions.forEach((c) => {
    if (bal[c.person] !== undefined) bal[c.person] += c.amount
  })

  settlements.forEach((s) => {
    if (bal[s.from] !== undefined) bal[s.from] += s.amount
    if (bal[s.to] !== undefined) bal[s.to] -= s.amount
  })

  return bal
}

/** Quanto resta nella cassa comune: versato meno speso dal fondo. */
export function computeCassaTotal(expenses: BalanceExpense[], contributions: BalanceContribution[]): number {
  const versato = contributions.reduce((a, c) => a + c.amount, 0)
  const speso = expenses.filter((e) => e.paidBy === CASSA).reduce((a, e) => a + e.amount, 0)
  return versato - speso
}
