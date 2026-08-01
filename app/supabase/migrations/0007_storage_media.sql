-- Fase 7 — le foto e gli allegati vanno nello storage, non dentro il database.
--
-- Finora ogni file veniva convertito in testo (base64) e salvato in una colonna
-- del database. Una foto da telefono di 3 MB diventa cosi' circa 4 MB di testo:
-- con il piano gratuito (500 MB di database) bastano poche decine di foto per
-- riempire tutto e bloccare i salvataggi, e ogni apertura della schermata
-- Memories scarica per intero tutte le foto gia' caricate.
--
-- Lo storage e' invece pensato per questo, ha 1 GB sul piano gratuito ed e'
-- separato dal database.
--
-- Si puo' rilanciare senza problemi.

-- Bucket privato: le foto di un viaggio sono personali, quindi non devono
-- essere leggibili da chiunque abbia l'indirizzo. L'app genera al momento dei
-- link firmati e temporanei per mostrarle.
insert into storage.buckets (id, name, public)
values ('trip-media', 'trip-media', false)
on conflict (id) do nothing;

-- I file sono organizzati come  <id-del-viaggio>/<nome-casuale>  cosi' il
-- primo pezzo del percorso dice a quale viaggio appartiene il file, e si puo'
-- riusare il controllo di appartenenza gia' esistente (is_trip_member).
-- Il controllo sul formato uuid evita errori di conversione se arrivasse un
-- percorso costruito male.
create or replace function public.trip_id_from_storage_path(object_name text)
returns uuid
language sql
immutable
as $$
  select case
    when (storage.foldername(object_name))[1] ~ '^[0-9a-fA-F-]{36}$'
      then ((storage.foldername(object_name))[1])::uuid
    else null
  end;
$$;

drop policy if exists "trip-media: i membri possono leggere" on storage.objects;
create policy "trip-media: i membri possono leggere"
  on storage.objects for select
  using (
    bucket_id = 'trip-media'
    and public.is_trip_member(public.trip_id_from_storage_path(name))
  );

drop policy if exists "trip-media: i membri possono caricare" on storage.objects;
create policy "trip-media: i membri possono caricare"
  on storage.objects for insert
  with check (
    bucket_id = 'trip-media'
    and public.is_trip_member(public.trip_id_from_storage_path(name))
  );

drop policy if exists "trip-media: i membri possono eliminare" on storage.objects;
create policy "trip-media: i membri possono eliminare"
  on storage.objects for delete
  using (
    bucket_id = 'trip-media'
    and public.is_trip_member(public.trip_id_from_storage_path(name))
  );

-- Verifica finale: bucket creato e regole attive.
select
  (select count(*) from storage.buckets where id = 'trip-media') as bucket_creato,
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'trip-media:%') as regole_attive;
