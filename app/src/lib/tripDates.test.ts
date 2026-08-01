import { describe, expect, it } from 'vitest'
import { dayToDate, startOfDay, toIsoDate, tripDayNumbers } from './tripDates'

// Mesi 0-based come nel costruttore Date: 7 = agosto, 11 = dicembre.
const AGO = 7
const DIC = 11

describe('a quale mese appartiene il numero del giorno', () => {
  it('resta nel mese di partenza se il numero e maggiore o uguale', () => {
    const partenza = new Date(2026, AGO, 14)
    expect(toIsoDate(dayToDate(partenza, 14))).toBe('2026-08-14')
    expect(toIsoDate(dayToDate(partenza, 26))).toBe('2026-08-26')
  })

  it('passa al mese successivo se il numero e minore', () => {
    const partenza = new Date(2026, AGO, 28)
    expect(toIsoDate(dayToDate(partenza, 28))).toBe('2026-08-28')
    expect(toIsoDate(dayToDate(partenza, 31))).toBe('2026-08-31')
    // Qui stava il difetto: il 3 finiva salvato al 3 agosto.
    expect(toIsoDate(dayToDate(partenza, 3))).toBe('2026-09-03')
  })

  it('gestisce il cambio di anno', () => {
    const capodanno = new Date(2026, DIC, 28)
    expect(toIsoDate(dayToDate(capodanno, 31))).toBe('2026-12-31')
    expect(toIsoDate(dayToDate(capodanno, 1))).toBe('2027-01-01')
    expect(toIsoDate(dayToDate(capodanno, 4))).toBe('2027-01-04')
  })
})

describe('elenco dei giorni del viaggio', () => {
  it('dentro un solo mese', () => {
    expect(tripDayNumbers(new Date(2026, AGO, 14), new Date(2026, AGO, 18))).toEqual([14, 15, 16, 17, 18])
  })

  it('a cavallo di due mesi', () => {
    // Una semplice sequenza da 28 a 3 non produrrebbe nulla.
    expect(tripDayNumbers(new Date(2026, AGO, 28), new Date(2026, 8, 3))).toEqual([28, 29, 30, 31, 1, 2, 3])
  })

  it('a cavallo di due anni', () => {
    expect(tripDayNumbers(new Date(2026, DIC, 30), new Date(2027, 0, 2))).toEqual([30, 31, 1, 2])
  })

  it('viaggio di un solo giorno', () => {
    expect(tripDayNumbers(new Date(2026, AGO, 14), new Date(2026, AGO, 14))).toEqual([14])
  })

  it('date incoerenti dal database non mandano in blocco', () => {
    expect(tripDayNumbers(new Date(2026, AGO, 20), new Date(2026, AGO, 10))).toEqual([])
  })

  it('ignora l orario e conta i giorni interi', () => {
    const inizio = new Date(2026, AGO, 14, 23, 59)
    const fine = new Date(2026, AGO, 16, 0, 1)
    expect(tripDayNumbers(inizio, fine)).toEqual([14, 15, 16])
  })
})

describe('utilita di supporto', () => {
  it('toIsoDate mette lo zero davanti a mese e giorno', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('startOfDay azzera l orario', () => {
    const d = startOfDay(new Date(2026, AGO, 14, 18, 30, 45))
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    expect(toIsoDate(d)).toBe('2026-08-14')
  })
})
