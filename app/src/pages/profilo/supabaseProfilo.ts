import { supabase, unwrap, unwrapVoid } from '../../lib/supabase'
import type { EmergencyContact } from '../../lib/tripData'

export async function fetchEmergencyContacts(tripId: string): Promise<EmergencyContact[]> {
  const data = unwrap(await supabase.from('emergency_contacts').select('*').eq('trip_id', tripId).order('position'))
  return (data || []).map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle, href: c.href }))
}

// Stesso pattern "cancella e riscrivi tutto" usato per checklist/stops: lista
// piatta e corta, non vale la pena calcolare un diff.
export async function persistEmergencyContacts(tripId: string, contacts: EmergencyContact[]): Promise<void> {
  unwrapVoid(await supabase.from('emergency_contacts').delete().eq('trip_id', tripId))
  if (!contacts.length) return
  const rows = contacts.map((c, i) => ({ trip_id: tripId, title: c.title, subtitle: c.subtitle, href: c.href, position: i }))
  unwrapVoid(await supabase.from('emergency_contacts').insert(rows))
}

// Identità PER VIAGGIO (nome + colore mostrati alla crew in quel viaggio),
// diversa dal nome dell'account (profiles.display_name, usato solo come
// default quando entri in un viaggio nuovo).
export async function updateMemberIdentity(memberId: string, patch: { displayName?: string; color?: string }): Promise<void> {
  const payload: { display_name?: string; color?: string } = {}
  if (patch.displayName !== undefined) payload.display_name = patch.displayName
  if (patch.color !== undefined) payload.color = patch.color
  unwrapVoid(await supabase.from('trip_members').update(payload).eq('id', memberId))
}
