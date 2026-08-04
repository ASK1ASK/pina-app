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

/**
 * Nemmeno i documenti si comprimono, e il bucket non ha un limite suo: senza un
 * tetto qui, un PDF da 80 MB caricato in roaming parte davvero. Un biglietto o
 * una prenotazione stanno molto sotto i 10 MB.
 */
const MAX_DOC_MB = 10

/** Content-type per estensione, per quando il telefono non lo dichiara. */
const TIPO_PER_ESTENSIONE: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  gif: 'image/gif',
}

function estensioneDi(nome: string): string {
  const punto = nome.lastIndexOf('.')
  return punto > 0 ? nome.slice(punto + 1).toLowerCase() : ''
}

/**
 * Foto, video o documento.
 *
 * Il ramo dei documenti serve: prima tutto cio' che non era video passava da
 * compressImage e veniva salvato con estensione .jpg e content-type
 * image/jpeg. Un PDF ci passava attraverso senza errori — compressImage, su un
 * formato che il browser non sa decodificare, restituisce l'originale — e
 * finiva nello storage travestito da immagine: si caricava benissimo e non si
 * apriva mai.
 */
function genereDi(file: File): 'video' | 'immagine' | 'documento' {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('image/')) return 'immagine'
  // Alcuni selettori di file su Android non dichiarano il tipo: si ripiega
  // sull'estensione invece di trattare una foto come un documento.
  if (!file.type && TIPO_PER_ESTENSIONE[estensioneDi(file.name)]?.startsWith('image/')) return 'immagine'
  return 'documento'
}

/** Un percorso nello storage, distinto dai vecchi contenuti salvati come testo. */
export function isStoragePath(url: string): boolean {
  return !!url && !url.startsWith('data:') && !url.startsWith('http') && !url.startsWith('/')
}

/**
 * Un allegato da mostrare come documento e non come anteprima visiva.
 *
 * Funziona sia sui percorsi nuovi (l'estensione e' nel nome del file) sia sui
 * vecchi allegati salvati come testo dentro il database, che restano validi e
 * non vanno migrati.
 */
export function isDocumentUrl(url: string): boolean {
  if (!url) return false
  if (url.startsWith('data:')) return !url.startsWith('data:image/')
  // Un link firmato porta il token in coda: l'estensione sta prima del '?'.
  const estensione = estensioneDi(url.split('?')[0])
  return !!estensione && !TIPO_PER_ESTENSIONE[estensione]?.startsWith('image/')
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
  const genere = genereDi(file)

  if (genere === 'video' && file.size > MAX_VIDEO_MB * 1024 * 1024) {
    throw new Error(`Il video supera i ${MAX_VIDEO_MB} MB. Caricane uno piu' corto.`)
  }
  if (genere === 'documento' && file.size > MAX_DOC_MB * 1024 * 1024) {
    throw new Error(`Il documento supera i ${MAX_DOC_MB} MB. Prova con una versione piu' leggera.`)
  }

  // Solo le foto si rimpiccioliscono. Video e documenti partono come sono, con
  // la loro estensione e il loro content-type veri: un PDF salvato come .jpg
  // si carica senza errori e poi non si apre piu'.
  const corpo = genere === 'immagine' ? await compressImage(file) : file
  const estensione =
    genere === 'immagine' ? 'jpg' : estensioneDi(file.name) || (genere === 'video' ? 'mp4' : 'bin')
  const contentType =
    genere === 'immagine'
      ? 'image/jpeg'
      : file.type || TIPO_PER_ESTENSIONE[estensione] || 'application/octet-stream'

  // Il viaggio come prima cartella: le regole di sicurezza leggono da qui a
  // quale viaggio appartiene il file (vedi migrazione 0007).
  const percorso = `${tripId}/${crypto.randomUUID()}.${estensione}`

  const { error } = await supabase.storage.from(BUCKET).upload(percorso, corpo, {
    contentType,
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
