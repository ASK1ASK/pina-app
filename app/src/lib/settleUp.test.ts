import { describe, expect, it } from 'vitest'
import { computeBalances, type BalanceExpense } from './balances'
import { pianoRimborsi, residuoAtteso } from './settleUp'

const CREW = ['a', 'l', 'm']

function spesa(amount: number, paidBy: string, splitAmong: string[] = CREW): BalanceExpense {
  return { amount, paidBy, splitAmong }
}

/** Somma di quanto ogni persona muove: negativo se paga, positivo se incassa. */
function effetto(pagamenti: { from: string; to: string; amount: number }[], id: string): number {
  const dato = pagamenti.filter((p) => p.from === id).reduce((a, p) => a + p.amount, 0)
  const preso = pagamenti.filter((p) => p.to === id).reduce((a, p) => a + p.amount, 0)
  return Math.round((preso - dato) * 100) / 100
}

describe('il piano non inventa e non perde soldi', () => {
  it('a conti gia in pari non propone niente', () => {
    expect(pianoRimborsi({ a: 0, l: 0, m: 0 }, CREW)).toEqual({ pagamenti: [], residuoCassa: 0 })
  })

  it('con due persone il pagamento e il saldo netto', () => {
    const { pagamenti } = pianoRimborsi({ a: 30, l: -30 }, ['a', 'l'])
    expect(pagamenti).toEqual([{ from: 'l', to: 'a', amount: 30 }])
  })

  // Il caso di COLLAUDO #43: due creditori e un debitore solo. Tre saldi netti,
  // due pagamenti, entrambi della stessa persona -- l'abbinamento che prima si
  // faceva a mente.
  it('un debitore che paga due creditori', () => {
    const { pagamenti } = pianoRimborsi({ a: 15, l: 10, m: -25 }, CREW)
    expect(pagamenti).toEqual([
      { from: 'm', to: 'a', amount: 15 },
      { from: 'm', to: 'l', amount: 10 },
    ])
  })

  it('due debitori verso un creditore solo', () => {
    const { pagamenti } = pianoRimborsi({ a: 52, l: -20, m: -32 }, CREW)
    expect(pagamenti).toEqual([
      { from: 'm', to: 'a', amount: 32 },
      { from: 'l', to: 'a', amount: 20 },
    ])
  })

  // Chi e' a credito incassa esattamente il suo credito, chi e' a debito tira
  // fuori esattamente il suo debito: applicando il piano, tutti i saldi vanno
  // a zero.
  it('ogni persona finisce esattamente in pari', () => {
    const balances = { a: 47.5, l: -12.25, m: -35.25 }
    const { pagamenti } = pianoRimborsi(balances, CREW)
    CREW.forEach((id) => {
      const saldo = balances[id as keyof typeof balances]
      expect(effetto(pagamenti, id)).toBe(saldo)
    })
  })

  it('non chiede mai a nessuno di pagare due volte lo stesso debito', () => {
    const { pagamenti } = pianoRimborsi({ a: 60, l: 30, m: -90 }, CREW)
    expect(effetto(pagamenti, 'm')).toBe(-90)
  })

  it('non produce mai piu pagamenti che persone coinvolte, meno uno', () => {
    const crew = ['a', 'l', 'm', 's', 'g']
    const { pagamenti } = pianoRimborsi({ a: 40, l: 25, m: -13, s: -22, g: -30 }, crew)
    expect(pagamenti.length).toBeLessThanOrEqual(crew.length - 1)
  })
})

