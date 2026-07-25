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

export interface RealEssentialsEntry {
  id: string
  title: string
  subtitle: string
  tag: string
  href: string
  attachment?: string | null
}
export interface RealEssentialsCategory {
  id: string
  emoji: string
  name: string
  gradient: string
  entries: RealEssentialsEntry[]
}

const ESSENTIALS_SHELLS = [
  { emoji: '🪪', name: 'Documenti', gradient: 'linear-gradient(135deg,#ff8a5b,#d9481f)' },
  { emoji: '🏕', name: 'Alloggi', gradient: 'linear-gradient(135deg,#ffb627,#d9481f)' },
  { emoji: '🚐', name: 'Trasporti', gradient: 'linear-gradient(135deg,#8fbf6b,#4f7a3a)' },
  { emoji: '🎟', name: 'Prenotazioni', gradient: 'linear-gradient(135deg,#ffb627,#ff5f6d)' },
]

export async function fetchEssentials(tripId: string): Promise<RealEssentialsCategory[]> {
  const { data: cats } = await supabase.from('essentials_categories').select('*').eq('trip_id', tripId).order('position')
  const catIds = (cats || []).map((c) => c.id)
  const { data: entries } = catIds.length
    ? await supabase.from('essentials_entries').select('*').in('category_id', catIds).order('position')
    : { data: [] as { id: string; category_id: string; title: string; subtitle: string; tag: string; href: string; attachment_url: string | null }[] }

  return (cats || []).map((c) => ({
    id: c.id,
    emoji: c.emoji,
    name: c.name,
    gradient: c.gradient || '',
    entries: (entries || [])
      .filter((e) => e.category_id === c.id)
      .map((e) => ({ id: e.id, title: e.title, subtitle: e.subtitle, tag: e.tag, href: e.href, attachment: e.attachment_url })),
  }))
}

// I 4 raggruppamenti (Documenti/Alloggi/Trasporti/Prenotazioni) si creano una
// volta sola, vuoti, alla prima visita di un viaggio vero: danno una
// struttura pronta da riempire invece di un'area senza nemmeno un modo per
// aggiungere qualcosa.
export async function seedEssentials(tripId: string): Promise<RealEssentialsCategory[]> {
  const { data, error } = await supabase
    .from('essentials_categories')
    .insert(ESSENTIALS_SHELLS.map((s, i) => ({ trip_id: tripId, emoji: s.emoji, name: s.name, gradient: s.gradient, position: i })))
    .select()
  if (error || !data) throw error ?? new Error('Errore creazione essentials.')
  return data.map((c) => ({ id: c.id, emoji: c.emoji, name: c.name, gradient: c.gradient || '', entries: [] }))
}

export async function persistEssentials(tripId: string, categories: RealEssentialsCategory[]): Promise<void> {
  await supabase.from('essentials_categories').delete().eq('trip_id', tripId)
  if (!categories.length) return

  const catRows = categories.map((c, i) => ({ trip_id: tripId, emoji: c.emoji, name: c.name, gradient: c.gradient, position: i }))
  const { data: insertedCats, error } = await supabase.from('essentials_categories').insert(catRows).select()
  if (error || !insertedCats) throw error

  const entryRows = categories.flatMap((c, ci) =>
    c.entries.map((e, ei) => ({
      category_id: insertedCats[ci].id,
      title: e.title,
      subtitle: e.subtitle,
      tag: e.tag,
      href: e.href,
      attachment_url: e.attachment || null,
      position: ei,
    })),
  )
  if (entryRows.length) await supabase.from('essentials_entries').insert(entryRows)
}

export async function fetchPersonalSections(tripId: string, memberId: string): Promise<RealChecklistCategory[]> {
  const { data: sections } = await supabase
    .from('personal_checklist_sections')
    .select('*')
    .eq('trip_id', tripId)
    .eq('member_id', memberId)
    .order('position')
  const sectionIds = (sections || []).map((s) => s.id)
  const { data: items } = sectionIds.length
    ? await supabase.from('personal_checklist_items').select('*').in('section_id', sectionIds).order('position')
    : { data: [] as { id: string; section_id: string; label: string; done: boolean }[] }

  return (sections || []).map((s) => ({
    id: s.id,
    emoji: s.emoji,
    name: s.name,
    items: (items || []).filter((it) => it.section_id === s.id).map((it) => ({ id: it.id, label: it.label, done: it.done })),
  }))
}

export async function persistPersonalSections(tripId: string, memberId: string, sections: RealChecklistCategory[]): Promise<void> {
  await supabase.from('personal_checklist_sections').delete().eq('trip_id', tripId).eq('member_id', memberId)
  if (!sections.length) return

  const secRows = sections.map((s, i) => ({ trip_id: tripId, member_id: memberId, emoji: s.emoji, name: s.name, position: i }))
  const { data: insertedSecs, error } = await supabase.from('personal_checklist_sections').insert(secRows).select()
  if (error || !insertedSecs) throw error

  const itemRows = sections.flatMap((s, si) =>
    s.items.map((it, ii) => ({ section_id: insertedSecs[si].id, label: it.label, done: it.done, position: ii })),
  )
  if (itemRows.length) await supabase.from('personal_checklist_items').insert(itemRows)
}
