-- Piña — uscire davvero da un viaggio, e colori dell'identità distinti da subito.
--
-- Due cose che viaggiano insieme perché toccano la stessa tabella:
--
-- 1. "Esci dal viaggio" finora cambiava solo stato React: bastava ricaricare la
--    pagina per essere di nuovo dentro. Qui diventa vero.
-- 2. Alla creazione del viaggio i partecipanti nascevano tutti con il colore di
--    default della tabella ('#ff8a5b'): una crew appena creata era una fila di
--    cerchi coral identici, e il colore — che dovrebbe dire chi sei — non
--    distingueva nessuno.
--
-- Ripetibile: si può rilanciare senza rompere niente. Verifica in fondo.

-- ===========================================================================
-- 1. Chi esce dal viaggio
-- ===========================================================================
--
-- Perché una colonna e non un valore nuovo dell'enum trip_member_status:
-- in Postgres un valore aggiunto con ALTER TYPE ... ADD VALUE non è utilizzabile
-- nella stessa transazione che lo crea, quindi servirebbero due migrazioni
-- separate. Un timestamptz non ha quel problema e in più dice QUANDO è uscito.

alter table trip_members add column if not exists left_at timestamptz;

comment on column trip_members.left_at is
  'Quando la persona ha lasciato il viaggio, o ne è stata rimossa. La riga non va MAI cancellata: expenses.paid_by_member_id, expense_splits, settlements e cassa_contributions ci puntano, e cancellarla azzererebbe o romperebbe i saldi di tutta la crew.';

-- ===========================================================================
-- 2. La tavolozza delle identità
-- ===========================================================================
--
-- Gli stessi dieci colori di identityColorDefs in app/src/lib/palette.ts:
-- se cambi qui, cambia anche là.
--
-- L'ordine non è casuale. L'iniziale dentro il tondo è scritta in bianco, e su
-- alcuni di questi colori il bianco si legge male (il giallo e il turchese
-- stanno intorno a 1,8:1). I cinque più scuri stanno davanti, così una crew
-- normale da quattro o cinque persone pesca solo quelli leggibili, e i deboli
-- escono soltanto sui gruppi grandi.

create or replace function pina_identity_colors()
returns text[]
language sql
immutable
as $$
  select array[
    '#d9481f',  -- terracotta
    '#2d6a4f',  -- verde scuro
    '#8a2f42',  -- vinaccia
    '#2a8fd8',  -- blu
    '#b8792e',  -- bronzo
    '#ff5f96',  -- rosa
    '#7a9d54',  -- verde
    '#ff8a5b',  -- coral
    '#3ddbc5',  -- turchese
    '#ffb627'   -- giallo
  ];
$$;

-- ===========================================================================
-- 3. Creazione viaggio — colori assegnati fin da subito
-- ===========================================================================
--
-- La regola dell'identità non cambia (decisione del 26/07: nome e colore sono
-- PER VIAGGIO, scelti nella crew). Cambia solo il punto di partenza: non più
-- "tutti coral" ma dieci colori a rotazione, che ognuno resta libero di
-- cambiare dal proprio Profilo o entrando nella crew.
--
-- ⚠️ La firma da riscrivere è quella a SETTE argomenti della 0005, quella con
-- p_mood_ids: è l'unica che il client chiama. Ridefinendo per sbaglio la
-- vecchia a sei della 0002 si creerebbe una seconda funzione con lo stesso
-- nome, lasciando intatta quella davvero in uso — i colori non verrebbero mai
-- assegnati e non comparirebbe alcun errore da nessuna parte.
--
-- La riga qui sotto toglie di mezzo la vecchia a sei argomenti se un ambiente
-- fosse rimasto fermo alla 0002: senza, resterebbero due funzioni omonime e
-- Postgres non saprebbe quale scegliere.
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
  v_colori text[] := pina_identity_colors();
  v_quanti int := array_length(v_colori, 1);
begin
  insert into trips (name, start_date, end_date, cover_color_id, mood_ids, created_by)
  values (p_name, p_start_date, p_end_date, p_cover_color_id, p_mood_ids, auth.uid())
  returning * into v_trip;

  -- L'organizzatore prende il primo colore, i partecipanti i successivi.
  insert into trip_members (trip_id, user_id, display_name, color, role, status)
  values (
    v_trip.id,
    auth.uid(),
    coalesce(nullif(trim(p_organizer_display_name), ''), 'Organizzatore'),
    v_colori[1],
    'organizer',
    'joined'
  );

  if p_participant_names is not null and array_length(p_participant_names, 1) > 0 then
    insert into trip_members (trip_id, display_name, color, role, status)
    select
      v_trip.id,
      p.nome,
      -- oltre il decimo partecipante i colori ricominciano da capo
      v_colori[(p.pos % v_quanti) + 1],
      'member',
      'invited'
    from (
      select nome, row_number() over (order by ord) as pos
      from unnest(p_participant_names) with ordinality as t(nome, ord)
      where trim(nome) <> ''
    ) as p;
  end if;

  return v_trip;
