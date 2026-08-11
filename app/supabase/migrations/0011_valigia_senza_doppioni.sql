-- Piña — via i doppioni già finiti nella valigia personale (COLLAUDO #34).
--
-- Il difetto: `persistPersonalSections` cancellava tutte le sezioni di quel
-- membro e le riscriveva da capo ad ogni salvataggio. Cancellare e riscrivere
-- non sono un'operazione sola, sono due, e in mezzo c'è la rete: se un secondo
-- salvataggio cancellava prima che il primo avesse inserito, l'ordine reale
-- diventava cancella-cancella-inserisci-inserisci. Una cancellazione sola, due
-- inserimenti, e la sezione compariva due volte identica.
--
-- Il codice è già stato corretto: da adesso ogni gesto tocca la sua riga e non
-- riscrive più niente. Questa migrazione serve ai doppioni **già finiti nel
-- database**, che altrimenti resterebbero lì — e che dal telefono non si
-- possono nemmeno togliere, perché una sezione non ha la ×.
--
-- ⚠️ ORDINE: prima va live il codice corretto, poi si lancia questa.
-- Al contrario non serve a niente: un telefono con la versione vecchia ancora
-- aperta rimette i doppioni al primo salvataggio, perché riscrive la lista
-- intera dalla fotografia che ha in mano.
--
-- Cosa tocca e cosa no. Cancella **solo copie identiche**: stesso viaggio,
-- stesso membro, stessa emoji, stesso nome *e* stesso contenuto voce per voce.
-- Due sezioni con lo stesso nome ma contenuto diverso non sono un doppione
-- automatico — potrebbero essere due liste vere — quindi restano, e la verifica
-- in fondo le elenca da guardare a mano. Il criterio è: non si distrugge
-- niente che qualcuno possa aver scritto.
--
-- Delle copie identiche resta la più vecchia, che è quella con cui l'utente ha
-- convissuto finora. Le voci delle copie tolte se ne vanno con la cascata
-- dichiarata nella 0001.
--
-- Ripetibile: al secondo giro non trova più niente da togliere. Verifica in
-- fondo.

-- ===========================================================================
-- 1. Le copie identiche: resta la più vecchia
-- ===========================================================================

with firma as (
  select
    s.id,
    s.trip_id,
    s.member_id,
    s.emoji,
    s.name,
    s.created_at,
    -- Il contenuto ridotto a una stringa, ordinata: due sezioni con le stesse
    -- voci hanno la stessa firma anche se sono state inserite in ordine
    -- diverso, che è esattamente quello che succede quando due salvataggi si
    -- accavallano. I separatori sono caratteri che in una lista da viaggio non
    -- si scrivono.
    coalesce((
      select string_agg(i.label || '§' || i.done::text, '¶' order by i.label, i.done)
      from personal_checklist_items i
      where i.section_id = s.id
    ), '') as contenuto
  from personal_checklist_sections s
),
numerate as (
  select
    id,
    row_number() over (
      partition by trip_id, member_id, emoji, name, contenuto
      order by created_at asc, id asc
    ) as posizione
  from firma
)
delete from personal_checklist_sections
where id in (select id from numerate where posizione > 1);

-- ===========================================================================
-- 2. Le copie rimaste vuote accanto a una piena
-- ===========================================================================
--
-- Caso residuo dello stesso incidente: la sezione duplicata c'è ma le sue voci
-- non ci sono mai arrivate. Non è coperta dal punto 1, perché il contenuto è
-- diverso (vuoto contro pieno). Si toglie lo stesso: una sezione senza voci non
-- contiene niente che qualcuno abbia scritto, e accanto a una omonima piena è
-- un residuo, non una lista.

delete from personal_checklist_sections vuota
where not exists (
        select 1 from personal_checklist_items i where i.section_id = vuota.id
      )
  and exists (
        select 1
        from personal_checklist_sections piena
        join personal_checklist_items i on i.section_id = piena.id
        where piena.trip_id = vuota.trip_id
          and piena.member_id = vuota.member_id
          and piena.name = vuota.name
          and piena.id <> vuota.id
      );

-- ===========================================================================
-- Verifica
-- ===========================================================================
--
-- Attesi:
--   doppioni_identici_rimasti = 0   (nessuna copia identica ancora in giro)
--   sezioni_totali                  quante sezioni personali esistono in tutto:
--                                   serve a capire se lo zero qui sopra è un
--                                   buon segno o vuol dire che non c'era
--                                   niente da correggere
--   omonime_da_guardare             sezioni con lo stesso nome ma contenuto
--                                   diverso: NON sono state toccate. Zero è la
--                                   normalità; se è maggiore di zero, la
--                                   seconda query le elenca

with firma as (
  select
    s.trip_id,
    s.member_id,
    s.name,
    s.emoji,
    coalesce((
      select string_agg(i.label || '§' || i.done::text, '¶' order by i.label, i.done)
      from personal_checklist_items i
      where i.section_id = s.id
    ), '') as contenuto
  from personal_checklist_sections s
)
select
  (select count(*) from (
     select 1 from firma
     group by trip_id, member_id, emoji, name, contenuto
     having count(*) > 1
   ) x) as doppioni_identici_rimasti,
  (select count(*) from personal_checklist_sections) as sezioni_totali,
  (select count(*) from (
     select 1 from firma
     group by trip_id, member_id, name
     having count(*) > 1
   ) y) as omonime_da_guardare;

-- Le omonime rimaste, con quante voci ha ciascuna: da leggere solo se il
-- conteggio qui sopra non è zero.
select
  s.trip_id,
  s.member_id,
  s.emoji,
  s.name,
  s.created_at,
  (select count(*) from personal_checklist_items i where i.section_id = s.id) as voci
from personal_checklist_sections s
where exists (
  select 1 from personal_checklist_sections d
  where d.trip_id = s.trip_id
    and d.member_id = s.member_id
    and d.name = s.name
    and d.id <> s.id
)
order by s.trip_id, s.member_id, s.name, s.created_at;
