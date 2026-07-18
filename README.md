# Handoff: Piña — app di viaggio di gruppo

## Overview
Piña è un'app per organizzare un viaggio di gruppo tra amici: itinerario condiviso, checklist e documenti essenziali, spese con saldo finale ("cassa comune"), ricordi, profilo. Identità: caldo, tropicale, illustrato — non l'ennesima utility fredda da project management. Mascotte: fenicottero.

## About the Design Files
I file in `design-files/` sono **riferimenti di design creati in HTML** (formato proprietario Claude Design: markup + JS inline, runtime `support.js`/`image-slot.js`) — prototipi che mostrano l'aspetto e il comportamento previsti, **non codice di produzione da copiare**. Il compito è **ricreare questi design in React + Vite + TypeScript + Tailwind** (stack scelto per questo progetto — vedi sezione 4), non spedire l'HTML così com'è. `support.js` e `image-slot.js` sono runtime del formato di design, non vanno portati nel codice reale.

## Fidelity
**Alta fedeltà (hifi)**: mockup con colori, tipografia, spaziature e interazioni definitivi. Ricrea l'interfaccia pixel-perfect usando le librerie/pattern dello stack scelto sotto.

## Stato reale (correzioni rispetto a bozze precedenti)
- Onboarding (invito/join) e il flusso di saldo dentro Spese sono già costruiti — non sono da progettare da zero.
- **Essentials non è una schermata separata**: è assorbita dentro Checklist, con due sezioni distinte nella stessa vista — "📎 Riferimenti" (documenti/alloggi/trasporti/prenotazioni, link/QR/PDF) e "✅ Da fare" (checklist di gruppo con spunta). Non ricreare Essentials come schermata a parte.
- **Today è di fatto la dashboard**: aggrega checklist di oggi, spese di oggi, ricordi di oggi, programma/orari, alloggio della notte, link e biglietti. Non serve un'altra schermata "Dashboard".
- **Recap è uno stub quasi vuoto** (un solo stato: "Checklist non ancora condivisa"), non una schermata completa. Va deciso se costruirla come vero recap di fine viaggio ("Wrapped") solo dopo un test reale con il gruppo — non è bloccante per iniziare.
- Mascotte: 2 pose non ancora generate (mappa/nuova città, valigia/fine viaggio) — usa placeholder finché non arrivano gli asset reali.

## Screens / Views

### Home (`Piña - Home.dc.html`)
Landing/lista viaggi: "Le tue avventure", creazione nuovo viaggio (copertina, mappa, invito al gruppo).

### Onboarding (`Piña - Onboarding.dc.html`)
Flusso di invito/join al viaggio — già completo, include codice/link di invito.

### Journey (`Piña - Journey.dc.html`)
Overview viaggio + timeline verticale delle tappe. Versione v4, approvata — è il cuore dell'esperienza.

### Today (`Piña - Today.dc.html`)
Vista del giorno corrente: checklist di oggi, spese di oggi, ricordi di oggi, programma/orari, dove dormi stanotte, link e biglietti. Funge da dashboard aggregata.

### Checklist (`Piña - Checklist.dc.html`)
Due tab: "Condivisa" e "La mia valigia". Nella tab Condivisa:
- Sezione **📎 Riferimenti**: griglia 2 colonne di categorie (Documenti, Alloggi, Trasporti, Prenotazioni) — click apre un pannello con voci editabili (titolo, sottotitolo, link, allegato QR/PDF).
- Sezione **✅ Da fare**: categorie di checklist con item spuntabili, assegnati a una persona del gruppo (avatar/iniziale colorata).
Nella tab "La mia valigia": packing personale a sezioni, con hero di progresso.
Hero gradiente: coral/mango (`#ff8a5b` → `#d9481f`), non teal/blu.

### Spese (`Piña - Spese.dc.html`)
Spese di gruppo raggruppate per giorno. Modello **cassa comune**: contributi iniziali di ognuno + spese pagate da uno e divise tra tutti — non solo debiti a coppie stile Splitwise puro. Include flusso di saldo (settle-up) già costruito.

### Memories (`Piña - Memories.dc.html`)
Galleria ricordi del viaggio (foto).

### Profilo (`Piña - Profilo.dc.html`)
Profilo utente, impostazioni personali, contatti di emergenza.

### Recap (`Piña - Recap.dc.html`)
Stub — un solo stato ("Checklist non ancora condivisa"). Non implementare oltre finché non è chiaro se serve un vero recap di fine viaggio.

### Design System (`Piña - Design System.dc.html`)
Token di design e componenti condivisi (vedi sezione Design Tokens sotto).

### BottomNav (`BottomNav.dc.html`)
Navigazione inferiore condivisa a 6 tab: Journey, Today, Spese, Checklist, Memories, Profilo (Essentials NON è una tab separata).

