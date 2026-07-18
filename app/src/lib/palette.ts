export type CoverColorId =
  | 'fiesta'
  | 'sunrise'
  | 'romantic'
  | 'terracotta'
  | 'relax'
  | 'culture'
  | 'camper'
  | 'nature'
  | 'beach'

export const coverPaletteDefs: { id: CoverColorId; gradient: string }[] = [
  { id: 'fiesta', gradient: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)' },
  { id: 'sunrise', gradient: 'linear-gradient(135deg,#ffb627,#ff5f6d)' },
  { id: 'romantic', gradient: 'linear-gradient(135deg,#ff5f96,#ff5f6d)' },
  { id: 'terracotta', gradient: 'linear-gradient(135deg,#d9481f,#8a2f42)' },
  { id: 'relax', gradient: 'linear-gradient(135deg,#ffb627,#ff8a5b)' },
  { id: 'culture', gradient: 'linear-gradient(135deg,#e8b74e,#b8792e)' },
  { id: 'camper', gradient: 'linear-gradient(135deg,#7a9d54,#4f8f4f)' },
  { id: 'nature', gradient: 'linear-gradient(135deg,#4f8f4f,#2d6a4f)' },
  { id: 'beach', gradient: 'linear-gradient(135deg,#2fbfae,#2a8fd8)' },
]

export const coverGradientById: Record<string, string> = Object.fromEntries(
  coverPaletteDefs.map((p) => [p.id, p.gradient]),
)

export type MoodId = 'fiesta' | 'beach' | 'camper' | 'food' | 'nature' | 'romantic' | 'study' | 'culture' | 'relax'

export const moodDefs: { id: MoodId; label: string }[] = [
  { id: 'fiesta', label: '🎉 Festival' },
  { id: 'beach', label: '🌊 Mare' },
  { id: 'camper', label: '🏕 Camper' },
  { id: 'food', label: '🍷 Food' },
  { id: 'nature', label: '🌄 Natura' },
  { id: 'romantic', label: '😍 Romantico' },
  { id: 'study', label: '📚 Studio' },
  { id: 'culture', label: '🏛 Cultura' },
  { id: 'relax', label: '🎡 Relax' },
]

export const moodGradients: Record<string, string> = {
  fiesta: 'linear-gradient(135deg,#ff8a5b,#ff5f6d)',
  beach: 'linear-gradient(135deg,#2fbfae,#2a8fd8)',
  camper: 'linear-gradient(135deg,#7a9d54,#4f8f4f)',
  food: 'linear-gradient(135deg,#c2445a,#8a2f42)',
  nature: 'linear-gradient(135deg,#4f8f4f,#2d6a4f)',
  romantic: 'linear-gradient(135deg,#ff5f96,#ff5f6d)',
  study: 'linear-gradient(135deg,#8a6a3e,#5a4326)',
  culture: 'linear-gradient(135deg,#e8b74e,#b8792e)',
  relax: 'linear-gradient(135deg,#ffb627,#ff8a5b)',
}

export const identityColorDefs = [
  { id: 'coral', hex: '#ff8a5b' },
  { id: 'teal', hex: '#3ddbc5' },
  { id: 'green', hex: '#7a9d54' },
  { id: 'pink', hex: '#ff5f96' },
  { id: 'yellow', hex: '#ffb627' },
]

export const vibeDefs = [
  { id: 'chill', emoji: '😎', label: 'Chill' },
  { id: 'party', emoji: '🍻', label: 'Party' },
  { id: 'explorer', emoji: '📸', label: 'Explorer' },
  { id: 'beach', emoji: '🌊', label: 'Beach' },
  { id: 'camper', emoji: '🏕', label: 'Camper' },
  { id: 'festival', emoji: '🎶', label: 'Festival' },
  { id: 'foodie', emoji: '🍕', label: 'Foodie' },
]

export function slugify(name: string) {
  return (name || 'trip')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function loadStoredColors(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('pina-journey-colors') || '{}') || {}
  } catch {
    return {}
  }
}

export function saveStoredColorFor(name: string, id: string) {
  const stored = loadStoredColors()
  stored[slugify(name)] = id
  try {
    localStorage.setItem('pina-journey-colors', JSON.stringify(stored))
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export function loadStoredPhotos(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('pina-journey-photos') || '{}') || {}
  } catch {
    return {}
  }
}

export function saveStoredPhotoFor(name: string, dataUrl: string | null) {
  const stored = loadStoredPhotos()
  if (dataUrl) stored[slugify(name)] = dataUrl
  else delete stored[slugify(name)]
  try {
    localStorage.setItem('pina-journey-photos', JSON.stringify(stored))
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export function inviteCode(slug: string) {
  let hash = 0
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0
  return 'PINA-' + hash.toString(36).toUpperCase().slice(0, 5)
}
