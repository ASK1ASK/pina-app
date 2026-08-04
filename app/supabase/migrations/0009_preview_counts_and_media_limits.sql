-- Piña — chi è uscito non è più a bordo, la prenotazione sta con l'alloggio,
-- e il magazzino ha un tetto.
--
-- Tre cose piccole che viaggiano insieme perché toccano lo stesso cantiere
-- (allegati e file):
--
-- 1. L'anteprima dell'invito contava ancora chi aveva lasciato il viaggio.
-- 2. La prenotazione di un alloggio non aveva un posto dove stare: si poteva
--    allegare solo dentro una categoria generica degli Essentials.
-- 3. Il bucket dei file non aveva alcun limite di dimensione: da adesso
--    accetta anche documenti, e senza un tetto un PDF da 80 MB parte davvero.
--
-- Ripetibile: si può rilanciare senza rompere niente. Verifica in fondo.

-- ===========================================================================
-- 1. L'anteprima dell'invito conta solo chi è ancora dentro
-- ===========================================================================
--
-- Chi esce da un viaggio mantiene status = 'joined' — è una scelta della 0008,
-- ed è quella giusta: liberare il posto permetterebbe a un altro di
-- rivendicarlo e di ritrovarsi addosso le spese di chi se n'è andato. Il
-- segnale vero dell'uscita è left_at, e qui non veniva guardato: chi apriva il
-- link dell'invito vedeva "5 già a bordo" anche quando a bordo erano rimasti
-- in tre.
--
-- La Home era già stata sistemata nel cantiere A (filtro `.is('left_at', null)`
-- sul conteggio della crew); questa funzione era rimasta indietro.
--
-- Nota: la funzione va riscritta per intero perché `create or replace` non
-- accetta modifiche parziali. L'unica differenza rispetto alla 0003 è la
-- condizione `and m.left_at is null` nel conteggio.

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
    (select count(*) from trip_members m
      where m.trip_id = t.id and m.status = 'joined' and m.left_at is null)
  from invites i
  join trips t on t.id = i.trip_id
  where i.code = upper(p_code);
$$;

-- Come nella 0003: leggibile anche da chi non è ancora membro e da chi non ha
-- ancora fatto login, altrimenti un invito non servirebbe a niente.
grant execute on function get_trip_preview_by_code(text) to authenticated, anon;

-- ===========================================================================
-- 2. La prenotazione attaccata all'alloggio
-- ===========================================================================
--
-- Finora un documento si poteva allegare soltanto a una voce degli Essentials:
-- Checklist → Essentials → scegli la categoria → trova la voce. Va bene per
-- archiviare con calma da casa, non per ritrovare la prenotazione arrivando in
-- hotel a mezzanotte.
--
-- La colonna sta su stop_stays e non su stops perché una tappa può avere più
-- alloggi (una notte in un posto, due in un altro), e la prenotazione è di
-- quell'alloggio lì.
--
-- Contiene un percorso nel magazzino (`<id-viaggio>/<nome-casuale>.pdf`), la
-- stessa forma usata da essentials_entries.attachment_url.

alter table stop_stays add column if not exists attachment_url text;

comment on column stop_stays.attachment_url is
  'Percorso nel bucket trip-media della prenotazione allegata a questo alloggio. Non è il file: è dove trovarlo.';

-- ===========================================================================
-- 3. Un tetto alla dimensione dei file
-- ===========================================================================
--
-- Da questo cantiere il bucket accetta anche documenti (PDF, biglietti), non
-- più solo foto e video. I limiti veri restano lato client — 25 MB per i
-- video, 10 MB per i documenti, e le foto vengono rimpicciolite prima di
-- partire — ma erano l'unica difesa esistente: chiunque parli direttamente
-- con lo storage li aggirerebbe.
--
-- 30 MB lascia margine sopra il limite dei video senza mai diventare il
-- vincolo che l'utente incontra per primo.
--
-- Nessun vincolo sui tipi di file: elencarli qui significherebbe tenere due
-- elenchi allineati a mano, e un tipo dimenticato diventerebbe un errore di
-- caricamento senza spiegazione.

update storage.buckets
set file_size_limit = 30 * 1024 * 1024
where id = 'trip-media';

-- ===========================================================================
-- Verifica
-- ===========================================================================
--
-- Attesi:
--   preview_esclude_usciti = true   (la funzione guarda left_at)
--   colonna_allegato_stay  = 1
--   tetto_mb               = 30
--   bucket_privato         = true   (invariato: i file di un viaggio non
--                                    devono essere leggibili da chiunque)

select
  (select pg_get_functiondef(p.oid) like '%left_at is null%'
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'get_trip_preview_by_code')
    as preview_esclude_usciti,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'stop_stays' and column_name = 'attachment_url')
    as colonna_allegato_stay,
  (select file_size_limit / 1024 / 1024 from storage.buckets where id = 'trip-media')
    as tetto_mb,
  (select not public from storage.buckets where id = 'trip-media')
    as bucket_privato;
