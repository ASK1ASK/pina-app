import { supabase } from '../../lib/supabase'

export interface RealChecklistItem {
  id: string
  label: string
  done: boolean
  assignee?: string
}
export interface RealChecklistCategory {
  id: string
  emoji: string
  name: string
  items: RealChecklistItem[]
}

export async function fetchChecklist(tripId: string): Promise<RealChecklistCategory[]> {
  const { data: cats } = await supabase.from('checklist_categories').select('*').eq('trip_id', tripId).order('position')
  const catIds = (cats || []).map((c) => c.id)
  const { data: items } = catIds.length
    ? await supabase.from('checklist_items').select('*').in('category_id', catIds).order('position')
    : { data: [] as { id: string; category_id: string; label: string; done: boolean; assignee_member_id: string | null }[] }

  return (cats || []).map((c) => ({
    id: c.id,
    emoji: c.emoji,
    name: c.name,
    items: (items || [])
      .filter((it) => it.category_id === c.id)
      .map((it) => ({ id: it.id, label: it.label, done: it.done, assignee: it.assignee_member_id || undefined })),
  }))
}

// Stesso pattern "cancella e riscrivi tutto" già usato per persistStops in
// journey/supabaseJourney.ts: più semplice e corretto che calcolare un diff.
export async function persistChecklist(tripId: string, categories: RealChecklistCategory[]): Promise<void> {
  await supabase.from('checklist_categories').delete().eq('trip_id', tripId)
  if (!categories.length) return

  const catRows = categories.map((c, i) => ({ trip_id: tripId, emoji: c.emoji, name: c.name, position: i }))
  const { data: insertedCats, error } = await supabase.from('checklist_categories').insert(catRows).select()
  if (error || !insertedCats) throw error

  const itemRows = categories.flatMap((c, ci) =>
    c.items.map((it, ii) => ({
      category_id: insertedCats[ci].id,
      label: it.label,
      done: it.done,
      assignee_member_id: it.assignee || null,
      position: ii,
    })),
  )
  if (itemRows.length) await supabase.from('checklist_items').insert(itemRows)
}
