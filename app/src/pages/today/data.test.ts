import { describe, expect, it } from 'vitest'
import { hhmm, toMinutes } from './data'

// Le due sorgenti di un orario hanno forme diverse, ed e' li' che nasce il
// difetto: il campo `type="time"` del pannello scrive `10:30`, mentre la
// colonna `item_time` (tipo `time` di Postgres) risponde `10:30:00`.
describe('hhmm — un orario come lo scrive una persona', () => {
  it('toglie i secondi a quello che arriva dal database', () => {
    expect(hhmm('10:30:00')).toBe('10:30')
    expect(hhmm('09:00:00')).toBe('09:00')
    expect(hhmm('23:59:59')).toBe('23:59')
  })

  it('lascia stare quello che i secondi non ce li ha gia', () => {
    expect(hhmm('10:30')).toBe('10:30')
    expect(hhmm('08:00')).toBe('08:00')
  })

  it('senza orario non scrive niente, e non scrive "null"', () => {
    expect(hhmm(null)).toBe('')
    expect(hhmm(undefined)).toBe('')
    expect(hhmm('')).toBe('')
  })

  it('quello che non ha la forma di un orario torna intero', () => {
    // Meglio a schermo qualcosa di strano ma completo che un troncone.
    expect(hhmm('mezzogiorno')).toBe('mezzogiorno')
  })

  it("riporta l'orario alla forma delle scorciatoie dei pasti", () => {
    // Il pannello confronta l'orario della voce con quello della scorciatoia:
    // con i secondi il confronto non tornava mai e nessuna si evidenziava.
    expect(hhmm('10:30:00')).toBe('10:30')
    expect(hhmm('20:30:00')).toBe('20:30')
  })
})

describe("toMinutes — l'ordinamento non cambia", () => {
  it('conta gli stessi minuti con o senza secondi', () => {
    // E' il motivo per cui si formatta solo a schermo: l'ora piena resta
    // quella che si salva e quella su cui si ordina.
    expect(toMinutes('10:30:00')).toBe(toMinutes('10:30'))
    expect(toMinutes('10:30:00')).toBe(630)
  })

  it('mette in fila gli orari nel giusto ordine anche con i secondi', () => {
    const orari = ['20:30:00', '09:00:00', '13:00:00']
    const inOrdine = [...orari].sort((a, b) => (toMinutes(a) ?? 0) - (toMinutes(b) ?? 0))
    expect(inOrdine).toEqual(['09:00:00', '13:00:00', '20:30:00'])
  })

  it('senza orario non decide niente', () => {
    expect(toMinutes(null)).toBeNull()
    expect(toMinutes('')).toBeNull()
  })
})
