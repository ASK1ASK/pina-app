import { supabase } from './supabase'

// Caricamento di foto e video nello storage di Supabase invece che dentro una
// colonna del database. Le immagini vengono rimpicciolite prima di partire:
// una foto da telefono passa da qualche megabyte a poche centinaia di
// kilobyte, il che significa caricamenti piu' rapidi in viaggio e molto meno
// spazio occupato.

const BUCKET = 'trip-media'

/** Lato piu' lungo massimo per le foto: oltre non serve, su telefono. */
const LATO_MASSIMO = 1600
const QUALITA_JPEG = 0.82

/** I video non si comprimono nel browser: meglio fermarli se troppo pesanti. */
const MAX_VIDEO_MB = 25

/** Un percorso nello storage, distinto dai vecchi contenuti salvati come testo. */
export function isStoragePath(url: string): boolean {
  return !!url && !url.startsWith('data:') && !url.startsWith('http') && !url.startsWith('/')
}

export async function compressImage(file: File | Blob): Promise<Blob> {
  try {
    // `from-image` rispetta l'orientamento EXIF: senza, le foto scattate in
    // verticale finirebbero ruotate.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scala = Math.min(1, LATO_MASSIMO / Math.max(bitmap.width, bitmap.height))
    const larghezza = Math.round(bitmap.width * scala)
    const altezza = Math.round(bitmap.height * scala)

    const canvas = document.createElement('canvas')
    canvas.width = larghezza
    canvas.height = altezza
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, larghezza, altezza)
    bitmap.close?.()

    const compressa = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITA_JPEG))
    // Se per qualche motivo la compressione peggiora le cose, si tiene l'originale.
    return compressa && compressa.size < file.size ? compressa : file
  } catch {
    // Formati che il browser non sa decodificare (heic non supportato, file
    // corrotti): si carica l'originale invece di bloccare tutto.
    return file
  }
}

/** Carica il file e restituisce il percorso da salvare nel database. */
export async function uploadTripMedia(tripId: string, file: File): Promise<string> {
  const isVideo = file.type.startsWith('video')

  if (isVideo && file.size > MAX_VIDEO_MB * 1024 * 1024) {
    throw new Error(`Il video supera i ${MAX_VIDEO_MB} MB. Caricane uno piu' corto.`)
  }

  const corpo = isVideo ? file : await compressImage(file)
  const estensione = isVideo ? file.name.split('.').pop()?.toLowerCase() || 'mp4' : 'jpg'
  // Il viaggio come prima cartella: le regole di sicurezza leggono da qui a
  // quale viaggio appartiene il file (vedi migrazione 0007).
  const percorso = `${tripId}/${crypto.randomUUID()}.${estensione}`

  const { error } = await supabase.storage.from(BUCKET).upload(percorso, corpo, {
    contentType: isVideo ? file.type : 'image/jpeg',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return percorso
}

/**
 * Indirizzi temporanei per mostrare i file: il bucket e' privato, quindi le
 * foto non sono visibili a chi non fa parte del viaggio.
 */
export async function signedUrls(paths: string[], secondi = 3600): Promise<Record<string, string>> {
  const daFirmare = paths.filter(isStoragePath)
  if (daFirmare.length === 0) return {}

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(daFirmare, secondi)
  if (error || !data) return {}

  const mappa: Record<string, string> = {}
  data.forEach((r) => {
    if (r.path && r.signedUrl) mappa[r.path] = r.signedUrl
  })
  return mappa
}

/** Rimuove un file; un errore qui non deve bloccare l'operazione principale. */
export async function removeTripMedia(path: string): Promise<void> {
  if (!isStoragePath(path)) return
  await supabase.storage.from(BUCKET).remove([path])
}
