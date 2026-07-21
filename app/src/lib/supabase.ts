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

// TODO: rimuovere quando il debug in produzione non serve più.
// Espone il client sulla console del browser (window.supabase) per poter
// diagnosticare problemi di auth/RLS anche sul sito pubblicato.
if (typeof window !== 'undefined') {
  ;(window as typeof window & { supabase?: typeof supabase }).supabase = supabase
}
