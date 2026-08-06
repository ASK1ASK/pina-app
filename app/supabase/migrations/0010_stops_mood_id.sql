-- Piña — le tappe già create ritrovano il loro colore in Today.
--
-- Il difetto: creando una tappa, Journey salvava `mood_line` (l'etichetta) e
-- `gradient` (il colore) ma non `mood_id`, che finiva nel database come stringa
-- vuota. Journey non se ne accorgeva, perché disegna il colore partendo dal
-- gradiente; Today sì, perché è l'unico schermo che cerca l'*id*, e ripiegava
-- su 'camper' per ogni giorno. Da qui "in Journey il colore si vede e in Today
-- tutti i giorni sono uguali".
--
-- Il codice è già stato corretto: da adesso le tappe nuove nascono con
-- `mood_id` scritto. Questa migrazione serve alle tappe **già create**, che
-- altrimenti resterebbero grigie per sempre.
--
-- L'id si ricava da quello che è stato salvato davvero, senza indovinare:
--   1. dal `gradient`, che è la corrispondenza più solida — i nove gradienti
--      sono tutti diversi tra loro ed è testo ASCII, quindi non risente di
--      come viene incollato questo file;
--   2. dalla `mood_line` per le righe senza gradiente.
-- Le due fonti sono sempre d'accordo, perché Journey le scrive insieme
-- partendo dallo stesso mood: la seconda è una rete, non un'alternativa.
--
-- Ripetibile: tocca solo le righe ancora senza id, quindi rilanciarla non
-- cambia niente. Verifica in fondo.

-- ===========================================================================
-- Le tappe senza mood_id lo ricavano da gradient, e in seconda battuta da
-- mood_line
-- ===========================================================================

update stops
set mood_id = case
  when gradient = 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' then 'fiesta'
  when gradient = 'linear-gradient(135deg,#2fbfae,#2a8fd8)' then 'beach'
  when gradient = 'linear-gradient(135deg,#7a9d54,#4f8f4f)' then 'camper'
  when gradient = 'linear-gradient(135deg,#c2445a,#8a2f42)' then 'food'
  when gradient = 'linear-gradient(135deg,#4f8f4f,#2d6a4f)' then 'nature'
  when gradient = 'linear-gradient(135deg,#ff5f96,#ff5f6d)' then 'romantic'
  when gradient = 'linear-gradient(135deg,#8a6a3e,#5a4326)' then 'study'
  when gradient = 'linear-gradient(135deg,#e8b74e,#b8792e)' then 'culture'
  when gradient = 'linear-gradient(135deg,#ffb627,#ff8a5b)' then 'relax'
  -- Le etichette arrivano tutte da moodDefs (lib/palette.ts): se un giorno
  -- quell'elenco cambia, questo blocco va aggiornato insieme.
  when mood_line = '🎉 Festival' then 'fiesta'
  when mood_line = '🌊 Mare' then 'beach'
  when mood_line = '🏕 Camper' then 'camper'
  when mood_line = '🍷 Food' then 'food'
  when mood_line = '🌄 Natura' then 'nature'
  when mood_line = '😍 Romantico' then 'romantic'
  when mood_line = '📚 Studio' then 'study'
  when mood_line = '🏛 Cultura' then 'culture'
  when mood_line = '🎡 Relax' then 'relax'
  -- Nessuna delle due fonti dice niente: si lascia vuota invece di inventare
  -- un colore. Comparirà nella verifica qui sotto come "senza_id_rimaste".
  else mood_id
end
where mood_id is null or mood_id = '';

-- ===========================================================================
-- Verifica
-- ===========================================================================
--
-- Attesi:
--   senza_id_rimaste = 0     (nessuna tappa più senza mood_id)
--   id_sconosciuti   = 0     (nessun id fuori dai nove previsti)
--   tappe_totali     = quante tappe esistono in tutto: serve solo a capire se
--                      lo zero qui sopra è un buon segno o vuol dire che non
--                      c'è ancora niente da correggere
--
-- Se senza_id_rimaste è maggiore di zero, la seconda query elenca le righe
-- rimaste indietro con quello che hanno dentro: sono tappe con gradiente ed
-- etichetta entrambi vuoti o non riconosciuti, da guardare a mano.

select
  (select count(*) from stops where mood_id is null or mood_id = '')
    as senza_id_rimaste,
  (select count(*) from stops
     where mood_id is not null and mood_id <> ''
       and mood_id not in ('fiesta','beach','camper','food','nature','romantic','study','culture','relax'))
    as id_sconosciuti,
  (select count(*) from stops) as tappe_totali;

select id, trip_id, name, mood_line, gradient
from stops
where mood_id is null or mood_id = ''
order by trip_id, position;
