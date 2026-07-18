import { moodDefs, moodGradients } from '../../lib/palette'
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

export function computeStopKind(stop: Stop, isPre: boolean, tripYear: number, tripMonth: number): StopKind {
  if (isPre) return 'future'
  if (stop.kind) return stop.kind
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(tripYear, tripMonth, stop.startDay || 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(tripYear, tripMonth, stop.endDay || stop.startDay || 1)
  end.setHours(0, 0, 0, 0)
  if (today > end) return 'done'
  if (today >= start && today <= end) return 'today'
  return 'future'
}

export function thingsSummary(stop: Stop): string {
  const cats = stop.categories || []
  const total = cats.reduce((n, c) => n + c.items.length, 0)
  const starred = cats.reduce((n, c) => n + c.items.filter((it) => it.starred).length, 0)
  return total === 0 ? '+ Aggiungi info sulla tappa' : `${starred}/${total} preferiti`
}
