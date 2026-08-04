# Piña — COLLAUDO

> Registro dei problemi visti usando l'app davvero. **Questa è una chat che resta aperta**: ci si butta dentro quello che si nota, senza correggerlo lì.
> Chi collauda non ripara. Ogni problema confermato diventa un cantiere.

Modello per questa chat: **Sonnet**. Non deve aprire il codice — deve guardare l'app e scrivere qui.

## Come si usa

1. Usi l'app dal telefono, come la userebbe un amico.
2. Quando qualcosa non torna, lo dici nella chat di collaudo: cosa stavi facendo, cosa ti aspettavi, cosa è successo.
3. La riga finisce in tabella qui sotto con una gravità.
4. Quando decidi di risolverne uno, **apri un cantiere nuovo** e lo citi per numero.

**Gravità:** 🔴 blocca l'uso · 🟠 fa brutta figura ma si aggira · 🟡 rifinitura

## Aperti

| # | Gravità | Dove | Cosa succede | Visto il |
|---|---|---|---|---|
| 1 | 🟡 | Login | L'email col codice non arriva: SMTP di Supabase non consegna. Riprodotto con un amico reale su Gmail. **Non blocca più**: dal 04/08 si entra con Google e l'email è in secondo piano. Si risolve solo comprando il dominio — decisione sospesa | 02/08 |
| 6 | 🟠 | Aggiunta a schermata Home | **Manca il manifest.** Niente `manifest.webmanifest`, niente `apple-touch-icon`, nessun PNG, nessun `theme-color`. Aggiunta alla home, l'app prende un'icona generica e si apre come pagina di browser, con la barra dell'indirizzo. Voce già nota in STATO come "icona webapp — manca": è più grande di un'icona | 04/08 |
| 7 | 🟠 | Spese, Checklist, Memories, Profilo | Il ritorno alla Home è un link normale, non di navigazione interna: **ricarica tutta l'app** invece di cambiare schermata. Da Today e Journey invece è istantaneo. Si sente: da metà delle pagine il ritorno "sbatte". ⚠️ *Aggiornato il 04/08: il pulsante "🏠 Home" in alto a destra non esiste più (ha lasciato il posto al tondo del profilo, cantiere #2). Il difetto è rimasto identico ma ora sta sul marchio "🦩 Piña" in alto a sinistra, che su queste quattro pagine è ancora un `<a href="/">` invece di un `<Link>`* | 04/08 |
| 8 | 🟠 | Tutta l'app | **Testo secondario sotto la soglia di leggibilità.** `#a9906f` su crema dà un contrasto di **2,6:1** e `#b39a78` (le etichettine maiuscole) **2,3:1** — il minimo richiesto è 4,5:1. Sono i sottotitoli e le didascalie, usati ovunque a 10-12px. Al sole, in viaggio, spariscono | 04/08 |
| 9 | 🟡 | Tutta l'app | **Le animazioni non ci sono.** Una sola in tutta l'app (la comparsa dei messaggi). I pannelli in basso appaiono di colpo, i tocchi non danno risposta, il passaggio tra schermate è uno stacco secco | 04/08 |
| 10 | 🟡 | Tutta l'app | Le icone sono **emoji di sistema**: cambiano faccia tra iPhone, Android e PC, non si colorano, non scalano. Esiste già `public/icons.svg` pronto e **non è mai usato** | 04/08 |

## Chiusi

