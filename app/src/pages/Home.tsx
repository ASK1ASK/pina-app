import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ColorPickerSheet, UploadMenuSheet } from '../components/CoverPickerSheets'
import {
  coverGradientById,
  loadStoredColors,
  saveStoredColorFor,
  slugify,
  type CoverColorId,
} from '../lib/palette'

type JourneyStatus = 'live' | 'draft' | 'planned' | 'completed'

interface JourneyDef {
  id: string
  name: string
  sub: string
  status: JourneyStatus
  href: string
  photo?: string
}

// TEMPO 0 — un utente nuovo ha in media 1 viaggio appena creato, non 4 di status diversi.
const journeyDefs: JourneyDef[] = [
  {
    id: 'spain',
    name: 'Spain Roadtrip',
    sub: '14 → 26 agosto · 5 Crew',
    status: 'live',
    href: '/trip/spain/journey',
  },
]

const statusMeta: Record<JourneyStatus, string> = {
  live: '🟢 Live',
  draft: '🟡 Draft',
  planned: '📅 Planned',
  completed: '✅ Completed',
}

const userName = 'Andrea'

export function Home() {
  const [journeyColors, setJourneyColors] = useState<Record<string, CoverColorId>>({
    spain: 'fiesta',
  })
  const [customPhotos, setCustomPhotos] = useState<Record<string, string>>({})
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false)

  useEffect(() => {
    const stored = loadStoredColors()
    setJourneyColors((prev) => {
      const merged = { ...prev }
      journeyDefs.forEach((j) => {
        const slug = slugify(j.name)
        if (stored[slug]) merged[j.id] = stored[slug] as CoverColorId
      })
      return merged
    })
  }, [])

  const hasJourneys = journeyDefs.length > 0

  function selectColor(id: CoverColorId) {
    if (!pickerFor) return
    const journeyDef = journeyDefs.find((j) => j.id === pickerFor)
    setJourneyColors((prev) => ({ ...prev, [pickerFor]: id }))
    if (journeyDef) saveStoredColorFor(journeyDef.name, id)
    setPickerFor(null)
  }

  function onCoverFileChosen(file: File) {
    if (!pickerFor) return
    const reader = new FileReader()
    reader.onload = () => {
      setCustomPhotos((prev) => ({ ...prev, [pickerFor]: reader.result as string }))
      setUploadMenuOpen(false)
      setPickerFor(null)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="mx-auto min-h-svh max-w-md bg-[var(--color-cream)] px-4.5 pb-10 pt-8 text-[var(--color-text)]">
      <div className="mb-4.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-display text-[19px] font-semibold italic text-[var(--color-coral)]">
          🦩 Piña
        </div>
        <Link
          to={`/trip/${journeyDefs[0]?.id ?? 'demo'}/profilo`}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[15px]"
          style={{ background: 'linear-gradient(135deg,#ffb627,#ff5f6d)' }}
        >
          🦩
        </Link>
      </div>

      <div className="mb-0.5 font-display text-2xl font-semibold">Ciao, {userName}</div>
      <div className="mb-5.5 text-xs font-semibold text-[var(--color-text-secondary)]">Le tue avventure</div>

      {hasJourneys ? (
        <>
          <div className="flex flex-col gap-3">
            {journeyDefs.map((j) => {
              const customPhoto = customPhotos[j.id]
              const hasPhoto = !!j.photo || !!customPhoto
              const photo = customPhoto || j.photo
              const gradient = hasPhoto
                ? 'linear-gradient(135deg,#7a9d54,#4f8f4f)'
                : coverGradientById[journeyColors[j.id]] || coverGradientById.fiesta

              return (
                <div
                  key={j.id}
                  className="relative h-28 overflow-hidden rounded-[22px] shadow-[0_10px_22px_-14px_rgba(120,90,40,.3)]"
                >
                  <Link to={j.href} className="absolute inset-0 block">
                    <div className="absolute inset-0" style={{ background: gradient }} />
                    {hasPhoto && photo && (
                      <div
                        className="absolute inset-0 bg-cover bg-center opacity-55"
                        style={{ backgroundImage: `url(${photo})` }}
                      />
                    )}
                    <div className="relative z-10 flex h-full flex-col justify-between px-4 py-3.5 text-white">
                      <div className="flex items-start justify-between">
                        <div className="font-display text-[19px] font-bold leading-tight">{j.name}</div>
                        <span className="shrink-0 rounded-full bg-black/28 px-2.5 py-1 text-[10.5px] font-bold">
                          {statusMeta[j.status]}
                        </span>
                      </div>
                      <div className="text-[11.5px] font-semibold text-white/85">{j.sub}</div>
                    </div>
                  </Link>
                  {!hasPhoto && (
                    <button
                      type="button"
                      className="absolute bottom-2.5 right-2.5 z-20 flex h-6.5 w-6.5 items-center justify-center rounded-full bg-black/28 text-[13px] text-white"
                      onClick={() => setPickerFor(j.id)}
                    >
                      🎨
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-3.5 flex items-center gap-3 rounded-[18px] bg-[#1e2a4a] px-4 py-3.5 text-white shadow-[0_10px_22px_-14px_rgba(30,42,74,.5)]">
            <span className="shrink-0 text-xl">🧭</span>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 font-display text-[14.5px] font-semibold leading-tight">
                La tua guida a Piña
              </div>
              <div className="text-[11px] font-semibold text-white/65">
                Scopri come viaggiare insieme con Piña
              </div>
            </div>
            <span className="shrink-0 text-base text-white/50">›</span>
          </div>

          <Link
            to="/onboarding?step=createTrip"
            className="mt-3.5 block rounded-full border-[1.5px] border-dashed border-[var(--color-add-border)] py-3.5 text-center text-[13px] font-bold text-[var(--color-add-text)]"
          >
            + Crea viaggio
          </Link>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <Link
            to="/onboarding?step=createTrip"
            className="block rounded-[22px] px-5 py-5.5 text-white shadow-[0_14px_28px_-16px_rgba(255,150,60,.45)]"
            style={{ background: 'linear-gradient(135deg,#ffb627,#ff8a5b)' }}
          >
            <div className="mb-2 text-2xl">🦩</div>
            <div className="mb-1 font-display text-[17px] font-bold">Un nuovo viaggio nel cassetto?</div>
            <div className="text-xs font-semibold text-white/90">Tira fuori Piña.</div>
          </Link>
          <Link
            to="/onboarding?step=createTrip"
            className="block rounded-[22px] px-5 py-5.5 text-white shadow-[0_14px_28px_-16px_rgba(50,140,170,.4)]"
            style={{ background: 'linear-gradient(135deg,#2fbfae,#2a8fd8)' }}
          >
            <div className="mb-2 text-2xl">🗺</div>
            <div className="mb-1 font-display text-[17px] font-bold">Disegna la mappa, invita chi vuoi.</div>
            <div className="text-xs font-semibold text-white/90">Parti con Piña.</div>
          </Link>
          <Link
            to="/onboarding?step=createTrip"
            className="block rounded-[22px] px-5 py-5.5 text-white shadow-[0_14px_28px_-16px_rgba(80,120,60,.4)]"
            style={{ background: 'linear-gradient(135deg,#7a9d54,#4f8f4f)' }}
          >
            <div className="mb-2 text-2xl">🌅</div>
            <div className="mb-1 font-display text-[17px] font-bold">Pronti a esplorare?</div>
            <div className="text-xs font-semibold text-white/90">La tua nuova avventura inizia da qui.</div>
          </Link>
        </div>
      )}

      {pickerFor && !uploadMenuOpen && (
        <ColorPickerSheet
          selectedId={journeyColors[pickerFor]}
          onSelect={selectColor}
          onOpenUpload={() => setUploadMenuOpen(true)}
          onClose={() => setPickerFor(null)}
        />
      )}

      {uploadMenuOpen && pickerFor && (
        <UploadMenuSheet
          onPickCamera={onCoverFileChosen}
          onPickLibrary={onCoverFileChosen}
          onPickFile={onCoverFileChosen}
          onClose={() => setUploadMenuOpen(false)}
        />
      )}
    </div>
  )
}
