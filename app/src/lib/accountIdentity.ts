/**
 * Chi sei sul tuo account, che e' cosa diversa da chi sei dentro un viaggio.
 *
 * Dentro un viaggio nome e colore sono quelli scelti nella crew (decisione del
 * 26/07, vedi trip_members.display_name / color). Qui siamo un livello sopra:
 * la Home, dove un viaggio non c'e' ancora, e l'unica cosa che ti descrive e'
 * l'account con cui sei entrato.
 *
 * I dati dell'account Google arrivano dentro session.user.user_metadata, e
 * quali campi ci siano davvero dipende da cosa Google decide di mandare: non
 * si puo' dare per scontato nessuno di loro, nemmeno il nome. Da qui la
 * catena di ripieghi, che finisce sempre su qualcosa di scrivibile.
 */

export interface DatiAccount {
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

function testoUtile(valore: unknown): string | null {
  if (typeof valore !== 'string') return null
  const pulito = valore.trim()
  return pulito ? pulito : null
}

/** La parte prima della chiocciola, con l'iniziale maiuscola. */
function dallEmail(email: string | null): string | null {
  if (!email) return null
  const prima = testoUtile(email.split('@')[0])
  if (!prima) return null
  return prima.charAt(0).toUpperCase() + prima.slice(1)
}

/**
 * Il nome per esteso dell'account: "Giuseppe Scribani".
 *
 * Google manda di solito `full_name` e `name`; `display_name` e' quello che
 * si aspetta il trigger handle_new_user (0001_init.sql:20), che pero' Google
 * non riempie mai. L'email e' l'ultimo ripiego, non la prima scelta: e' il
 * difetto da cui nasce questo lavoro.
 */
export function nomeAccount(utente: DatiAccount | null | undefined): string | null {
  if (!utente) return null
  const meta = utente.user_metadata ?? {}
  return (
    testoUtile(meta.full_name) ??
    testoUtile(meta.name) ??
    testoUtile(meta.display_name) ??
    testoUtile(meta.given_name) ??
    dallEmail(testoUtile(utente.email))
  )
}

/** Solo il primo pezzo del nome: per il saluto "Ciao, ..." sulla Home. */
export function nomeBreve(utente: DatiAccount | null | undefined): string | null {
  const intero = nomeAccount(utente)
  if (!intero) return null
  return intero.split(/\s+/)[0]
}

/**
 * La lettera dentro il tondo, da un nome qualsiasi. Mai vuota: senza niente da
 * cui partire resta un punto interrogativo, che e' comunque meglio di un
 * cerchio muto — e infinitamente meglio del fenicottero uguale per tutti.
 *
 * Si prende il primo carattere con lo spread e non con charAt perche' un nome
 * che inizia per emoji o per lettera fuori dal latino occupa due unita': con
 * charAt uscirebbe mezzo carattere, cioe' un rettangolo vuoto.
 */
export function primaLettera(testo: string | null | undefined): string {
  const base = testoUtile(testo)
  if (!base) return '?'
  const primo = [...base][0]
  return primo ? primo.toUpperCase() : '?'
}

/** L'iniziale dell'account: usata sulla Home, dove un viaggio non c'e' ancora. */
export function inizialeAccount(utente: DatiAccount | null | undefined): string {
  return primaLettera(nomeAccount(utente) ?? testoUtile(utente?.email))
}
