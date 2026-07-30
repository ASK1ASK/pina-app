import { moodDefs, moodGradients } from '../../lib/palette'
import { dayToDate, startOfDay } from '../../lib/tripDates'
import type { Stop, StopKind } from '../../lib/tripData'

export const stopMoodDefs = moodDefs.map((m) => ({
  id: m.id,
  label: m.label,
  gradient: moodGradients[m.id],
}))

export interface TripPhase {
  phase: 'pre' | 'active' | 'done'
  daysUntil?: number
  currentDay?: number
  totalDays: number
}

const MS_DAY = 86400000

export function computeTripPhase(start: Date, end: Date): TripPhase {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const s = new Date(start)
  s.setHours(0, 0, 0, 0)
  const e = new Date(end)
  e.setHours(0, 0, 0, 0)
  const totalDays = Math.round((e.getTime() - s.getTime()) / MS_DAY) + 1
  if (today < s) return { phase: 'pre', daysUntil: Math.round((s.getTime() - today.getTime()) / MS_DAY), totalDays }
  if (today > e) return { phase: 'done', totalDays, currentDay: totalDays }
  return { phase: 'active', currentDay: Math.round((today.getTime() - s.getTime()) / MS_DAY) + 1, totalDays }
}

export function computeStopKind(stop: Stop, isPre: boolean, tripStart: Date): StopKind {
  if (isPre) return 'future'
  if (stop.kind) return stop.kind
  const today = startOfDay(new Date())
  // dayToDate tiene conto dell'eventuale cambio di mese: altrimenti una tappa
  // di settembre verrebbe collocata ad agosto e non risulterebbe mai "oggi".
  const start = dayToDate(tripStart, stop.startDay || 1)
  const end = dayToDate(tripStart, stop.endDay || stop.startDay || 1)
  if (today.getTime() > end.getTime()) return 'done'
  if (today.getTime() >= start.getTime() && today.getTime() <= end.getTime()) return 'today'
  return 'future'
}

export function thingsSummary(stop: Stop): string {
  const cats = stop.categories || []
  const total = cats.reduce((n, c) => n + c.items.length, 0)
  const starred = cats.reduce((n, c) => n + c.items.filter((it) => it.starred).length, 0)
  return total === 0 ? '+ Aggiungi info sulla tappa' : `${starred}/${total} preferiti`
}
