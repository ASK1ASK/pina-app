-- Piña — schema iniziale (Supabase Postgres)
-- Ordine di conversione step 2: sostituisce il localStorage del prototipo.
-- Applicare con: supabase db push  (oppure incollare nel SQL Editor di Supabase)

create extension if not exists "pgcrypto";

-- ============================================================================
-- Profili utente (1:1 con auth.users, creato automaticamente al signup)
-- ============================================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Viaggiatore',
  created_at timestamptz not null default now()
);

create function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Viaggiatore'));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================================
-- Viaggi e partecipanti
-- ============================================================================
create table trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date,
  end_date date,
  cover_color_id text not null default 'fiesta',
  cover_photo_url text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create type trip_member_role as enum ('organizer', 'member');
create type trip_member_status as enum ('invited', 'joined');

-- Un trip_members esiste anche prima che la persona abbia un account: user_id
-- resta null finché non si unisce davvero (matcha il flusso invita→join del prototipo).
create table trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  display_name text not null,
  color text not null default '#ff8a5b',
  emoji text not null default '😎',
  vibe text not null default 'chill',
  role trip_member_role not null default 'member',
  status trip_member_status not null default 'invited',
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

-- Helper: la richiesta corrente appartiene a un membro del viaggio?
create function is_trip_member(target_trip_id uuid)
returns boolean as $$
  select exists (
    select 1 from trip_members
    where trip_id = target_trip_id and user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create function is_trip_organizer(target_trip_id uuid)
returns boolean as $$
  select exists (
    select 1 from trip_members
    where trip_id = target_trip_id and user_id = auth.uid() and role = 'organizer'
  );
$$ language sql stable security definer set search_path = public;

-- ============================================================================
-- Journey — tappe
-- ============================================================================
create table stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  mood_id text not null default 'fiesta',
  mood_line text not null default '',
  photo_url text,
  gradient text,
  highlight boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table stop_stays (
  id uuid primary key default gen_random_uuid(),
  stop_id uuid not null references stops(id) on delete cascade,
  name text not null default '',
  link text not null default '',
  -- null = valido per tutta la tappa; altrimenti notte specifica (tappe multi-giorno)
  night_date date,
  created_at timestamptz not null default now()
);

create table stop_categories (
  id uuid primary key default gen_random_uuid(),
  stop_id uuid not null references stops(id) on delete cascade,
  icon text not null default '📌',
  label text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table stop_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references stop_categories(id) on delete cascade,
  label text not null,
  link text not null default '',
  starred boolean not null default false,
  item_date date,
  icon text,
  item_time time,
  useful_link text not null default '',
  booking text not null default '',
  notes text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table stop_item_checklist (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references stop_items(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  position int not null default 0
);

-- Ordine manuale del "Programma di oggi" (Today), condiviso dalla crew.
create table schedule_orders (
  trip_id uuid not null references trips(id) on delete cascade,
  schedule_date date not null,
  ordered_item_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (trip_id, schedule_date)
);

-- ============================================================================
-- Spese — cassa comune
-- ============================================================================
create table expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  title text not null,
  icon text not null default '💳',
  amount numeric(10,2) not null check (amount > 0),
  -- null = pagata dalla cassa comune
  paid_by_member_id uuid references trip_members(id) on delete set null,
  note text not null default '',
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table expense_splits (
  expense_id uuid not null references expenses(id) on delete cascade,
  member_id uuid not null references trip_members(id) on delete cascade,
  primary key (expense_id, member_id)
);

create table settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  from_member_id uuid not null references trip_members(id) on delete cascade,
  to_member_id uuid not null references trip_members(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  settlement_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table cassa_contributions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid not null references trip_members(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  contribution_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Checklist — condivisa e personale
-- ============================================================================
create table checklist_categories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  emoji text not null default '📌',
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references checklist_categories(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  assignee_member_id uuid references trip_members(id) on delete set null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- "La mia valigia": sezioni personali, scoped al singolo membro.
create table personal_checklist_sections (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid not null references trip_members(id) on delete cascade,
  emoji text not null default '📦',
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table personal_checklist_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references personal_checklist_sections(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Essentials (Riferimenti) e contatti di emergenza — trip-wide
-- ============================================================================
create table essentials_categories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  emoji text not null default '📎',
  name text not null,
  gradient text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table essentials_entries (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references essentials_categories(id) on delete cascade,
  title text not null,
  subtitle text not null default '',
  tag text not null default '',
  href text not null default '',
  attachment_url text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  title text not null,
  subtitle text not null default '',
  href text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table trip_links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  emoji text not null default '🔗',
  label text not null,
  subtitle text not null default '',
  url text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Memories
-- ============================================================================
create table memory_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  label text not null,
  memory_date date not null,
  cover_url text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table memories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  day_id uuid references memory_days(id) on delete set null,
  url text not null,
  is_video boolean not null default false,
  is_favorite boolean not null default false,
  caption text not null default '',
  author_member_id uuid references trip_members(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Attività recenti (Journey)
-- ============================================================================
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid references trip_members(id) on delete set null,
  action text not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security — accesso limitato ai membri del viaggio
-- ============================================================================
alter table profiles enable row level security;
alter table trips enable row level security;
alter table trip_members enable row level security;
alter table invites enable row level security;
alter table stops enable row level security;
alter table stop_stays enable row level security;
alter table stop_categories enable row level security;
alter table stop_items enable row level security;
alter table stop_item_checklist enable row level security;
alter table schedule_orders enable row level security;
alter table expenses enable row level security;
alter table expense_splits enable row level security;
alter table settlements enable row level security;
alter table cassa_contributions enable row level security;
alter table checklist_categories enable row level security;
alter table checklist_items enable row level security;
alter table personal_checklist_sections enable row level security;
alter table personal_checklist_items enable row level security;
alter table essentials_categories enable row level security;
alter table essentials_entries enable row level security;
alter table emergency_contacts enable row level security;
alter table trip_links enable row level security;
alter table memory_days enable row level security;
alter table memories enable row level security;
alter table activity_log enable row level security;

create policy "profiles: read own" on profiles for select using (id = auth.uid());
create policy "profiles: update own" on profiles for update using (id = auth.uid());

create policy "trips: members can read" on trips for select using (is_trip_member(id));
create policy "trips: authenticated users can create" on trips for insert with check (created_by = auth.uid());
create policy "trips: organizer can update" on trips for update using (is_trip_organizer(id));
create policy "trips: organizer can delete" on trips for delete using (is_trip_organizer(id));

create policy "trip_members: members can read" on trip_members for select using (is_trip_member(trip_id));
create policy "trip_members: organizer can manage" on trip_members for all using (is_trip_organizer(trip_id));
create policy "trip_members: user can join self" on trip_members for update using (user_id = auth.uid() or is_trip_organizer(trip_id));

create policy "invites: members can read" on invites for select using (is_trip_member(trip_id));
create policy "invites: organizer can manage" on invites for all using (is_trip_organizer(trip_id));

-- Le tabelle trip-scoped condividono lo stesso pattern: lettura/scrittura per i membri del viaggio.
do $$
declare
  t text;
  trip_scoped_tables text[] := array[
    'stops', 'schedule_orders', 'expenses', 'settlements', 'cassa_contributions',
    'checklist_categories', 'personal_checklist_sections', 'essentials_categories',
    'emergency_contacts', 'trip_links', 'memory_days', 'memories', 'activity_log'
  ];
begin
  foreach t in array trip_scoped_tables loop
    execute format('create policy "%1$s: members can read" on %1$s for select using (is_trip_member(trip_id));', t);
    execute format('create policy "%1$s: members can write" on %1$s for all using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));', t);
  end loop;
end $$;

-- Tabelle figlie: accesso derivato dal viaggio del genitore.
create policy "stop_stays: via stop" on stop_stays for all
  using (is_trip_member((select trip_id from stops where stops.id = stop_stays.stop_id)))
  with check (is_trip_member((select trip_id from stops where stops.id = stop_stays.stop_id)));

create policy "stop_categories: via stop" on stop_categories for all
  using (is_trip_member((select trip_id from stops where stops.id = stop_categories.stop_id)))
  with check (is_trip_member((select trip_id from stops where stops.id = stop_categories.stop_id)));

create policy "stop_items: via category" on stop_items for all
  using (is_trip_member((select trip_id from stops join stop_categories on stop_categories.stop_id = stops.id where stop_categories.id = stop_items.category_id)))
  with check (is_trip_member((select trip_id from stops join stop_categories on stop_categories.stop_id = stops.id where stop_categories.id = stop_items.category_id)));

create policy "stop_item_checklist: via item" on stop_item_checklist for all
  using (is_trip_member((select trip_id from stops join stop_categories on stop_categories.stop_id = stops.id join stop_items on stop_items.category_id = stop_categories.id where stop_items.id = stop_item_checklist.item_id)))
  with check (is_trip_member((select trip_id from stops join stop_categories on stop_categories.stop_id = stops.id join stop_items on stop_items.category_id = stop_categories.id where stop_items.id = stop_item_checklist.item_id)));

create policy "expense_splits: via expense" on expense_splits for all
  using (is_trip_member((select trip_id from expenses where expenses.id = expense_splits.expense_id)))
  with check (is_trip_member((select trip_id from expenses where expenses.id = expense_splits.expense_id)));

create policy "checklist_items: via category" on checklist_items for all
  using (is_trip_member((select trip_id from checklist_categories where checklist_categories.id = checklist_items.category_id)))
  with check (is_trip_member((select trip_id from checklist_categories where checklist_categories.id = checklist_items.category_id)));

create policy "personal_checklist_items: via section" on personal_checklist_items for all
  using (is_trip_member((select trip_id from personal_checklist_sections where personal_checklist_sections.id = personal_checklist_items.section_id)))
  with check (is_trip_member((select trip_id from personal_checklist_sections where personal_checklist_sections.id = personal_checklist_items.section_id)));

create policy "essentials_entries: via category" on essentials_entries for all
  using (is_trip_member((select trip_id from essentials_categories where essentials_categories.id = essentials_entries.category_id)))
  with check (is_trip_member((select trip_id from essentials_categories where essentials_categories.id = essentials_entries.category_id)));
