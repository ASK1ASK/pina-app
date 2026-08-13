// Da "quanto ha ciascuno" a "chi paga chi": l'ultimo passo che i saldi non
// fanno. Con due persone il saldo netto e' gia' la cifra da pagare e questo
// file sembra inutile; dal terzo in poi non lo e' piu', perche' tre saldi netti
// non dicono chi deve dare a chi, e quel conto finiva in testa a chi sta in
// piedi davanti a un bar (COLLAUDO #43).
//
// Questo file NON calcola i saldi: li legge. `computeBalances` resta l'unica
// fonte, con i suoi test. Se un giorno i due non tornano, l'errore e' qui.

import { CASSA, type BalanceContribution, type BalanceExpense } from './balances'

export interface Pagamento {
  /** Chi tira fuori i soldi. */
  from: string
  /** Chi li incassa. */
  to: string
  /** Sempre positivo, arrotondato al centesimo. */
  amount: number
}

export interface PianoRimborsi {
  pagamenti: Pagamento[]
  /**
   * Quello che i pagamenti non chiudono, perche' non e' un debito fra persone.
   *
   * Positivo: soldi ancora fermi nella cassa comune, che restano di chi ce li
   * ha messi e tornano indietro solo svuotandola o spendendola.
   * Negativo: la cassa ha speso piu' di quanto ha incassato, quindi manca
   * quella cifra e va versata prima che i conti tornino.
   */
  residuoCassa: number
}

/** Sotto il centesimo non e' un debito: e' un residuo di divisione. */
const SOGLIA_CENT = 1

function inCentesimi(euro: number): number {
  return Math.round(euro * 100)
}

/**
 * L'elenco dei pagamenti che chiude i conti, dal piu' grande al piu' piccolo.
 *
 * Metodo: si accoppia ogni volta chi deve di piu' con chi deve ricevere di
 * piu'. Non e' il minimo teorico assoluto, ma produce **al massimo una
 * transazione in meno del numero di persone coinvolte** ed e' quello che si fa
 * a mente al tavolo: paga prima chi deve di piu', a chi ha anticipato di piu'.
 *
 * Si lavora in centesimi interi: con i decimali, tre quote da 33,333 lasciano
 * dietro rimborsi da 0,00000001€ che nessuno puo' pagare.
 *
 * ⚠️ La somma dei saldi **non e' zero** quando la cassa comune non e' vuota:
 * i soldi ancora nel fondo restano di chi li ha versati (vedi `balances.ts`).
 * Quello che avanza non e' un debito dimenticato e non va spalmato su
 * nessuno: esce in `residuoCassa` e la schermata lo spiega.
 */
export function pianoRimborsi(balances: Record<string, number>, memberIds: string[]): PianoRimborsi {
  // L'ordine della crew fa da spareggio, cosi' a parita' di importo l'elenco
  // esce sempre uguale: un elenco che si rimescola da solo fra un tocco e
  // l'altro non e' leggibile.
  const debitori: { id: string; cent: number }[] = []
  const creditori: { id: string; cent: number }[] = []

  memberIds.forEach((id) => {
    const cent = inCentesimi(balances[id] || 0)
    if (cent <= -SOGLIA_CENT) debitori.push({ id, cent: -cent })
    else if (cent >= SOGLIA_CENT) creditori.push({ id, cent })
  })

  debitori.sort((x, y) => y.cent - x.cent || memberIds.indexOf(x.id) - memberIds.indexOf(y.id))
  creditori.sort((x, y) => y.cent - x.cent || memberIds.indexOf(x.id) - memberIds.indexOf(y.id))

  const pagamenti: Pagamento[] = []
  let i = 0
  let j = 0
  while (i < debitori.length && j < creditori.length) {
    const quanto = Math.min(debitori[i].cent, creditori[j].cent)
    pagamenti.push({ from: debitori[i].id, to: creditori[j].id, amount: quanto / 100 })
    debitori[i].cent -= quanto
    creditori[j].cent -= quanto
    if (debitori[i].cent < SOGLIA_CENT) i++
    if (creditori[j].cent < SOGLIA_CENT) j++
  }

  // Il residuo si prende dalla somma dei saldi, non da quello che avanza negli
  // elenchi qui sopra. Sono due cose diverse e la prima volta ho preso la
  // seconda: una spesa da 100 divisa in tre lascia 0,01 di scarto fra i
  // centesimi arrotondati, e sommando gli avanzi la schermata avrebbe scritto
  // "resta 1 centesimo in cassa" con la cassa vuota. La somma dei saldi
  // arrotondata alla fine, invece, quello scarto se lo mangia -- ed e'
  // l'invariante gia' documentato in `balances.ts`, quindi anche l'unica
  // definizione di cui ci si puo' fidare.
  const somma = memberIds.reduce((a, id) => a + (balances[id] || 0), 0)

  return { pagamenti, residuoCassa: Math.round(somma * 100) / 100 + 0 }
}

/**
 * Quanto vale il residuo secondo la cassa, per poterlo confrontare col piano.
 *
 * Serve solo ai test: e' la stessa proprieta' gia' documentata in
 * `balances.ts` (la somma dei saldi e' quanto resta in cassa), scritta qui
 * come funzione perche' e' l'invariante su cui si regge `residuoCassa`.
 */
export function residuoAtteso(expenses: BalanceExpense[], contributions: BalanceContribution[]): number {
  const versato = contributions.reduce((a, c) => a + c.amount, 0)
  const speso = expenses.filter((e) => e.paidBy === CASSA).reduce((a, e) => a + e.amount, 0)
  return versato - speso
}