| # | Dove | Cosa succedeva | Chiuso da | Il |
|---|---|---|---|---|
| — | Journey | L'elenco delle tappe finiva sotto la barra di navigazione | commit `e91bf83` | 01/08 |
| 2 | Home e pagine di viaggio | Il tondo in alto a destra era un 🦩 uguale per chiunque e portava al profilo del primo viaggio della lista, uno a caso. Ora sulla Home mostra la tua iniziale vera e apre l'account; dentro un viaggio mostra iniziale e colore scelti in *quella* crew e apre il profilo di *quel* viaggio. Il saluto usa il nome dell'account Google, non il pezzo prima della chiocciola | commit `9f9a662` | 04/08 |
| 3 | Ovunque | Non esisteva un modo di uscire dall'account: chi si passava il telefono restava dentro la sessione di chi c'era prima. Ora dalla Home si esce in due tocchi, e l'uscita ripulisce anche i dati rimasti sul telefono | commit `9f9a662` | 04/08 |
| 4 | Profilo → Esci dal viaggio | Il pulsante cambiava solo stato React: bastava ricaricare per essere di nuovo dentro. Ora tocca il database (migrazione 0008), e ricaricando si resta fuori. Le spese registrate e i conti in sospeso restano al loro posto. L'organizzatore può anche rimuovere qualcuno dalla crew | commit `9f9a662` | 04/08 |
| 5 | Checklist → Essentials, copertine | Allegati e copertine finivano **dentro il database come testo base64**: una foto da telefono diventava qualche MB di testo, riscaricato a ogni apertura della schermata. Ora vanno nello Storage come i ricordi, e nel database resta solo il percorso. Sostituendo o togliendo un file, il precedente viene rimosso invece di restare lì invisibile. Trovato strada facendo e sistemato: **la copertina scelta durante la creazione non veniva salvata affatto**, né foto né colore — il viaggio nasceva col colore di default e ci restava | commit `142a706` | 05/08 |
| 11 | Checklist → Essentials | Un PDF allegato si vedeva come quadratino grigio vuoto, perché l'anteprima era disegnata come immagine di sfondo CSS. Ora un documento si mostra come tale (📄 col tipo di file) e toccandolo si apre; le immagini restano miniature vere. `uploadTripMedia` ha un terzo ramo per i documenti, che conserva estensione e tipo veri invece di salvarli come `.jpg` | commit `142a706` | 05/08 |
| 12 | Checklist → Essentials, Today, Journey | Allegare era sepolto e il bersaglio era alto 10px. Ora: pulsante **44px**, scorciatoia "🪪 Documenti" da Today che apre la Checklist già sulla categoria giusta, e la **prenotazione si allega sotto l'alloggio della tappa** in Journey (colonna `stop_stays.attachment_url`, migrazione 0009). Gli Essentials non sono stati spostati: restano il posto giusto per archiviare | commit `142a706` | 05/08 |
| 13 | Anteprima dell'invito | Chi aveva lasciato il viaggio era ancora contato tra i partecipanti: il conteggio guardava `status = 'joined'` senza `left_at`. Corretto in `get_trip_preview_by_code` con la migrazione 0009 | commit `142a706` | 05/08 |

## Da provare prima del 14/08

Lista di controllo, non ancora eseguita. Va percorsa **da telefono**, non da PC — quasi tutti i problemi finora sono emersi solo lì.

- [ ] Un amico apre il link da WhatsApp, entra con Google, entra nella crew *(cantiere 7, prova B — è il prossimo passo)*
- [ ] Entrata con il codice a 6 cifre
- [ ] Entrata col QR code
- [ ] Chi entra sceglie il proprio slot nella crew, nome e colore
- [ ] Due telefoni sullo stesso viaggio: una spunta sulla checklist si vede sull'altro
- [ ] Due persone sulla stessa voce nello stesso momento
- [ ] Aggiunta di una spesa, con e senza cassa comune
- [ ] Caricamento di una foto in Memories da telefono
- [ ] Aggiunta di una tappa in Journey
- [ ] Un PDF allegato a una voce Essentials: si vede come documento e toccandolo si apre *(cantiere C)*
- [ ] Una foto/QR allegata: si vede in anteprima come prima *(cantiere C)*
- [ ] Copertina e allegato caricati da telefono: i valori salvati sono percorsi brevi, **non** stringhe che iniziano per `data:` *(cantiere C)*
- [ ] Copertine e allegati caricati **prima** del cantiere C: devono continuare a vedersi senza ricaricarli
- [ ] La copertina scelta durante la creazione del viaggio si vede sulla Home appena il viaggio è creato *(cantiere C)*
- [ ] Sostituzione di una copertina: il file vecchio non deve restare nello Storage *(cantiere C)*
- [ ] La prenotazione allegata sotto l'alloggio di una tappa in Journey *(cantiere C)*
- [ ] La scorciatoia "🪪 Documenti" da Today apre la Checklist già sulla categoria Documenti *(cantiere C)*
- [ ] Rotazione schermo e schermi piccoli (iPhone SE)
- [ ] L'app dopo "Aggiungi a schermata Home"
- [ ] Rimozione del viaggio demo
- [ ] Eliminazione di un viaggio vero, con conferma
- [ ] Uscita dall'account dalla Home, poi ricaricare: non si deve rientrare
- [ ] Un secondo account Google sullo stesso telefono: deve vedere solo i **suoi** viaggi, senza residui del precedente
- [ ] Il tondo in alto a destra dentro un viaggio: iniziale e colore devono essere quelli scelti in *quella* crew
- [ ] "Esci dal viaggio" da un telefono, e verifica **da un altro telefono** che il gruppo non veda più quella persona tra i partecipanti
- [ ] Dopo un'uscita: i saldi delle spese devono restare corretti, senza importi persi né nomi mancanti
- [ ] L'organizzatore rimuove qualcuno dalla crew (Profilo → Gestisci la crew)
- [ ] Un viaggio nuovo con più di 5 partecipanti: i pallini devono avere colori diversi, non tutti coral
