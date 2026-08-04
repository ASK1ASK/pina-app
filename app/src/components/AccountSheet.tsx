import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Avatar } from './Avatar'
import { BottomSheet } from './BottomSheet'
import { inizialeAccount, nomeAccount } from '../lib/accountIdentity'

/**
 * Il livello ACCOUNT: chi sei su Google, non chi sei in un viaggio.
 *
 * Dentro c'e' poco per definizione — l'identita' che conta in quest'app e'
 * quella per viaggio — quindi un pannello dal basso e non una pagina intera.
 *
 * Due tocchi per uscire dall'account: il tondo, poi il pulsante. Nessuna
 * conferma in mezzo di proposito: uscire non distrugge niente, si rientra
 * con lo stesso Google, e chi si passa il telefono di mano deve poterlo fare
 * senza cercare.
 */
export function AccountSheet({ user, onSignOut, onClose }: { user: User; onSignOut: () => void; onClose: () => void }) {
  const [uscendo, setUscendo] = useState(false)
  const nome = nomeAccount(user)

  return (
    <BottomSheet onClose={onClose}>
      <div className="mb-4 flex items-center gap-3.5">
        <Avatar personId={user.id} initial={inizialeAccount(user)} size={52} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-semibold text-[var(--color-text)]">
            {nome ?? 'Il tuo account'}
          </div>
          <div className="truncate text-[11.5px] font-semibold text-[var(--color-text-secondary)]">
            {user.email ?? 'Account Google'}
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-[14px] bg-[var(--color-bg)] px-3.5 py-3 text-[11.5px] font-semibold leading-snug text-[var(--color-text-secondary)]">
        Il nome e il colore che vede la crew li scegli dentro ogni viaggio, dal
        profilo: puoi usarne di diversi in viaggi diversi.
      </div>

      <button
        type="button"
        disabled={uscendo}
        className="w-full rounded-full bg-[var(--color-coral)] py-3.25 text-center text-[13px] font-bold text-white disabled:opacity-60"
        onClick={() => {
          setUscendo(true)
          onSignOut()
        }}
      >
        {uscendo ? 'Esco...' : '🚪 Esci dall’account'}
      </button>

      <button
        type="button"
        className="mt-2 w-full rounded-full py-2.75 text-center text-[12.5px] font-bold text-[var(--color-text-secondary)]"
        onClick={onClose}
      >
        Chiudi
      </button>
    </BottomSheet>
  )
}
