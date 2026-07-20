import { supabase } from '../../lib/supabase'
import type { Stop } from '../../lib/tripData'

export interface TripMeta {
  id: string
  name: string
  startDate: Date
  endDate: Date
  coverColorId: string
  coverPhotoUrl: string | null
  membersCount: number
}

export function isoDate(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

function formatStopDates(startDateStr: string, endDateStr: string): string {
  const start = new Date(startDateStr)
  const end = new Date(endDateStr)
  const startDay = start.getDate()
  const endDay = end.getDate()
  const monthLabel = end.toLocaleDateString('it-IT', { month: 'long' })
  return startDay === endDay ? `${startDay} ${monthLabel}` : `${startDay} → ${endDay} ${monthLabel}`
}

export async function fetchTripMeta(tripId: string): Promise<TripMeta | null> {
  const { data: trip, error } = await supabase.from('trips').select('*').eq('id', tripId).single()
  if (error || !trip) return null
  const { count } = await supabase.from('trip_members').select('*', { count: 'exact', head: true }).eq('trip_id', tripId)
  return {
    id: trip.id,
    name: trip.name,
    startDate: trip.start_date ? new Date(trip.start_date) : new Date(),
    endDate: trip.end_date ? new Date(trip.end_date) : new Date(),
    coverColorId: trip.cover_color_id,
    coverPhotoUrl: trip.cover_photo_url,
    membersCount: count ?? 1,
  }
}

export async function updateTripCover(tripId: string, patch: { coverColorId?: string; coverPhotoUrl?: string | null }) {
  await supabase
    .from('trips')
    .update({ cover_color_id: patch.coverColorId, cover_photo_url: patch.coverPhotoUrl })
    .eq('id', tripId)
}

export async function fetchStops(tripId: string): Promise<Stop[]> {
  const { data: dbStops } = await supabase.from('stops').select('*').eq('trip_id', tripId).order('position')
  if (!dbStops || dbStops.length === 0) return []

  const stopIds = dbStops.map((s) => s.id)
  const { data: dbCategories } = await supabase.from('stop_categories').select('*').in('stop_id', stopIds).order('position')
  const categories = dbCategories || []
  const catIds = categories.map((c) => c.id)

  const { data: dbItems } = catIds.length
    ? await supabase.from('stop_items').select('*').in('category_id', catIds).order('position')
    : { data: [] }
  const items = dbItems || []
  const itemIds = items.map((it) => it.id)

  const { data: dbChecklist } = itemIds.length
    ? await supabase.from('stop_item_checklist').select('*').in('item_id', itemIds).order('position')
    : { data: [] }
  const checklist = dbChecklist || []

  const { data: dbStays } = await supabase.from('stop_stays').select('*').in('stop_id', stopIds)
  const stays = dbStays || []

  return dbStops.map((s): Stop => ({
    id: s.id,
    name: s.name,
    startDay: new Date(s.start_date).getDate(),
    endDay: new Date(s.end_date).getDate(),
    moodId: s.mood_id,
    moodLine: s.mood_line,
    dates: formatStopDates(s.start_date, s.end_date),
    photo: s.photo_url ?? undefined,
    gradient: s.gradient ?? undefined,
    highlight: s.highlight,
    stays: stays
      .filter((st) => st.stop_id === s.id)
      .map((st) => ({
        id: st.id,
        name: st.name,
        link: st.link,
        day: st.night_date ? new Date(st.night_date).getDate() : undefined,
      })),
    categories: categories
      .filter((c) => c.stop_id === s.id)
      .map((c) => ({
        id: c.id,
        icon: c.icon,
        label: c.label,
        items: items
          .filter((it) => it.category_id === c.id)
          .map((it) => ({
            id: it.id,
            label: it.label,
            link: it.link,
            starred: it.starred,
            day: it.item_date ? new Date(it.item_date).getDate() : undefined,
            icon: it.icon ?? undefined,
            time: it.item_time ?? undefined,
            usefulLink: it.useful_link,
            booking: it.booking,
            notes: it.notes,
            checklist: checklist
              .filter((ch) => ch.item_id === it.id)
              .map((ch) => ({ id: ch.id, label: ch.label, done: ch.done })),
          })),
      })),
  }))
}

// Rispecchia il modello del prototipo (saveStops sovrascrive l'intero blob):
// per semplicità e correttezza, ogni salvataggio cancella e riscrive tutte le
// tappe del viaggio invece di calcolare un diff granulare.
export async function persistStops(tripId: string, stops: Stop[], refYear: number, refMonth: number): Promise<void> {
  await supabase.from('stops').delete().eq('trip_id', tripId)
  if (stops.length === 0) return

  const stopRows = stops.map((s, i) => ({
    trip_id: tripId,
    name: s.name,
    start_date: isoDate(refYear, refMonth, s.startDay),
    end_date: isoDate(refYear, refMonth, s.endDay || s.startDay),
    mood_id: s.moodId ?? '',
    mood_line: s.moodLine,
    photo_url: s.photo ?? null,
    gradient: s.gradient ?? null,
    highlight: !!s.highlight,
    position: i,
  }))
  const { data: insertedStops, error: stopsError } = await supabase.from('stops').insert(stopRows).select()
  if (stopsError || !insertedStops) throw stopsError

  const stayRows = stops.flatMap((s, i) =>
    (s.stays || []).map((stay) => ({
      stop_id: insertedStops[i].id,
      name: stay.name,
      link: stay.link,
      night_date: stay.day ? isoDate(refYear, refMonth, stay.day) : null,
    })),
  )
  if (stayRows.length) await supabase.from('stop_stays').insert(stayRows)

  const categoryPlan = stops.flatMap((s, i) =>
    (s.categories || []).map((cat, ci) => ({ stopDbId: insertedStops[i].id, icon: cat.icon, label: cat.label, position: ci, items: cat.items })),
  )
  if (!categoryPlan.length) return

  const { data: insertedCats, error: catError } = await supabase
    .from('stop_categories')
    .insert(categoryPlan.map(({ stopDbId, icon, label, position }) => ({ stop_id: stopDbId, icon, label, position })))
    .select()
  if (catError || !insertedCats) throw catError

  const itemPlan = categoryPlan.flatMap((cat, ci) =>
    cat.items.map((item, ii) => ({
      catDbId: insertedCats[ci].id,
      label: item.label,
      link: item.link || '',
      starred: !!item.starred,
      item_date: item.day ? isoDate(refYear, refMonth, item.day) : null,
      icon: item.icon ?? null,
      item_time: item.time ?? null,
      useful_link: item.usefulLink || '',
      booking: item.booking || '',
      notes: item.notes || '',
      position: ii,
      checklist: item.checklist || [],
    })),
  )
  if (!itemPlan.length) return

  const { data: insertedItems, error: itemError } = await supabase
    .from('stop_items')
    .insert(
      itemPlan.map(({ catDbId, label, link, starred, item_date, icon, item_time, useful_link, booking, notes, position }) => ({
        category_id: catDbId,
        label,
        link,
        starred,
        item_date,
        icon,
        item_time,
        useful_link,
        booking,
        notes,
        position,
      })),
    )
    .select()
  if (itemError || !insertedItems) throw itemError

  const checklistRows = itemPlan.flatMap((item, ii) =>
    item.checklist.map((c, ci) => ({ item_id: insertedItems[ii].id, label: c.label, done: !!c.done, position: ci })),
  )
  if (checklistRows.length) await supabase.from('stop_item_checklist').insert(checklistRows)
}
