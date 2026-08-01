-- Fase 6 — rende davvero operativa la sincronizzazione live fra piu' utenti.
--
-- La migrazione 0002 aveva iscritto alla pubblicazione realtime solo trips e
-- trip_members. Questo bastava per la presenza ("chi e' online") e per la
-- schermata della crew, ma NON per le schermate del viaggio: Postgres invia
-- gli eventi solo per le tabelle presenti nella pubblicazione, quindi le
-- iscrizioni di Spese, Checklist e Memories non hanno mai ricevuto nulla.
--
-- Si puo' rilanciare senza problemi: le tabelle gia' pubblicate vengono
-- saltate invece di far fallire l'intero script.

do $$
declare
  tabella text;
begin
  foreach tabella in array array[
    'expenses',
    'expense_splits',
    'settlements',
    'cassa_contributions',
    'checklist_categories',
    'checklist_items',
    'essentials_categories',
    'essentials_entries',
    'memory_days',
    'memories'
  ]::text[]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tabella
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tabella);
      raise notice 'Aggiunta alla pubblicazione realtime: %', tabella;
    else
      raise notice 'Gia'' presente, saltata: %', tabella;
    end if;
  end loop;
end $$;

-- Per le tabelle su cui il client filtra per viaggio (filter: trip_id=eq...)
-- serve REPLICA IDENTITY FULL: senza, l'evento di cancellazione contiene solo
-- la chiave primaria, il filtro su trip_id non trova corrispondenza e la
-- cancellazione non arriverebbe mai agli altri membri.
alter table expenses replica identity full;
alter table settlements replica identity full;
alter table cassa_contributions replica identity full;
alter table checklist_categories replica identity full;
alter table essentials_categories replica identity full;
alter table memory_days replica identity full;
alter table memories replica identity full;

-- Verifica finale: elenca cosa risulta pubblicato adesso.
select tablename as tabella_pubblicata
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
