import { describe, expect, it } from 'vitest'
import { inizialeAccount, nomeAccount, nomeBreve } from './accountIdentity'

describe('il nome dell account', () => {
  it('preferisce il nome vero di Google al pezzo prima della chiocciola', () => {
    // Il difetto da cui nasce questo lavoro: si salutava "Ciao, Andrea.scribani"
    expect(
      nomeAccount({ email: 'andrea.scribani@yahoo.com', user_metadata: { full_name: 'Andrea Scribani' } }),
    ).toBe('Andrea Scribani')
  })

  it('accetta name quando full_name non arriva', () => {
    expect(nomeAccount({ email: 'a@b.it', user_metadata: { name: 'Giuseppe' } })).toBe('Giuseppe')
  })

  it('ripiega sull email solo quando Google non manda nessun nome', () => {
    expect(nomeAccount({ email: 'andrea.scribani@yahoo.com', user_metadata: {} })).toBe('Andrea.scribani')
  })

  it('ignora i campi presenti ma vuoti invece di mostrarli', () => {
    // user_metadata puo' contenere la chiave con dentro una stringa di spazi:
    // senza questo controllo il saluto diventava "Ciao, " e basta.
    expect(nomeAccount({ email: 'marta@esempio.it', user_metadata: { full_name: '   ', name: 'Marta' } })).toBe('Marta')
  })

  it('non inventa un nome se non c e ne nome ne email', () => {
    expect(nomeAccount({ user_metadata: {} })).toBeNull()
    expect(nomeAccount(null)).toBeNull()
  })

  it('per il saluto usa solo il primo pezzo', () => {
    expect(nomeBreve({ user_metadata: { full_name: 'Andrea Scribani' } })).toBe('Andrea')
  })
})

describe('l iniziale dentro il tondo', () => {
  it('e la prima lettera del nome, maiuscola', () => {
    expect(inizialeAccount({ user_metadata: { full_name: 'giuseppe' } })).toBe('G')
  })

  it('ripiega sull email quando il nome manca', () => {
    expect(inizialeAccount({ email: 'marta@esempio.it', user_metadata: {} })).toBe('M')
  })

  it('non resta mai vuota', () => {
    expect(inizialeAccount({ user_metadata: {} })).toBe('?')
    expect(inizialeAccount(undefined)).toBe('?')
  })

  it('non spezza a meta un nome che inizia con un carattere lungo', () => {
    // Con charAt(0) uscirebbe mezzo carattere, cioe' un rettangolo vuoto.
    expect(inizialeAccount({ user_metadata: { full_name: '🦩 Pina' } })).toBe('🦩')
    expect(inizialeAccount({ user_metadata: { full_name: 'Élodie' } })).toBe('É')
  })
})
