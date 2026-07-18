// Mirrora l'elenco tappe di Journey: la timeline dei giorni parte dalla prima tappa
// e avanza giorno per giorno seguendo le tappe del viaggio.
export interface StopMeta {
  id: string
  name: string
  moodId: string
  moodLine: string
  startDay: number
  endDay: number
  stayName: string
  stayLabel: string
  stayLink: string
}

export const stopsMeta: StopMeta[] = [
  { id: 'girona', name: 'Girona', moodId: 'culture', moodLine: '🏛 Culture', startDay: 14, endDay: 15, stayName: '', stayLabel: '', stayLink: '' },
  { id: 'barcelona', name: 'Barcellona', moodId: 'fiesta', moodLine: '🎉 Fiesta', startDay: 16, endDay: 17, stayName: 'Hotel Casa Fuster', stayLabel: 'Alloggio prenotato', stayLink: 'https://maps.google.com/?q=Hotel+Casa+Fuster+Barcelona' },
  { id: 'valencia', name: 'Valencia', moodId: 'beach', moodLine: '🌊 Beach vibes', startDay: 18, endDay: 19, stayName: '', stayLabel: '', stayLink: '' },
  { id: 'rototom', name: 'Rototom Sunsplash', moodId: 'fiesta', moodLine: '🎶 Festival', startDay: 21, endDay: 22, stayName: '', stayLabel: '', stayLink: '' },
  { id: 'malaga', name: 'Malaga', moodId: 'relax', moodLine: '🌅 Sunset', startDay: 24, endDay: 25, stayName: '', stayLabel: '', stayLink: '' },
]

export const TRIP_START_DAY = 14
export const TRIP_END_DAY = 26

export interface DayScheduleEntry {
  time: string
  emoji: string
  title: string
  note: string | null
}

export interface DayChecklistEntry {
  label: string
  done: boolean
}

export interface DayTicket {
  emoji: string
  label: string
  url: string
}

export interface DayExpense {
  name: string
  amount: number
  initial: string
  color: string
}

interface DayOverride {
  city?: string
  mood?: string
  moodId?: string
  subtitle?: string
  stayName?: string
  stayLabel?: string
  stayLink?: string
  schedule?: DayScheduleEntry[]
  checklist?: DayChecklistEntry[]
  tickets?: DayTicket[]
  usefulLinks?: DayTicket[]
  expenses?: DayExpense[]
  memoryPhotos?: string[]
}

// Contenuto specifico già programmato per alcuni giorni (Programma, Checklist, ecc).
// I giorni non ancora programmati usano contenuti vuoti generati dalla tappa.
export const customDayOverrides: Record<number, DayOverride> = {
  15: {
    city: 'Girona', mood: '🥾 Esplorazione', moodId: 'culture',
    stayName: 'Camper – sosta libera', stayLabel: 'Prima notte', stayLink: 'https://maps.google.com/?q=Girona+Camper',
    schedule: [
      { time: '09:00', emoji: '🥐', title: 'Colazione', note: null },
      { time: '11:00', emoji: '🏛', title: 'Centro storico', note: 'Portare la macchina fotografica' },
      { time: '15:00', emoji: '🍽️', title: 'Pranzo tipico', note: null },
      { time: '20:00', emoji: '🍷', title: 'Cena', note: null },
    ],
    checklist: [
      { label: 'Fare benzina', done: true },
      { label: 'Ritirare camper', done: true },
    ],
    tickets: [],
    usefulLinks: [{ emoji: '🚐', label: 'Camper', url: '/trip/spain/checklist' }],
    expenses: [
      { name: 'Marco', amount: 22, initial: 'M', color: '#ff8a5b' },
      { name: 'Sara', amount: 14, initial: 'S', color: '#7a9d54' },
    ],
    memoryPhotos: ['today-gir-1', 'today-gir-2', 'today-gir-3'],
  },
  16: {
    city: 'Barcellona', mood: '🎉 Fiesta', moodId: 'fiesta', subtitle: 'Il giorno che aspettavamo da mesi.',
    stayName: 'Airbnb Barcellona', stayLabel: 'Check-in fatto · Host Marta', stayLink: 'https://maps.google.com/?q=Hotel+Casa+Fuster+Barcelona',
    schedule: [
      { time: '09:00', emoji: '🥐', title: 'Colazione', note: null },
      { time: '11:00', emoji: '🏖', title: 'Spiaggia', note: 'Barceloneta, ombrellone prenotato' },
      { time: '15:00', emoji: '🏛', title: 'Museo', note: 'Biglietto già acquistato' },
      { time: '20:30', emoji: '🍻', title: 'Bar', note: null },
      { time: '23:00', emoji: '🎶', title: 'Club', note: 'Lista Andrea +4' },
    ],
    checklist: [
      { label: 'Portare costume', done: false },
      { label: 'Comprare ghiaccio', done: false },
      { label: 'Passare in farmacia', done: true },
    ],
    tickets: [
      { emoji: '🎫', label: 'Biglietto Museo', url: '/trip/spain/checklist' },
      { emoji: '🎟', label: 'Biglietto Festival', url: '/trip/spain/checklist' },
    ],
    usefulLinks: [{ emoji: '💬', label: 'Gruppo WhatsApp', url: 'https://wa.me/' }],
    expenses: [
      { name: 'Marco', amount: 35, initial: 'M', color: '#ff8a5b' },
      { name: 'Andrea', amount: 18, initial: 'A', color: '#5b8fff' },
      { name: 'Sara', amount: 9, initial: 'S', color: '#7a9d54' },
    ],
    memoryPhotos: ['today-bcn-1', 'today-bcn-2', 'today-bcn-3', 'today-bcn-4'],
  },
  17: {
    city: 'Barcellona', mood: '🎨 Cultura', moodId: 'fiesta',
    stayName: 'Airbnb Barcellona', stayLabel: 'Seconda notte · Host Marta', stayLink: 'https://maps.google.com/?q=Hotel+Casa+Fuster+Barcelona',
    schedule: [
      { time: '10:00', emoji: '🥐', title: 'Colazione', note: null },
      { time: '12:00', emoji: '🏛', title: 'Sagrada Familia', note: 'Ingresso prenotato online' },
      { time: '17:00', emoji: '🍽️', title: 'La Boqueria', note: null },
      { time: '22:00', emoji: '🍻', title: 'Razzmatazz', note: null },
    ],
    checklist: [{ label: 'Stampare biglietti Sagrada', done: false }],
    tickets: [{ emoji: '🎫', label: 'Sagrada Familia', url: '/trip/spain/checklist' }],
    usefulLinks: [],
    expenses: [],
    memoryPhotos: [],
  },
}

