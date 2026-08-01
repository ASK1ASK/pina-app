import { describe, expect, it } from 'vitest'
import { CASSA, computeBalances, computeCassaTotal, type BalanceExpense } from './balances'

const CREW = ['a', 'l', 'm', 's', 'g']

/** Somma dei saldi, arrotondata per assorbire gli errori di virgola mobile. */
function totale(bal: Record<string, number>): number {
  const somma = Object.values(bal).reduce((x, y) => x + y, 0)
  // Il `+ 0` finale normalizza lo zero negativo: JavaScript tratta -0 e 0
  // come valori distinti nei confronti stretti, e una somma che si annulla
  // partendo da numeri negativi produce -0.
  return Math.round(somma * 100) / 100 + 0
}

function spesa(amount: number, paidBy: string, splitAmong: string[] = CREW): BalanceExpense {
  return { amount, paidBy, splitAmong }
}

describe('saldi senza cassa comune', () => {
  it('un viaggio nuovo parte con tutti a zero', () => {
    expect(computeBalances([], [], [], CREW)).toEqual({ a: 0, l: 0, m: 0, s: 0, g: 0 })
  })

  it('chi paga per tutti e a credito della quota degli altri', () => {
    const bal = computeBalances([spesa(100, 'a')], [], [], CREW)
    expect(bal.a).toBe(80)
    expect(bal.l).toBe(-20)
    expect(totale(bal)).toBe(0)
  })

  it('una spesa divisa solo fra alcuni non tocca gli altri', () => {
    const bal = computeBalances([spesa(60, 'a', ['a', 'l'])], [], [], CREW)
    expect(bal.a).toBe(30)
    expect(bal.l).toBe(-30)
    expect(bal.m).toBe(0)
  })

  it('senza elenco esplicito si divide fra tutta la crew', () => {
    const bal = computeBalances([spesa(50, 'a', [])], [], [], CREW)
    expect(bal.a).toBe(40)
    expect(bal.g).toBe(-10)
  })

  it('un rimborso azzera il debito fra due persone', () => {
    const bal = computeBalances([spesa(100, 'a', ['a', 'l'])], [{ from: 'l', to: 'a', amount: 50 }], [], CREW)
    expect(bal.a).toBe(0)
    expect(bal.l).toBe(0)
  })
})

describe('saldi con la cassa comune', () => {
  // Questo era il difetto C1: i contributi non venivano conteggiati, quindi chi
  // versava soldi nel fondo risultava comunque in debito.
  it('chi versa in cassa viene accreditato', () => {
    const bal = computeBalances([], [], [{ person: 'a', amount: 50 }], CREW)
    expect(bal.a).toBe(50)
    expect(bal.l).toBe(0)
  })

  it('contributi uguali e spesa dal fondo: tutti restano pari fra loro', () => {
    const contributi = CREW.map((p) => ({ person: p, amount: 50 }))
    const bal = computeBalances([spesa(100, CASSA)], [], contributi, CREW)
    CREW.forEach((p) => expect(bal[p]).toBe(30))
    expect(totale(bal)).toBe(150)
  })

  it('contributi diversi: chi ha messo di piu resta a credito', () => {
    const bal = computeBalances([spesa(100, CASSA)], [], [{ person: 'a', amount: 250 }], CREW)
    expect(bal.a).toBe(230)
    expect(bal.l).toBe(-20)
    expect(totale(bal)).toBe(150)
  })

  it('nessun contributo: si comporta come uno split normale', () => {
    const bal = computeBalances([spesa(100, 'a')], [], [], CREW)
    expect(bal.a).toBe(80)
    expect(totale(bal)).toBe(0)
  })
})

describe('quanto resta in cassa', () => {
  it('parte da zero per un viaggio nuovo', () => {
    expect(computeCassaTotal([], [])).toBe(0)
  })

  it('somma i contributi e sottrae le spese pagate dal fondo', () => {
    const contributi = CREW.map((p) => ({ person: p, amount: 50 }))
    expect(computeCassaTotal([spesa(100, CASSA)], contributi)).toBe(150)
  })

  it('le spese pagate di tasca propria non toccano la cassa', () => {
    expect(computeCassaTotal([spesa(100, 'a')], [{ person: 'a', amount: 50 }])).toBe(50)
  })

  it('puo andare in negativo se si spende piu di quanto versato', () => {
    expect(computeCassaTotal([spesa(100, CASSA)], [{ person: 'a', amount: 30 }])).toBe(-70)
  })
})

describe('proprieta che deve valere sempre', () => {
  // Se questa salta, i soldi si sono persi da qualche parte nel calcolo.
  it('la somma dei saldi e uguale a quanto resta in cassa', () => {
    const casi: { nome: string; spese: BalanceExpense[]; contributi: { person: string; amount: number }[] }[] = [
      { nome: 'solo spese personali', spese: [spesa(100, 'a'), spesa(60, 'l')], contributi: [] },
      {
        nome: 'misto cassa e personali',
        spese: [spesa(100, CASSA), spesa(38, 'a'), spesa(54, 'g')],
        contributi: CREW.map((p) => ({ person: p, amount: 50 })),
      },
      {
        nome: 'cassa in negativo',
        spese: [spesa(200, CASSA)],
        contributi: [{ person: 'a', amount: 30 }],
      },
      {
        nome: 'contributi sbilanciati',
        spese: [spesa(75, CASSA), spesa(20, 'm', ['m', 's'])],
        contributi: [{ person: 'a', amount: 100 }, { person: 'l', amount: 25 }],
      },
    ]

    for (const c of casi) {
      const bal = computeBalances(c.spese, [], c.contributi, CREW)
      expect(totale(bal), c.nome).toBe(computeCassaTotal(c.spese, c.contributi))
    }
  })

  it('i rimborsi non cambiano il totale complessivo', () => {
    const spese = [spesa(100, 'a')]
    const senza = totale(computeBalances(spese, [], [], CREW))
    const con = totale(computeBalances(spese, [{ from: 'l', to: 'a', amount: 20 }], [], CREW))
    expect(con).toBe(senza)
  })
})

describe('casi limite che non devono far saltare i conti', () => {
  it('ignora chi non fa parte della crew invece di inventare un saldo', () => {
    const bal = computeBalances([spesa(50, 'sconosciuto', ['a', 'l'])], [], [], CREW)
    expect(bal.sconosciuto).toBeUndefined()
    expect(bal.a).toBe(-25)
  })

  it('ignora un contributo di un ex membro rimosso dalla crew', () => {
    const bal = computeBalances([], [], [{ person: 'exmembro', amount: 100 }], CREW)
    expect(bal.exmembro).toBeUndefined()
    CREW.forEach((p) => expect(bal[p]).toBe(0))
  })

  it('una crew vuota non produce divisioni per zero', () => {
    const bal = computeBalances([spesa(100, 'a', [])], [], [], [])
    expect(Object.values(bal).some(Number.isNaN)).toBe(false)
  })

  it('gli importi con i centesimi restano coerenti', () => {
    const bal = computeBalances([spesa(10, 'a', ['a', 'l', 'm'])], [], [], CREW)
    expect(bal.a).toBeCloseTo(6.667, 3)
    expect(bal.l).toBeCloseTo(-3.333, 3)
    expect(totale(bal)).toBe(0)
  })
})
