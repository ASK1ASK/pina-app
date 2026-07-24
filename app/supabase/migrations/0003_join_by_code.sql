-- Piña — invito/join reale via codice (tabella `invites` già presente in 0001_init.sql).
--
-- Tre funzioni, stesso pattern di sicurezza di 0002 (security definer per bypassare
-- il classico problema "RLS mi blocca perché non sono ancora membro"):
--
-- 1. get_trip_preview_by_code: anteprima pubblica (nome/date/copertina/n. membri)
--    dato un codice invito. Deve essere leggibile anche da chi non è ancora membro
--    del viaggio (è tutto il punto di un invito) e anche da chi non ha ancora fatto
--    login — per questo è concessa anche ad `anon`, non solo `authenticated`.
-- 2. join_trip_by_code: unione reale al viaggio. Richiede un utente autenticato
--    (auth.uid()) e crea/riattiva la sua riga trip_members.
-- 3. get_or_create_trip_invite: genera (o riusa) il codice di un viaggio, solo per
--    l'organizzatore.

create or replace function get_trip_preview_by_code(p_code text)
returns table (
  trip_id uuid,
  name text,
  start_date date,
  end_date date,
  cover_color_id text,
  cover_photo_url text,
  members_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.name,
    t.start_date,
    t.end_date,
    t.cover_color_id,
    t.cover_photo_url,
    (select count(*) from trip_members m where m.trip_id = t.id and m.status = 'joined')
  from invites i
  join trips t on t.id = i.trip_id
  where i.code = upper(p_code);
$$;

grant execute on function get_trip_preview_by_code(text) to authenticated, anon;

create or replace function join_trip_by_code(p_code text, p_display_name text)
returns trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip trips;
  v_existing_member_id uuid;
begin
  select t.* into v_trip
  from invites i join trips t on t.id = i.trip_id
  where i.code = upper(p_code);

  if v_trip.id is null then
    raise exception 'Codice invito non valido.';
  end if;

  select id into v_existing_member_id
  from trip_members where trip_id = v_trip.id and user_id = auth.uid();

  if v_existing_member_id is not null then
    update trip_members set status = 'joined' where id = v_existing_member_id;
  else
    insert into trip_members (trip_id, user_id, display_name, role, status)
    values (v_trip.id, auth.uid(), coalesce(nullif(trim(p_display_name), ''), 'Viaggiatore'), 'member', 'joined');
  end if;

  return v_trip;
end;
$$;

grant execute on function join_trip_by_code(text, text) to authenticated;

create or replace function get_or_create_trip_invite(p_trip_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not is_trip_organizer(p_trip_id) then
    raise exception 'Solo l''organizzatore può generare un invito.';
  end if;

  select code into v_code from invites where trip_id = p_trip_id order by created_at limit 1;
  if v_code is not null then
    return v_code;
  end if;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    begin
      insert into invites (trip_id, code) values (p_trip_id, v_code);
      return v_code;
    exception when unique_violation then
      -- collisione di codice (rarissima con 36^6 combinazioni): riprova.
    end;
  end loop;
end;
$$;

grant execute on function get_or_create_trip_invite(uuid) to authenticated;