export interface Day {
  dayOfMonth: number
  city: string
  moodId: string
  mood: string
  dateLabel: string
  subtitle: string | null
  stayName: string
  stayLabel: string
  stayLink: string
  schedule: DayScheduleEntry[]
  checklist: DayChecklistEntry[]
  tickets: DayTicket[]
  usefulLinks: DayTicket[]
  expenses: DayExpense[]
  memoryPhotos: string[]
}

function formatDateLabel(dateObj: Date) {
  const str = dateObj.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' })
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function buildDays(): Day[] {
  const days: Day[] = []
  for (let d = TRIP_START_DAY; d <= TRIP_END_DAY; d++) {
    const stop = stopsMeta.find((s) => d >= s.startDay && d <= s.endDay)
    const base = stop
      ? { city: stop.name, moodId: stop.moodId, mood: stop.moodLine, stayName: stop.stayName || 'Da definire', stayLabel: stop.stayLabel || 'Alloggio da confermare', stayLink: stop.stayLink || 'https://maps.google.com' }
      : { city: 'In viaggio', moodId: 'camper', mood: '🚐 Trasferimento', stayName: '—', stayLabel: 'Nessun pernottamento fisso', stayLink: 'https://maps.google.com' }
    const override = customDayOverrides[d] || {}
    days.push({
      dayOfMonth: d,
      city: override.city || base.city,
      moodId: override.moodId || base.moodId,
      mood: override.mood || base.mood,
      dateLabel: formatDateLabel(new Date(2026, 7, d)),
      subtitle: override.subtitle || null,
      stayName: override.stayName || base.stayName,
      stayLabel: override.stayLabel || base.stayLabel,
      stayLink: override.stayLink || base.stayLink,
      schedule: override.schedule || [],
      checklist: override.checklist || [],
      tickets: override.tickets || [],
      usefulLinks: override.usefulLinks || [],
      expenses: override.expenses || [],
      memoryPhotos: override.memoryPhotos || [],
    })
  }
  return days
}

export type DayStatus = 'planned' | 'ready' | 'inprogress' | 'done'
export const statusOrder: DayStatus[] = ['planned', 'ready', 'inprogress', 'done']
export const statusMeta: Record<DayStatus, { icon: string; label: string }> = {
  planned: { icon: '○', label: 'Da pianificare' },
  ready: { icon: '◐', label: 'Pronto' },
  inprogress: { icon: '●', label: 'In corso' },
  done: { icon: '✓', label: 'Completato' },
}

export const mealPresets = [
  { label: 'Colaz', time: '08:00' },
  { label: 'Brunch', time: '10:30' },
  { label: 'Pranzo', time: '13:00' },
  { label: 'Merenda', time: '17:00' },
  { label: 'Ape', time: '19:00' },
  { label: 'Cena', time: '20:30' },
  { label: 'Serata', time: '22:30' },
]

const SCHEDULE_ORDER_KEY = 'pina-schedule-order'

export function loadScheduleOrder(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(SCHEDULE_ORDER_KEY) || '{}')
  } catch {
    return {}
  }
}
export function saveScheduleOrder(order: Record<string, string[]>) {
  try {
    localStorage.setItem(SCHEDULE_ORDER_KEY, JSON.stringify(order))
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
