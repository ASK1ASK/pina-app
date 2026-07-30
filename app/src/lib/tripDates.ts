// Nel modello dell'app un giorno del viaggio e' identificato dal numero del
// mese (14, 15, 26...), non da una data completa. Per capire a quale mese
// appartenga serve il giorno di partenza: se il numero e' piu' piccolo di
// quello di partenza, vuol dire che siamo passati al mese successivo.
//
// Senza questa conversione un viaggio che scavalca il cambio di mese
// (es. 28 agosto -> 3 settembre) si rompe in silenzio: le tappe di settembre
// verrebbero salvate ad agosto e la timeline di Today resterebbe vuota, perche'
// un ciclo da 28 a 3 non parte nemmeno.
//
// Limite noto: regge viaggi fino a ~28 giorni. Oltre, due giorni con lo stesso
// numero (il 5 del primo mese e il 5 del successivo) diventano indistinguibili
// e servirebbe passare a date vere in tutto il modello dati.

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** La data reale corrispondente a un "numero del giorno" dentro il viaggio. */
export function dayToDate(tripStart: Date, day: number): Date {
  const rollsOver = day < tripStart.getDate()
  // Il costruttore Date normalizza da solo il superamento di mese e anno
  // (mese 12 -> gennaio dell'anno dopo).
  return new Date(tripStart.getFullYear(), tripStart.getMonth() + (rollsOver ? 1 : 0), day)
}

/** I numeri dei giorni del viaggio in ordine cronologico (es. 28,29,30,31,1,2,3). */
export function tripDayNumbers(tripStart: Date, tripEnd: Date): number[] {
  const days: number[] = []
  const cursor = startOfDay(tripStart)
  const last = startOfDay(tripEnd)
  // Il tetto e' solo una rete di sicurezza contro date incoerenti in arrivo
  // dal database (fine prima dell'inizio, anni sbagliati).
  while (cursor.getTime() <= last.getTime() && days.length < 366) {
    days.push(cursor.getDate())
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

/** Formato ISO (YYYY-MM-DD) di una data, in ora locale. */
export function toIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}
