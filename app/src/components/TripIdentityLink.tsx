import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar } from './Avatar'
import { inizialeAccount, primaLettera } from '../lib/accountIdentity'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabase'
import { isUuid } from '../lib/uuid'

/**
 * Il livello VIAGGIO, in alto a destra: chi sei in QUESTA crew.
 *
 * Nome e colore sono quelli scelti qui dentro (trip_members), non quelli
 * dell'account Google: sono gli stessi che vedono gli altri membri, ed e' il
 * senso della decisione del 26/07. Sulla Home, dove un viaggio non c'e', il
 * tondo mostra invece l'account — sono due cose diverse di proposito.
 *
 * Prende solo la propria riga, non tutta la crew: una richiesta minuscola, e
 * non obbliga le cinque pagine a passarsi i membri fra loro.
 */
export function TripIdentityLink() {
  const { tripId } = useParams()
  const { session } = useAuth()
  const [io, setIo] = useState<{ id: string; nome: string; colore: string } | null>(null)

  useEffect(() => {
    const utenteId = session?.user?.id
    if (!tripId || !isUuid(tripId) || !utenteId) {
      setIo(null)
      return
    }
    let annullato = false
    supabase
      .from('trip_members')
      .select('id, display_name, color')
      .eq('trip_id', tripId)
      .eq('user_id', utenteId)
      .maybeSingle()
      .then(({ data }) => {
        if (annullato || !data) return
        setIo({ id: data.id, nome: data.display_name, colore: data.color })
      })
    return () => {
      annullato = true
    }
  }, [tripId, session?.user?.id])

  if (!tripId) return null

  // Finche' la riga non e' arrivata (o sul viaggio dimostrativo, che su
  // Supabase non esiste) si mostra l'iniziale dell'account: il tondo non
  // sfarfalla e non resta mai vuoto.
  const iniziale = io ? primaLettera(io.nome) : inizialeAccount(session?.user)
  const chiaveColore = io?.id ?? session?.user?.id ?? tripId

  return (
    <Link to={`/trip/${tripId}/profilo`} aria-label="Il tuo profilo in questo viaggio" className="rounded-full">
      <Avatar personId={chiaveColore} initial={iniziale} size={32} color={io?.colore} />
    </Link>
  )
}