end;
$$;

grant execute on function create_trip_with_members(text, date, date, text, text, text[], text[]) to authenticated;

-- ===========================================================================
-- 4. Uscire di propria volontà
-- ===========================================================================
--
-- Perché una funzione security definer e non un UPDATE dal client: la policy
-- "trip_members: user can join self" (0001_init.sql:360) ha un `using` senza
-- `with check`, e quando il `with check` manca Postgres applica lo stesso
-- `using` anche alla riga nuova. La riga nuova avrebbe user_id = null, che non
-- soddisfa `user_id = auth.uid()`: l'UPDATE verrebbe rifiutato.
--
-- Perché staccare user_id e non limitarsi al timbro: è is_trip_member()
-- (0001_init.sql:70) a decidere se sei dentro un viaggio, e guarda soltanto
-- user_id. Col solo left_at resteresti marcato "uscito" ma continueresti a
-- vedere tutto, e il viaggio continuerebbe a comparire sulla tua Home.
--
-- Cosa resta: la riga, con il suo display_name e il suo colore. Le spese
-- registrate, le divisioni, i rimborsi e le foto restano attaccati a lei, con
-- il nome giusto sopra.
--
-- Il posto NON torna libero: get_unclaimed_crew_slots (0004) pretende
-- status = 'invited', e qui lo status resta 'joined'. Nessun altro può
-- rivendicare quel posto e ritrovarsi addosso le spese di chi è uscito.

create or replace function leave_trip(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membro trip_members;
begin
  select * into v_membro
  from trip_members
  where trip_id = p_trip_id and user_id = auth.uid();

  if v_membro.id is null then
    raise exception 'Non fai parte di questo viaggio.';
  end if;

  -- Se uscisse l'organizzatore il viaggio resterebbe senza nessuno che possa
  -- generare inviti, modificarlo o eliminarlo. Il passaggio di consegne è un
  -- pezzo di prodotto a sé: finché non c'è, la porta resta chiusa per lui.
  if v_membro.role = 'organizer' then
    raise exception 'Sei tu che tieni in piedi questo viaggio: un organizzatore non può uscire.';
  end if;

  update trip_members
  set left_at = coalesce(left_at, now()),
      user_id = null
  where id = v_membro.id;
end;
$$;

grant execute on function leave_trip(uuid) to authenticated;

-- ===========================================================================
-- 5. Rimozione da parte dell'organizzatore
-- ===========================================================================
--
-- Stesso identico effetto di leave_trip, controllo diverso su chi la può
-- chiamare: là sei tu su te stesso, qui è l'organizzatore su qualcun altro.

create or replace function remove_trip_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membro trip_members;
begin
  select * into v_membro from trip_members where id = p_member_id;

  if v_membro.id is null then
    raise exception 'Questa persona non fa parte del viaggio.';
  end if;

  if not is_trip_organizer(v_membro.trip_id) then
    raise exception 'Solo chi ha creato il viaggio può rimuovere qualcuno dalla crew.';
  end if;

  if v_membro.role = 'organizer' then
    raise exception 'Chi ha creato il viaggio non può essere rimosso dalla crew.';
  end if;

  update trip_members
  set left_at = coalesce(left_at, now()),
      user_id = null
  where id = p_member_id;
end;
$$;

grant execute on function remove_trip_member(uuid) to authenticated;

-- ===========================================================================
-- 6. I viaggi già esistenti
-- ===========================================================================
--
-- Tocca solo i viaggi dove tutti i membri hanno ancora lo stesso identico
-- colore, cioè quelli dove nessuno ha mai scelto il proprio. Rilanciando la
-- migrazione quei viaggi hanno ormai colori distinti e vengono saltati: è
-- questo che la rende ripetibile.

with da_sistemare as (
  select trip_id
  from trip_members
  group by trip_id
  having count(distinct color) = 1 and count(*) > 1
),
numerati as (
  select
    m.id,
    row_number() over (
      partition by m.trip_id
      -- l'organizzatore per primo, poi in ordine di inserimento
      order by (m.role <> 'organizer'), m.created_at, m.id
    ) as pos
  from trip_members m
  join da_sistemare d on d.trip_id = m.trip_id
)
update trip_members m
set color = (pina_identity_colors())[((n.pos - 1) % array_length(pina_identity_colors(), 1)) + 1]
from numerati n
where m.id = n.id;

-- ===========================================================================
-- Verifica
-- ===========================================================================
--
-- Attesi: colonna_left_at = 1, funzioni_nuove = 3, viaggi_monocolore = 0
-- (nessun viaggio con più di un membro dove sono tutti dello stesso colore).

select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'trip_members' and column_name = 'left_at')
    as colonna_left_at,
  (select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('leave_trip', 'remove_trip_member', 'pina_identity_colors'))
    as funzioni_nuove,
  (select count(*) from (
    select trip_id from trip_members
    group by trip_id having count(distinct color) = 1 and count(*) > 1
  ) x) as viaggi_monocolore,
  (select count(*) from trip_members where left_at is not null) as membri_usciti;
