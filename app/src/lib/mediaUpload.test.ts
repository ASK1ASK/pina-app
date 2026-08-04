import { describe, expect, it, vi } from 'vitest'

// Il modulo crea un client Supabase all'import, che pretende le variabili
// d'ambiente. Qui si prova solo la logica di riconoscimento dei file, che non
// tocca la rete: il client viene sostituito con un finto.
vi.mock('./supabase', () => ({
  supabase: { storage: { from: () => ({}) } },
}))

const { isDocumentUrl, isStoragePath } = await import('./mediaUpload')

describe('isStoragePath — distinguere il nuovo dal vecchio', () => {
  it('riconosce un percorso nel magazzino', () => {
    expect(isStoragePath('3f1c8e2a-0000-4000-8000-000000000001/abc.jpg')).toBe(true)
  })

  // I file caricati prima di questo cantiere restano dov'erano: devono
  // continuare a vedersi senza che nessuno li ricarichi.
  it('lascia stare i vecchi allegati salvati come testo', () => {
    expect(isStoragePath('data:image/png;base64,iVBORw0KGgo=')).toBe(false)
    expect(isStoragePath('data:application/pdf;base64,JVBERi0=')).toBe(false)
  })

  it('lascia stare gli indirizzi web e i percorsi assoluti', () => {
    expect(isStoragePath('https://esempio.it/foto.jpg')).toBe(false)
    expect(isStoragePath('/hero.png')).toBe(false)
  })

  it('non si fa ingannare da un valore vuoto', () => {
    expect(isStoragePath('')).toBe(false)
  })
})

describe('isDocumentUrl — documento o immagine', () => {
  // Il punto del problema #11: un PDF disegnato come immagine di sfondo
  // diventava un quadratino grigio vuoto.
  it('riconosce un PDF nel magazzino', () => {
    expect(isDocumentUrl('3f1c8e2a-0000-4000-8000-000000000001/abc.pdf')).toBe(true)
  })

  it('riconosce un PDF anche dietro un link firmato con il token in coda', () => {
    expect(isDocumentUrl('https://x.supabase.co/storage/v1/abc.pdf?token=eyJhbGci')).toBe(true)
  })

  it('tratta le foto come immagini, non come documenti', () => {
    expect(isDocumentUrl('viaggio/foto.jpg')).toBe(false)
    expect(isDocumentUrl('viaggio/qr.png')).toBe(false)
    expect(isDocumentUrl('viaggio/scatto.heic')).toBe(false)
  })

  it('legge il tipo anche dai vecchi allegati salvati come testo', () => {
    expect(isDocumentUrl('data:application/pdf;base64,JVBERi0=')).toBe(true)
    expect(isDocumentUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(false)
  })

  // Meglio mostrarlo come documento apribile che come immagine rotta.
  it('considera documento un tipo che non conosce', () => {
    expect(isDocumentUrl('viaggio/prenotazione.docx')).toBe(true)
  })

  it('non si fa ingannare da un valore vuoto', () => {
    expect(isDocumentUrl('')).toBe(false)
  })
})
