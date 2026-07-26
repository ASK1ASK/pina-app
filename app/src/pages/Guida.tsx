import { Link } from 'react-router-dom'

interface GuideSection {
  icon: string
  title: string
  text: string
}

const screens: GuideSection[] = [
  { icon: '🗺', title: 'Journey', text: 'Il cuore del viaggio: le tappe, una dopo l\'altra. Aggiungine una, scegli il mood, e metti la stellina sulle attività che vuoi vedere anche nel programma di oggi.' },
  { icon: '☀️', title: 'Today', text: 'La vista del giorno corrente: programma, dove dormi stanotte, checklist, spese e ricordi di oggi — tutto in un colpo d\'occhio.' },
  { icon: '🎒', title: 'Checklist', text: 'Cosa c\'è da preparare: una condivisa con tutta la crew (documenti, alloggi, trasporti, prenotazioni + una lista di cose da fare), e "La mia valigia", tutta tua.' },
  { icon: '💰', title: 'Spese', text: 'La cassa comune: chi ha pagato cosa, chi deve a chi. I saldi si aggiornano da soli man mano che aggiungete spese e rimborsi.' },
  { icon: '📸', title: 'Memories', text: 'Foto e video del viaggio, organizzati per giorno e per persona — ci pensa la crew a riempirla.' },
  { icon: '👤', title: 'Profilo', text: 'Il tuo nome e il colore con cui la crew ti riconosce in questo viaggio: puoi cambiarli quando vuoi, anche diversi da un viaggio all\'altro.' },
]

const tips: GuideSection[] = [
  { icon: '🔗', title: 'Invita la crew', text: 'Condividi il link, il QR o il codice dalla schermata di invito. Chi lo riceve sceglie chi essere tra i nomi che hai già messo in lista, oppure si aggiunge come persona nuova.' },
  { icon: '🟢', title: 'Chi è online ora', text: 'Su Journey vedi gli avatarini di chi sta guardando il viaggio in questo momento — utile quando state organizzando insieme, in tempo reale.' },
  { icon: '⚙️', title: 'Un viaggio, un organizzatore', text: 'Solo chi ha creato il viaggio può modificarne durata, mood, copertina e crew, o eliminarlo — dall\'icona impostazioni su Journey.' },
]

export function Guida() {
  return (
    <div className="mx-auto min-h-svh max-w-md bg-[var(--color-cream)] px-4.5 pb-12 pt-8 text-[var(--color-text)]">
      <div className="mb-4.5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1.5 font-display text-[19px] font-semibold italic text-[var(--color-coral)]">🦩 Piña</Link>
        <Link to="/" className="whitespace-nowrap rounded-xl border border-[var(--color-card-border)] bg-white px-3.5 py-1.75 text-xs font-bold text-[var(--color-text)]">🏠 Home</Link>
      </div>

      <div className="mb-1.5 text-3xl">🧭</div>
      <div className="mb-1.5 font-display text-2xl font-semibold">Come funziona Piña</div>
      <div className="mb-6.5 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-secondary)]">
        La guida veloce per organizzare un viaggio di gruppo senza impazzire — sei schermate, ognuna con il suo compito.
      </div>

      <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Le schermate del viaggio</div>
      <div className="mb-6.5 flex flex-col gap-2.5">
        {screens.map((s) => (
          <div key={s.title} className="flex gap-3 rounded-[20px] border border-[var(--color-card-border)] bg-white p-3.5 shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
            <span className="shrink-0 text-xl">{s.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 font-display text-[14.5px] font-bold">{s.title}</div>
              <div className="text-[12px] font-semibold leading-snug text-[var(--color-text-secondary)]">{s.text}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Consigli pratici</div>
      <div className="mb-6.5 flex flex-col gap-2.5">
        {tips.map((t) => (
          <div key={t.title} className="rounded-[20px] p-4 text-white shadow-[0_14px_28px_-18px_rgba(217,72,31,.4)]" style={{ background: 'linear-gradient(135deg,#ff8a5b,#d9481f)' }}>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-lg">{t.icon}</span>
              <span className="font-display text-[14.5px] font-bold">{t.title}</span>
            </div>
            <div className="text-[12px] font-semibold leading-snug text-white/90">{t.text}</div>
          </div>
        ))}
      </div>

      <Link to="/onboarding?step=createTrip" className="block rounded-full py-3.5 text-center text-[13.5px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' }}>
        Crea il tuo viaggio
      </Link>
    </div>
  )
}
