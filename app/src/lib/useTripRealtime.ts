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

// Sync generico per tabelle trip-scoped (spese, checklist, essentials,
// memories, ...): non fa diff riga-per-riga, chiama `onChange` (debounced)
// quando una delle tabelle cambia così la schermata puo' rifare il fetch.
// `tables` e `nestedTables` vanno passati come array stabili (costanti di
// modulo), perche' sono nelle dipendenze dell'effetto.
//
// `nestedTables` sono le tabelle figlie che NON hanno una colonna trip_id (per
// esempio checklist_items, legata al viaggio solo tramite category_id): non
// potendo filtrare per viaggio si ascolta la tabella intera. Non e' un
// problema di riservatezza, perche' le regole di sicurezza a livello di riga
// consegnano solo le righe che l'utente puo' gia' vedere; al massimo si fa
// qualche ricarica in piu' se si e' dentro a piu' viaggi contemporaneamente.
// Costante di modulo e non `= []` in firma: un array creato ad ogni chiamata
// cambierebbe identita' a ogni render e farebbe smontare e ricreare il canale
// realtime in continuazione per chi non passa tabelle figlie.
const NESSUNA_TABELLA_FIGLIA: string[] = []

export function useTripTableSync(
  tripId: string | null,
  tables: string[],
  onChange: () => void,
  nestedTables: string[] = NESSUNA_TABELLA_FIGLIA,
) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!tripId || (tables.length === 0 && nestedTables.length === 0)) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefetch = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => onChangeRef.current(), 400)
    }

    const channel = supabase.channel(`trip-sync:${tripId}:${[...tables, ...nestedTables].join(',')}`)
    tables.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `trip_id=eq.${tripId}` },
        scheduleRefetch,
      )
    })
    nestedTables.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefetch)
    })
    channel.subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, tables, nestedTables])
}
