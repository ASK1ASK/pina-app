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

## Chiusi

| # | Dove | Cosa succedeva | Chiuso da | Il |
|---|---|---|---|---|
| — | Journey | L'elenco delle tappe finiva sotto la barra di navigazione | commit `e91bf83` | 01/08 |

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
- [ ] Rotazione schermo e schermi piccoli (iPhone SE)
- [ ] L'app dopo "Aggiungi a schermata Home"
- [ ] Rimozione del viaggio demo
- [ ] Eliminazione di un viaggio vero, con conferma
