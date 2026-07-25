import { supabase } from '../../lib/supabase'
import type { MemoryDay, MemoryItem } from '../../lib/tripData'

function formatDateLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

export async function fetchMemories(tripId: string): Promise<{ days: MemoryDay[]; items: MemoryItem[] }> {
  const { data: dayRows } = await supabase.from('memory_days').select('*').eq('trip_id', tripId).order('position')
  const dayIds = (dayRows || []).map((d) => d.id)

  const [{ data: itemRows }, { data: memberRows }] = await Promise.all([
    dayIds.length
      ? supabase.from('memories').select('*').in('day_id', dayIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as { id: string; day_id: string; url: string; is_video: boolean; is_favorite: boolean; caption: string; author_member_id: string | null }[] }),
    supabase.from('trip_members').select('id, display_name').eq('trip_id', tripId),
  ])

  const nameByMemberId: Record<string, string> = Object.fromEntries((memberRows || []).map((m) => [m.id, m.display_name]))
  const todayStr = new Date().toISOString().slice(0, 10)

  const days: MemoryDay[] = (dayRows || []).map((d) => ({
    id: d.id,
    label: d.label,
    dateLabel: formatDateLabel(d.memory_date),
    cover: d.cover_url || '',
    isToday: d.memory_date === todayStr,
  }))

  const items: MemoryItem[] = (itemRows || [])
    .filter((it): it is typeof it & { day_id: string } => it.day_id !== null)
    .map((it) => ({
    id: it.id,
    dayId: it.day_id,
    url: it.url,
    isVideo: it.is_video,
    isFavorite: it.is_favorite,
    caption: it.caption,
    author: it.author_member_id ? nameByMemberId[it.author_member_id] || 'Qualcuno' : 'Qualcuno',
  }))

  return { days, items }
}

// Il giorno "di oggi" viene creato la prima volta che serve (primo ricordo
// caricato in quella data), non in anticipo — un viaggio nasce senza giorni.
export async function getOrCreateTodayMemoryDay(tripId: string, label: string): Promise<string> {
  const todayStr = new Date().toISOString().slice(0, 10)
  const { data: existing } = await supabase
    .from('memory_days')
    .select('id')
    .eq('trip_id', tripId)
    .eq('memory_date', todayStr)
    .maybeSingle()
  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from('memory_days')
    .insert({ trip_id: tripId, label, memory_date: todayStr })
    .select()
    .single()
  if (error || !created) throw error ?? new Error('Errore durante la creazione del giorno.')
  return created.id
}

export async function createMemory(input: {
  tripId: string
  dayId: string
  url: string
  isVideo: boolean
  authorMemberId: string | null
  authorName: string
}): Promise<MemoryItem> {
  const { data, error } = await supabase
    .from('memories')
    .insert({
      trip_id: input.tripId,
      day_id: input.dayId,
      url: input.url,
      is_video: input.isVideo,
      author_member_id: input.authorMemberId,
      caption: 'Nuovo ricordo',
    })
    .select()
    .single()
  if (error || !data) throw error ?? new Error('Errore durante il salvataggio del ricordo.')
  return {
    id: data.id,
    dayId: input.dayId,
    url: data.url,
    isVideo: data.is_video,
    isFavorite: data.is_favorite,
    caption: data.caption,
    author: input.authorName,
  }
}

export async function toggleMemoryFavorite(id: string, isFavorite: boolean): Promise<void> {
  await supabase.from('memories').update({ is_favorite: isFavorite }).eq('id', id)
}

export async function updateMemoryCaption(id: string, caption: string): Promise<void> {
  await supabase.from('memories').update({ caption }).eq('id', id)
}
