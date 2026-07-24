import { useEffect, useRef, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface PresenceMember {
  userId: string
  name: string
  onlineAt: string
}

type ChangeHandler = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void

interface TripRealtimeOptions {
  userId: string | null
  displayName: string
  onTripChange?: ChangeHandler
  onMembersChange?: ChangeHandler
}

// Un canale per viaggio: aggiornamenti live su trips/trip_members + presence
// ("chi è online ora"). Pensato per essere esteso con altre tabelle trip-scoped
// (checklist, spese, ...) quando verranno migrate da localStorage — basta
// aggiungere altri `.on('postgres_changes', ...)` con lo stesso filtro trip_id.
export function useTripRealtime(tripId: string | null, options: TripRealtimeOptions) {
  const [online, setOnline] = useState<PresenceMember[]>([])
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    if (!tripId || !options.userId) {
      setOnline([])
      return
    }

    const channel = supabase.channel(`trip:${tripId}`, {
      config: { presence: { key: options.userId } },
    })

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` },
        (payload) => optionsRef.current.onTripChange?.(payload),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_members', filter: `trip_id=eq.${tripId}` },
        (payload) => optionsRef.current.onMembersChange?.(payload),
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ name: string; online_at: string }>()
        setOnline(
          Object.entries(state).map(([userId, presences]) => ({
            userId,
            name: presences[0]?.name || 'Viaggiatore',
            onlineAt: presences[0]?.online_at || '',
          })),
        )
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name: optionsRef.current.displayName, online_at: new Date().toISOString() })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, options.userId])

  return { online }
}
