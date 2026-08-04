import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
})

/**
 * Tutto quello che l'app lascia sul telefono, via.
 *
 * Non un elenco di chiavi scritto a mano: quelle si aggiungono nel tempo e
 * dimenticarne una significa che la persona successiva eredita pezzi della
 * precedente — la card demo gia' scartata, i colori delle copertine, un
 * onboarding a meta'. Si spazza per prefisso, cosi' vale anche per le chiavi
 * che verranno.
 *
 * `sb-` e' il prefisso del token di supabase-js: normalmente lo cancella
 * signOut(), ma se quella chiamata fallisce (rete assente) la sessione
 * resterebbe sul telefono, ed e' esattamente il caso che vogliamo evitare.
 */
function pulisciDatiLocali() {
  try {
    Object.keys(localStorage)
      .filter((chiave) => chiave.startsWith('pina-') || chiave.startsWith('sb-'))
      .forEach((chiave) => localStorage.removeItem(chiave))
  } catch {
    // modalita' privata o storage negato: non c'e' niente da ripulire
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  async function signOut() {
    try {
      await supabase.auth.signOut()
    } catch {
      // rete assente: la sessione locale viene buttata comunque qui sotto
    }
    pulisciDatiLocali()
    // Ricarica vera, non una navigazione React: azzera anche lo stato in
    // memoria (viaggi gia' caricati, colori, card demo). Chi entra dopo deve
    // trovare l'app come la trova chi non ha mai fatto login.
    window.location.replace('/')
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
