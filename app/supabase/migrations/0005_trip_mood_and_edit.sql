-- Piña — i mood scelti in fase di creazione non sono mai stati salvati da
-- nessuna parte (nemmeno alla creazione): li aggiungiamo alla tabella trips
-- e li facciamo passare attraverso create_trip_with_members, cosi' diventano
-- anche modificabili dall'organizzatore in seguito.

alter table trips add column if not exists mood_ids text[] not null default '{}';

-- La firma della funzione cambia (nuovo parametro): va ricreata da zero,
-- "create or replace" da solo non basta quando cambiano gli argomenti.
drop function if exists create_trip_with_members(text, date, date, text, text, text[]);

create or replace function create_trip_with_members(
  p_name text,
  p_start_date date,
  p_end_date date,
  p_cover_color_id text,
  p_organizer_display_name text,
  p_participant_names text[] default '{}',
  p_mood_ids text[] default '{}'
) returns trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip trips;
begin
  insert into trips (name, start_date, end_date, cover_color_id, mood_ids, created_by)
  values (p_name, p_start_date, p_end_date, p_cover_color_id, p_mood_ids, auth.uid())
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

grant execute on function create_trip_with_members(text, date, date, text, text, text[], text[]) to authenticated;

-- Nota: l'aggiornamento di un viaggio esistente (nome/date/copertina/mood)
-- e la rimozione di un membro non hanno bisogno di una funzione dedicata:
-- le policy "trips: organizer can update"/"trips: organizer can delete" e
-- "trip_members: organizer can manage" (0001_init.sql) già permettono
-- all'organizzatore di farlo con un update/delete diretto dal client.
