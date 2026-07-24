-- Piña — sblocco RLS sulla creazione viaggio.
--
-- Causa del bug "new row violates row-level security policy for table trips":
-- la policy "trips: members can read" (0001_init.sql) usa is_trip_member(id), che
-- controlla trip_members. Il client creava prima la riga in trips e SOLO DOPO,
-- con una seconda richiesta separata, la riga in trip_members per l'organizzatore.
-- Nell'istante fra le due richieste l'utente non è ancora membro del viaggio che ha
-- appena creato: la RETURNING/SELECT implicita dopo l'insert (richiesta da
-- supabase-js) non trova un membro valido e Postgres rifiuta con lo stesso errore
-- 42501 usato per le violazioni WITH CHECK — da qui la falsa pista "la policy è
-- sbagliata" (la policy in sé è sempre stata corretta, l'ordine delle operazioni no).
--
-- Fix: una funzione security definer che crea viaggio + membership organizzatore
-- (+ eventuali partecipanti) in un'unica transazione, bypassando RLS per le proprie
-- scritture (gira con i privilegi del proprietario della funzione). Applicare nel
-- SQL Editor di Supabase dopo 0001_init.sql.

create or replace function create_trip_with_members(
  p_name text,
  p_start_date date,
  p_end_date date,
  p_cover_color_id text,
  p_organizer_display_name text,
  p_participant_names text[] default '{}'
) returns trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip trips;
begin
  insert into trips (name, start_date, end_date, cover_color_id, created_by)
  values (p_name, p_start_date, p_end_date, p_cover_color_id, auth.uid())
  returning * into v_trip;

  insert into trip_members (trip_id, user_id, display_name, role, status)
  values (v_trip.id, auth.uid(), coalesce(nullif(trim(p_organizer_display_name), ''), 'Organizzatore'), 'organizer', 'joined');

  if p_participant_names is not null and array_length(p_participant_names, 1) > 0 then
    insert into trip_members (trip_id, display_name, role, status)
    select v_trip.id, name, 'member', 'invited'
    from unnest(p_participant_names) as name
    where trim(name) <> '';
  end if;

  return v_trip;
end;
$$;

grant execute on function create_trip_with_members(text, date, date, text, text, text[]) to authenticated;

-- Gli insert diretti su trips non passano più dal client: solo dalla funzione
-- qui sopra, che li fa come proprietario della funzione (bypassa RLS). La vecchia
-- policy "trips: authenticated users can create" resta innocua ma inutile.
revoke insert on trips from authenticated;

-- Fase 2 — abilita la replicazione realtime per viaggio+membri (presence/live update).
-- Riusabile in futuro: quando altre tabelle trip-scoped verranno migrate da
-- localStorage, si aggiungono qui con lo stesso `alter publication ... add table`.
alter publication supabase_realtime add table trips, trip_members;
