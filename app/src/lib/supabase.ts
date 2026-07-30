import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variabili Supabase mancanti: imposta VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY in app/.env (vedi .env.example).',
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Supabase non solleva eccezioni quando una query fallisce: restituisce
// { data: null, error }. Leggendo solo `data` un errore di rete diventava una
// lista vuota, indistinguibile da "non c'e' ancora niente" — con il risultato
// che un caricamento fallito sembrava un viaggio senza spese, e un salvataggio
// fallito sembrava riuscito. `unwrap` trasforma l'errore in un'eccezione, che
// le schermate intercettano e mostrano all'utente.
export function unwrap<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  return result.data
}

/** Come unwrap, per insert/update/delete che non restituiscono dati. */
export function unwrapVoid(result: { error: { message: string } | null }): void {
  if (result.error) throw new Error(result.error.message)
}
