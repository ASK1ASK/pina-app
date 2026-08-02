import { moodDefs, type MoodId } from '../../lib/palette'

export type OnboardingStep =
  | 'splash'
  | 'welcome'
  | 'login'
  | 'yourName'
  | 'createTrip'
  | 'preparing'
  | 'cover'
  | 'invite'
  | 'crewForming'
  | 'ritual'
  | 'joinCode'
  | 'join'
  | 'whoAreYou'
  | 'enteredGuest'

export interface CrewMember {
  name: string
  status: 'joined' | 'pending'
}

export interface CustomMood {
  id: string
  label: string
}

export interface OnboardingState {
  step: OnboardingStep
  recapMode: boolean
  editReturnStep: OnboardingStep | null
  tripName: string
  monthIndex: number
  // Date complete (YYYY-MM-DD) e non semplici numeri del giorno: cosi' la
  // selezione sopravvive al cambio di mese nel calendario e un viaggio puo'
  // scavalcare mese e anno (es. 28 dicembre -> 4 gennaio). Il formato ISO si
  // confronta correttamente anche come stringa.
  startISO: string | null
  endISO: string | null
  moodIds: string[]
  customMoods: CustomMood[]
  participants: string[]
  addingMood: boolean
  preparingIndex: number
  crew: CrewMember[] | null
  qrOpen: boolean
  linkCopied: boolean
  codeCopied: boolean
  identityName: string
  identityEmoji: string
  identityColorId: string
  vibe: string
  authMethod: 'email' | 'phone' | null
  joinError: string | null
  cameraOpen: boolean
  loginIntent: 'create' | 'access' | 'join'
  coverColorId: string
  deleteConfirmOpen: boolean
  coverPickerOpen: boolean
  uploadMenuOpen: boolean
  coverPhoto: string | null
}

export function initialOnboardingState(search: URLSearchParams): OnboardingState {
  const recap = search.get('step') === 'recap'
  const stepParam = search.get('step')
  const forcedStep =
    stepParam === 'welcome' || stepParam === 'createTrip' || stepParam === 'joinCode' || stepParam === 'login'
      ? stepParam
      : null
  const intentParam = search.get('intent')
  const loginIntent = intentParam === 'access' || intentParam === 'join' ? intentParam : 'create'

  let coverColorId = 'fiesta'
  if (recap) {
    try {
      const stored = JSON.parse(localStorage.getItem('pina-journey-colors') || '{}') || {}
      coverColorId = stored['spain-roadtrip'] || 'fiesta'
    } catch {
      coverColorId = 'fiesta'
    }
  }

  return {
    step: recap ? 'cover' : forcedStep || 'splash',
    recapMode: recap,
    editReturnStep: null,
    tripName: recap ? 'Spain Roadtrip' : '',
    monthIndex: 1,
    startISO: recap ? '2026-08-14' : null,
    endISO: recap ? '2026-08-26' : null,
    moodIds: [],
    customMoods: [],
    participants: recap ? ['Marco', 'Sara', 'Giulia'] : [],
    addingMood: false,
    preparingIndex: 0,
    crew: recap
      ? [
          { name: 'Marco', status: 'joined' },
          { name: 'Sara', status: 'joined' },
          { name: 'Giulia', status: 'pending' },
        ]
      : null,
    qrOpen: false,
    linkCopied: false,
    codeCopied: false,
    identityName: recap ? 'Andrea' : '',
    identityEmoji: '😎',
    identityColorId: 'coral',
    vibe: 'chill',
    authMethod: null,
    joinError: null,
    cameraOpen: false,
    loginIntent,
    coverColorId,
    deleteConfirmOpen: false,
    coverPickerOpen: false,
    uploadMenuOpen: false,
    coverPhoto: null,
  }
}

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

export interface MonthDef {
  label: string
  short: string
  days: number
  leadingBlanks: number
  year: number
  month: number // 0-indexed, come Date
}

export function buildMonthDefs(): MonthDef[] {
  const defs: MonthDef[] = []
  let y = 2026
  let m = 6 // luglio 2026
  while (y < 2031) {
    const firstWeekday = new Date(y, m, 1).getDay() // 0=Sun..6=Sat
    const leadingBlanks = (firstWeekday + 6) % 7 // Monday-first count
    defs.push({
      label: `${MONTH_NAMES[m]} ${y}`,
      short: MONTH_NAMES[m].toLowerCase(),
      days: new Date(y, m + 1, 0).getDate(),
      leadingBlanks,
      year: y,
      month: m,
    })
    m++
    if (m > 11) {
      m = 0
      y++
    }
  }
  return defs
}

// YYYY-MM-DD per le colonne `date` di Supabase.
export function isoDate(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

export const preparingPhrases = [
  'Preparando il tuo viaggio...',
  'Generando la cover...',
  'Impacchettando i ricordi...',
  'Quasi pronto...',
]

export function allMoodDefs(customMoods: CustomMood[]) {
  return [
    ...moodDefs.map((m) => ({ ...m, custom: false as const })),
    ...customMoods.map((m) => ({ ...m, custom: true as const })),
  ]
}

export function moodLabelFor(id: string, customMoods: CustomMood[]) {
  const found = [...moodDefs, ...customMoods].find((m) => m.id === id)
  return found?.label
}

// ---------------------------------------------------------------------------
// Ritorno dal link di accesso via email.
//
// Toccando il link nella mail si esce dall'app e si rientra: senza questo, chi
// aveva gia' scritto nome, date, mood e crew se li ritroverebbe azzerati. Si usa
// localStorage e non sessionStorage perche' il link spesso apre una scheda
// nuova, e sessionStorage non e' condiviso fra schede.
// ---------------------------------------------------------------------------

const RIPRESA_KEY = 'pina-onboarding-ripresa'
/** Oltre un'ora il dato e' verosimilmente di un tentativo abbandonato. */
const RIPRESA_VALIDITA_MS = 60 * 60 * 1000

export function salvaStatoPerRitorno(state: OnboardingState) {
  try {
    localStorage.setItem(RIPRESA_KEY, JSON.stringify({ salvatoIl: Date.now(), state }))
  } catch {
    // spazio esaurito o modalita' privata: si perde la ripresa, non e' critico
  }
}

/**
 * Restituisce lo stato salvato una sola volta, poi lo cancella.
 *
 * Va chiamata quando compare la sessione, non guardando l'indirizzo: supabase-js
 * rimuove il token dall'URL appena si avvia, quindi al momento del primo
 * disegno della pagina quel segnale non c'e' gia' piu'.
 */
export function riprendiStatoSalvato(): OnboardingState | null {
  try {
    const raw = localStorage.getItem(RIPRESA_KEY)
    if (!raw) return null
    localStorage.removeItem(RIPRESA_KEY)
    const dato = JSON.parse(raw)
    if (!dato?.state) return null
    if (Date.now() - (dato.salvatoIl || 0) > RIPRESA_VALIDITA_MS) return null
    return dato.state as OnboardingState
  } catch {
    return null
  }
}

export type { MoodId }
