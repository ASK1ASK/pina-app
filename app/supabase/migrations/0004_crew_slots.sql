-- Piña — chi riceve l'invito "diventa" uno dei nomi già in lista invece di
-- creare sempre un membro duplicato (bug del flusso precedente: join_trip_by_code
-- creava sempre una riga nuova, lasciando orfano il posto placeholder che
-- l'organizzatore aveva già inserito in fase di creazione).

-- Posti ancora liberi (nome messo dall'organizzatore, nessun utente reale
-- collegato) per il viaggio dietro un dato codice invito. Leggibile anche da
-- chi non è ancora membro/non ha ancora fatto login — è la lista tra cui
-- scegliere "chi sei" prima di entrare.
create or replace function get_unclaimed_crew_slots(p_code text)
returns table (member_id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.display_name
  from invites i
  join trip_members m on m.trip_id = i.trip_id
  where i.code = upper(p_code) and m.user_id is null and m.status = 'invited'
  order by m.created_at;
$$;

grant execute on function get_unclaimed_crew_slots(text) to authenticated, anon;

-- Rivendica un posto placeholder esistente invece di inserirne uno nuovo.
create or replace function join_trip_claim_slot(p_code text, p_member_id uuid, p_display_name text, p_color text)
returns trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip trips;
  v_slot trip_members;
begin
  select t.* into v_trip from invites i join trips t on t.id = i.trip_id where i.code = upper(p_code);
  if v_trip.id is null then
    raise exception 'Codice invito non valido.';
  end if;

  select * into v_slot from trip_members where id = p_member_id and trip_id = v_trip.id and user_id is null;
  if v_slot.id is null then
    raise exception 'Questo posto non è più disponibile.';
  end if;

  update trip_members
  set user_id = auth.uid(),
      display_name = coalesce(nullif(trim(p_display_name), ''), v_slot.display_name),
      color = coalesce(nullif(p_color, ''), v_slot.color),
      status = 'joined'
  where id = p_member_id;

  return v_trip;
end;
$$;

grant execute on function join_trip_claim_slot(text, uuid, text, text) to authenticated;