## Interactions & Behavior
- Tutte le liste (checklist item, categorie, voci Essentials) sono editabili inline (contentEditable) con salvataggio su blur.
- Toggle spunta su singolo tap/click; long-press o click su avatar cicla l'assegnatario.
- Allegati QR/PDF: upload file → data URL salvato con la voce, thumbnail cliccabile per riaprire.
- Stato "tutto pronto" mostra un banner di celebrazione quando il 100% degli item di una sezione è completato.
- Navigazione tra schermate è a link statici (nessun router SPA nel prototipo — nel codice reale usare un router client-side).

## State Management
Store condiviso oggi in `localStorage`, gestito da `trip-data.js` (fonte di verità del modello dati, da leggere per intero prima di modellare le tabelle):
- `pina-trip-stops` (Journey): tappe (date, luogo, note)
- `pina-trip-expenses`: spese, saldi, contributi cassa comune
- `pina-trip-emergency`: contatti di emergenza
- `pina-trip-links` (i "Riferimenti" della Checklist, ora in `loadEssentialsData`/`saveEssentialsData`): link/QR/PDF per categoria
- `pina-trip-memories`: ricordi
- `pina-trip-checklist`: categorie e item di checklist
- `people`, `personOrder`, `currentUser`: persone del gruppo — `currentUser` è hardcoded nel prototipo, va sostituito da un utente autenticato reale.

## Design Tokens
- **Font**: `Fraunces` (titoli, serif, corsivo/optical size variabile, pesi 500–700) + `Manrope` (corpo, pesi 400–800)
- **Palette calda**: coral `#ff8a5b` `#d9481f` `#ff5f6d`, mango `#ffb627`, rosa `#ff5f96`, crema/sabbia `#f2ede3` `#faf3e2` `#fff1e0` `#e6d5b3`, testo bruno `#3a2a1c` `#2b2118`
- **Accenti freddi** (`#3ddbc5`, `#2fbfae`, `#2a8fd8`): usarli con parsimonia (badge, dettagli), mai come gradiente hero principale
- Vedi `Piña - Design System.dc.html` per il resto dei componenti/token (radius, ombre, spaziature) — portali come `tailwind.config` token, non colori hardcoded sparsi nei componenti.

## Assets
Emoji come iconografia provvisoria in tutto il prototipo (🪪🏕🚐🎟🧳🎒 ecc.) — sostituibili con iconografia illustrata reale se il brand lo richiede. Mascotte fenicottero: 2 pose ancora da generare (mappa/nuova città, valigia/fine viaggio), oggi placeholder testuali.

## Vincolo non negoziabile: tutto gratis
| Livello | Strumento |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind |
| Hosting | Netlify o Vercel (piano free) |
| Backend condiviso | Supabase (piano free): Postgres, Auth, Storage, Realtime |
| Autenticazione | Supabase Auth, magic link via email |
| Installabilità | PWA (`vite-plugin-pwa`), niente store a pagamento |

Limiti da accettare: Supabase free va in pausa dopo 7 giorni di inattività (si riattiva con un click); storage foto 1GB, comprimere lato client prima dell'upload.

Se esiste già uno scaffold di progetto in questa cartella di lavoro con un'identità visiva diversa, va ri-skinnato secondo Piña, non riusato con la sua identità attuale.

## Ordine di conversione consigliato
1. Scaffold progetto + design tokens (Design System → `tailwind.config`)
2. Schema Supabase (tabelle: `trips`, `people`, `trip_members`, `invites`, `stops`, `expenses`, `settlements`, `cassa_contributions`, `checklist_categories`, `checklist_items`, `essentials_entries`, `memories`, `emergency_contacts`) + Auth magic link
3. **Onboarding + Home** — cold-start di gruppo, deve funzionare per primo
4. **Journey** — cuore dell'esperienza
5. **Today** — vista aggregata del giorno (già di fatto la dashboard)
6. **Checklist** (con distinzione Riferimenti/Da fare) e **Spese** (con cassa comune + settle-up)
7. **Memories**, **Profilo**
8. Decidere **Recap** solo a questo punto
9. PWA + deploy Netlify/Vercel collegato a GitHub
10. Test con un vero viaggio del gruppo di amici

## Files
Tutti i file di design sono in `design-files/`:
- `Piña - Home.dc.html`, `Piña - Onboarding.dc.html`, `Piña - Journey.dc.html`, `Piña - Today.dc.html`, `Piña - Checklist.dc.html`, `Piña - Spese.dc.html`, `Piña - Memories.dc.html`, `Piña - Profilo.dc.html`, `Piña - Recap.dc.html`, `Piña - Design System.dc.html`, `BottomNav.dc.html`
- `trip-data.js` — modello dati, da leggere per intero prima di progettare lo schema Supabase