describe('centesimi e arrotondamenti', () => {
  // Tre quote da 33,3333 lasciano dietro frazioni che nessuno puo' pagare: se
  // finiscono nell'elenco, la schermata propone un rimborso da 0€. E lo scarto
  // fra i centesimi non deve nemmeno diventare un finto residuo di cassa: qui
  // la cassa e' vuota, quindi il residuo e' zero e non un centesimo.
  it('una spesa che non si divide in tre non genera rimborsi fantasma', () => {
    const bal = computeBalances([spesa(100, 'a')], [], [], CREW)
    const { pagamenti, residuoCassa } = pianoRimborsi(bal, CREW)
    expect(pagamenti).toEqual([
      { from: 'l', to: 'a', amount: 33.33 },
      { from: 'm', to: 'a', amount: 33.33 },
    ])
    expect(residuoCassa).toBe(0)
  })

  it('gli scarti sotto il centesimo restano fuori', () => {
    const { pagamenti } = pianoRimborsi({ a: 0.004, l: -0.004, m: 0 }, CREW)
    expect(pagamenti).toEqual([])
  })

  it('nessun importo arriva mai piu in la del centesimo', () => {
    const bal = computeBalances([spesa(10, 'a'), spesa(7, 'l', ['l', 'm'])], [], [], CREW)
    const { pagamenti } = pianoRimborsi(bal, CREW)
    expect(pagamenti.length).toBeGreaterThan(0)
    pagamenti.forEach((p) => expect(p.amount).toBe(Math.round(p.amount * 100) / 100))
  })
})

describe('la cassa comune non e una persona', () => {
  // La somma dei saldi e' zero solo a cassa vuota: i soldi ancora nel fondo
  // restano di chi li ha versati. Quel credito non lo deve nessun altro.
  it('con soldi ancora in cassa il credito che avanza non diventa un debito', () => {
    const contributi = [{ person: 'a', amount: 60 }]
    const bal = computeBalances([], [], contributi, CREW)
    const { pagamenti, residuoCassa } = pianoRimborsi(bal, CREW)
    expect(pagamenti).toEqual([])
    expect(residuoCassa).toBe(60)
    expect(residuoCassa).toBe(residuoAtteso([], contributi))
  })

  it('chi ha versato in cassa non viene rimborsato dagli altri', () => {
    const contributi = [
      { person: 'a', amount: 50 },
      { person: 'l', amount: 50 },
      { person: 'm', amount: 50 },
    ]
    const spese = [spesa(90, 'cassa')]
    const bal = computeBalances(spese, [], contributi, CREW)
    const { pagamenti, residuoCassa } = pianoRimborsi(bal, CREW)
    expect(pagamenti).toEqual([])
    expect(residuoCassa).toBe(60)
    expect(residuoCassa).toBe(residuoAtteso(spese, contributi))
  })

  it('una cassa in rosso lascia scoperto un debito, e lo dichiara', () => {
    const contributi = [{ person: 'a', amount: 10 }]
    const spese = [spesa(40, 'cassa')]
    const bal = computeBalances(spese, [], contributi, CREW)
    const { residuoCassa } = pianoRimborsi(bal, CREW)
    expect(residuoCassa).toBe(-30)
    expect(residuoCassa).toBe(residuoAtteso(spese, contributi))
  })

  it('i debiti fra persone si chiudono comunque, anche con la cassa piena', () => {
    const contributi = [{ person: 'a', amount: 90 }]
    const spese = [spesa(30, 'l', ['l', 'm'])]
    const bal = computeBalances(spese, [], contributi, CREW)
    const { pagamenti, residuoCassa } = pianoRimborsi(bal, CREW)
    expect(pagamenti).toEqual([{ from: 'm', to: 'a', amount: 15 }])
    expect(residuoCassa).toBe(residuoAtteso(spese, contributi))
  })
})

describe('elenco stabile', () => {
  it('a parita di importo l ordine segue quello della crew', () => {
    const uno = pianoRimborsi({ a: 20, l: -10, m: -10 }, CREW)
    const due = pianoRimborsi({ a: 20, l: -10, m: -10 }, CREW)
    expect(uno.pagamenti).toEqual(due.pagamenti)
    expect(uno.pagamenti[0].from).toBe('l')
  })

  it('chi ha lasciato il viaggio resta nel piano se ha un conto aperto', () => {
    const { pagamenti } = pianoRimborsi({ a: 25, uscito: -25 }, ['a', 'uscito'])
    expect(pagamenti).toEqual([{ from: 'uscito', to: 'a', amount: 25 }])
  })
})
