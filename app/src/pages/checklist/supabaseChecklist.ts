import { supabase, unwrap, unwrapVoid } from '../../lib/supabase'

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
  const cats = unwrap(await supabase.from('checklist_categories').select('*').eq('trip_id', tripId).order('position'))
  const catIds = (cats || []).map((c) => c.id)
  const items = catIds.length
    ? unwrap(await supabase.from('checklist_items').select('*').in('category_id', catIds).order('position'))
    : ([] as { id: string; category_id: string; label: string; done: boolean; assignee_member_id: string | null }[])

  return (cats || []).map((c) => ({
    id: c.id,
    emoji: c.emoji,
    name: c.name,
    items: (items || [])
      .filter((it) => it.category_id === c.id)
      .map((it) => ({ id: it.id, label: it.label, done: it.done, assignee: it.assignee_member_id || undefined })),
  }))
}

// ---------------------------------------------------------------------------
// Operazioni mirate sulla checklist condivisa.
//
// La checklist e' l'unica lista che piu' persone modificano davvero insieme.
// Riscrivere l'intera lista ad ogni tocco significava che, se due membri
// agivano a pochi istanti di distanza, il salvataggio del secondo cancellava
// la voce appena aggiunta dal primo, senza che nessuno se ne accorgesse.
// Toccando una riga sola, due persone che lavorano su voci diverse non si
// pestano i piedi; sulla stessa voce vince l'ultimo, che e' quello che uno
// si aspetta.
// ---------------------------------------------------------------------------

export async function createChecklistCategory(
  tripId: string,
  input: { emoji: string; name: string; position: number },
): Promise<string> {
  const { data, error } = await supabase
    .from('checklist_categories')
    .insert({ trip_id: tripId, emoji: input.emoji, name: input.name, position: input.position })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('Errore durante la creazione della sezione.')
  return data.id
}

export async function updateChecklistCategory(categoryId: string, patch: { emoji?: string; name?: string }): Promise<void> {
  unwrapVoid(await supabase.from('checklist_categories').update(patch).eq('id', categoryId))
}

