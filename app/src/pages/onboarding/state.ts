import { moodDefs, type MoodId } from '../../lib/palette'

export type OnboardingStep =
  | 'splash'
  | 'welcome'
  | 'login'
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
  startDay: number | null
  endDay: number | null
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
    stepParam === 'welcome' || stepParam === 'createTrip' || stepParam === 'joinCode' ? stepParam : null

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
    startDay: recap ? 14 : null,
    endDay: recap ? 26 : null,
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
    loginIntent: 'create',
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

export type { MoodId }
