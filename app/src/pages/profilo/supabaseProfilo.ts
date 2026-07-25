import { supabase } from '../../lib/supabase'
import type { EmergencyContact } from '../../lib/tripData'

export async function fetchEmergencyContacts(tripId: string): Promise<EmergencyContact[]> {
  const { data } = await supabase.from('emergency_contacts').select('*').eq('trip_id', tripId).order('position')
  return (data || []).map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle, href: c.href }))
}

// Stesso pattern "cancella e riscrivi tutto" usato per checklist/stops: lista
// piatta e corta, non vale la pena calcolare un diff.
export async function persistEmergencyContacts(tripId: string, contacts: EmergencyContact[]): Promise<void> {
  await supabase.from('emergency_contacts').delete().eq('trip_id', tripId)
  if (!contacts.length) return
  const rows = contacts.map((c, i) => ({ trip_id: tripId, title: c.title, subtitle: c.subtitle, href: c.href, position: i }))
  await supabase.from('emergency_contacts').insert(rows)
}

export async function fetchProfileName(userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle()
  return data?.display_name?.trim() || 'Viaggiatore'
}

export async function updateProfileName(userId: string, name: string): Promise<void> {
  await supabase.from('profiles').update({ display_name: name }).eq('id', userId)
}