export async function createChecklistItem(
  categoryId: string,
  input: { label: string; done: boolean; assignee?: string; position: number },
): Promise<string> {
  const { data, error } = await supabase
    .from('checklist_items')
    .insert({
      category_id: categoryId,
      label: input.label,
      done: input.done,
      assignee_member_id: input.assignee || null,
      position: input.position,
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('Errore durante la creazione della voce.')
  return data.id
}

export async function updateChecklistItem(
  itemId: string,
  patch: { label?: string; done?: boolean; assignee?: string | null },
): Promise<void> {
  const payload: { label?: string; done?: boolean; assignee_member_id?: string | null } = {}
  if (patch.label !== undefined) payload.label = patch.label
  if (patch.done !== undefined) payload.done = patch.done
  if (patch.assignee !== undefined) payload.assignee_member_id = patch.assignee
  unwrapVoid(await supabase.from('checklist_items').update(payload).eq('id', itemId))
}

export async function deleteChecklistItem(itemId: string): Promise<void> {
  unwrapVoid(await supabase.from('checklist_items').delete().eq('id', itemId))
}

// Nota: qui esisteva persistChecklist, che ad ogni modifica cancellava e
// riscriveva l'intera checklist del viaggio. E' stata rimossa perche' era la
// causa della perdita silenziosa di dati quando due membri modificavano
// insieme: ora si usano le operazioni mirate qui sopra.

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
  const cats = unwrap(await supabase.from('essentials_categories').select('*').eq('trip_id', tripId).order('position'))
  const catIds = (cats || []).map((c) => c.id)
  const entries = catIds.length
    ? unwrap(await supabase.from('essentials_entries').select('*').in('category_id', catIds).order('position'))
    : ([] as { id: string; category_id: string; title: string; subtitle: string; tag: string; href: string; attachment_url: string | null }[])

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

// ---------------------------------------------------------------------------
// Operazioni mirate sugli Essentials.
//
// Qui esisteva persistEssentials, che ad ogni salvataggio cancellava tutte le
// categorie del viaggio e le riscriveva da zero. Con la cancellazione a
// cascata su essentials_entries, questo voleva dire che **ogni identificativo
// cambiava ad ogni tocco**: categorie e voci.
//
// Era la causa del COLLAUDO #31, "allegare non riesce proprio": il caricamento
// di un file dura qualche secondo, e in quei secondi il telefono che salva
// sente la propria stessa modifica arrivare dal canale live, si rilegge tutto,
// e il pulsante che stava caricando punta a una voce che non esiste piu'. Il
// sintomo visibile era il pannello che si chiudeva da solo dopo ogni
// salvataggio, perche' cercava una categoria con un identificativo morto.
//
// Le quattro categorie, per giunta, non sono mai modificabili: nascono da
// seedEssentials e da li' non cambiano. Venivano distrutte e ricostruite per
// niente.
//
// Stessa medicina gia' applicata alla checklist condivisa il 01/08, e per lo
// stesso motivo: si tocca la riga che l'utente ha toccato, e basta.
// ---------------------------------------------------------------------------

export async function createEssentialsEntry(
  categoryId: string,
  input: { title: string; subtitle: string; tag: string; href: string; position: number },
): Promise<string> {
  const { data, error } = await supabase
    .from('essentials_entries')
    .insert({
      category_id: categoryId,
      title: input.title,
      subtitle: input.subtitle,
      tag: input.tag,
      href: input.href,
      position: input.position,
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('Errore durante la creazione della voce.')
  return data.id
}

export async function updateEssentialsEntry(
  entryId: string,
  patch: { title?: string; subtitle?: string; tag?: string; href?: string; attachment?: string | null },
): Promise<void> {
  const payload: { title?: string; subtitle?: string; tag?: string; href?: string; attachment_url?: string | null } = {}
  if (patch.title !== undefined) payload.title = patch.title
  if (patch.subtitle !== undefined) payload.subtitle = patch.subtitle
  if (patch.tag !== undefined) payload.tag = patch.tag
  if (patch.href !== undefined) payload.href = patch.href
  // `attachment` distingue "non lo tocco" (undefined) da "toglilo" (null): con
  // un solo valore non si potrebbe piu' rimuovere un allegato.
  if (patch.attachment !== undefined) payload.attachment_url = patch.attachment
  unwrapVoid(await supabase.from('essentials_entries').update(payload).eq('id', entryId))
}

export async function deleteEssentialsEntry(entryId: string): Promise<void> {
  unwrapVoid(await supabase.from('essentials_entries').delete().eq('id', entryId))
}

export async function fetchPersonalSections(tripId: string, memberId: string): Promise<RealChecklistCategory[]> {
  const sections = unwrap(
    await supabase
      .from('personal_checklist_sections')
      .select('*')
      .eq('trip_id', tripId)
      .eq('member_id', memberId)
      .order('position'),
  )
  const sectionIds = (sections || []).map((s) => s.id)
  const items = sectionIds.length
    ? unwrap(await supabase.from('personal_checklist_items').select('*').in('section_id', sectionIds).order('position'))
    : ([] as { id: string; section_id: string; label: string; done: boolean }[])

  return (sections || []).map((s) => ({
    id: s.id,
    emoji: s.emoji,
    name: s.name,
    items: (items || []).filter((it) => it.section_id === s.id).map((it) => ({ id: it.id, label: it.label, done: it.done })),
  }))
}

// ---------------------------------------------------------------------------
// Operazioni mirate sulla valigia personale.
//
// Qui esisteva persistPersonalSections, che ad ogni salvataggio cancellava
// tutte le sezioni di quel membro e le riscriveva da capo. Era l'ultimo posto
// rimasto col metodo che il cantiere F ha tolto dagli Essentials (#31), e ha
// fatto lo stesso danno: COLLAUDO #34.
//
// Perche' duplicava, visto che la valigia e' di una persona sola e nessun altro
// la tocca. Perche' non serve un secondo telefono: bastano due salvataggi dello
// stesso telefono che si accavallano. Cancellare e riscrivere non sono una
// operazione sola, sono due, e in mezzo c'e' la rete. Se il secondo salvataggio
// cancella prima che il primo abbia inserito, l'ordine diventa
// cancella-cancella-inserisci-inserisci: una cancellazione sola, due
// inserimenti, e la sezione compare due volte identica.
//
// Ed e' anche il motivo per cui i doppioni cancellati a mano tornavano: chi
// salva riscrive la fotografia della lista che aveva in mano quando e' partito,
// quindi un salvataggio piu' vecchio che arriva dopo rimette dentro quello che
// era appena stato tolto. Difetto e irreparabilita' hanno la stessa causa.
//
// Stessa medicina della checklist condivisa (01/08) e degli Essentials (07/08):
// si tocca la riga che l'utente ha toccato, e basta. Il test qui accanto tiene
// una copia del metodo vecchio e riproduce entrambi i sintomi, cosi' la
// differenza fra i due modi resta dimostrata e non affidata alla memoria.
// ---------------------------------------------------------------------------

export async function createPersonalSection(
  tripId: string,
  memberId: string,
  input: { emoji: string; name: string; position: number },
): Promise<string> {
  const { data, error } = await supabase
    .from('personal_checklist_sections')
    .insert({ trip_id: tripId, member_id: memberId, emoji: input.emoji, name: input.name, position: input.position })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('Errore durante la creazione della sezione.')
  return data.id
}

export async function updatePersonalSection(sectionId: string, patch: { emoji?: string; name?: string }): Promise<void> {
  unwrapVoid(await supabase.from('personal_checklist_sections').update(patch).eq('id', sectionId))
}

export async function createPersonalItem(
  sectionId: string,
  input: { label: string; done: boolean; position: number },
): Promise<string> {
  const { data, error } = await supabase
    .from('personal_checklist_items')
    .insert({ section_id: sectionId, label: input.label, done: input.done, position: input.position })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('Errore durante la creazione della voce.')
  return data.id
}

export async function updatePersonalItem(itemId: string, patch: { label?: string; done?: boolean }): Promise<void> {
  unwrapVoid(await supabase.from('personal_checklist_items').update(patch).eq('id', itemId))
}

export async function deletePersonalItem(itemId: string): Promise<void> {
  unwrapVoid(await supabase.from('personal_checklist_items').delete().eq('id', itemId))
}
