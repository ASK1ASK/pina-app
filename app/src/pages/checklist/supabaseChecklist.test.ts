import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Un Supabase finto, in memoria, con una cosa in piu' del solito: si puo'
// decidere quanto ci mette a rispondere.
//
// Serve a questo. Il difetto della valigia personale (COLLAUDO #34) non si vede
// guardando una chiamata sola: si vede quando due salvataggi si accavallano, e
// dipende dall'ordine in cui il server risponde. Con le latenze in mano al test
// quell'ordine smette di essere un caso fortunato e diventa riproducibile.
//
// Il finto conosce solo quello che serve qui: le due tabelle della valigia, la
// cascata da sezione a voci, e i pochi pezzi di query che il modulo usa.
// ---------------------------------------------------------------------------

type Riga = Record<string, unknown>

interface Filtro {
  colonna: string
  valore?: unknown
  valori?: unknown[]
}

interface Query {
  tabella: string
  tipo: 'select' | 'insert' | 'update' | 'delete'
  filtri: Filtro[]
  righe?: Riga[]
  patch?: Riga
  singola?: boolean
}

/** I soli pezzi di catena che il modulo usa davvero. */
interface Catena extends PromiseLike<{ data: never; error: null }> {
  select(colonne?: string): Catena
  insert(righe: Riga | Riga[]): Catena
  update(patch: Riga): Catena
  delete(): Catena
  eq(colonna: string, valore: unknown): Catena
  in(colonna: string, valori: unknown[]): Catena
  order(colonna: string): Catena
  single(): Catena
}

let tabelle: Record<string, Riga[]>
let contatore: number
// Quanto ci mette a rispondere la prossima operazione, in millisecondi: il test
// la imposta prima di ogni chiamata per costruire l'accavallamento che vuole.
let latenza: number

function reset() {
  tabelle = { personal_checklist_sections: [], personal_checklist_items: [] }
  contatore = 0
  latenza = 0
}

function corrisponde(riga: Riga, filtri: Filtro[]): boolean {
  return filtri.every((f) => (f.valori ? f.valori.includes(riga[f.colonna]) : riga[f.colonna] === f.valore))
}

function esegui(q: Query): { data: unknown; error: null } {
  const t = tabelle[q.tabella]
  if (q.tipo === 'select') return { data: t.filter((r) => corrisponde(r, q.filtri)), error: null }

  if (q.tipo === 'insert') {
    const prefisso = q.tabella === 'personal_checklist_sections' ? 'sez' : 'voce'
    const nuove = (q.righe || []).map((r) => ({ id: `${prefisso}-${++contatore}`, ...r }))
    t.push(...nuove)
    return { data: q.singola ? nuove[0] : nuove, error: null }
  }

  if (q.tipo === 'update') {
    t.filter((r) => corrisponde(r, q.filtri)).forEach((r) => Object.assign(r, q.patch))
    return { data: null, error: null }
  }

  const tolte = t.filter((r) => corrisponde(r, q.filtri))
  tabelle[q.tabella] = t.filter((r) => !corrisponde(r, q.filtri))
  // La cascata dichiarata nella 0001: cancellando una sezione se ne vanno le
  // sue voci. Senza questo il finto direbbe bugie proprio sul punto in esame.
  if (q.tabella === 'personal_checklist_sections') {
    const ids = tolte.map((r) => r.id)
    tabelle.personal_checklist_items = tabelle.personal_checklist_items.filter((r) => !ids.includes(r.section_id))
  }
  return { data: null, error: null }
}

function builder(q: Query): Catena {
  // La latenza si fissa quando l'operazione parte, non quando viene attesa:
  // cosi' due chiamate lanciate a distanza di poco tengono ciascuna la sua.
  const mia = latenza
  return {
    select: () => builder({ ...q, tipo: q.tipo === 'insert' ? 'insert' : 'select' }),
    insert: (righe) => builder({ ...q, tipo: 'insert', righe: Array.isArray(righe) ? righe : [righe] }),
    update: (patch) => builder({ ...q, tipo: 'update', patch }),
    delete: () => builder({ ...q, tipo: 'delete' }),
    eq: (colonna, valore) => builder({ ...q, filtri: [...q.filtri, { colonna, valore }] }),
    in: (colonna, valori) => builder({ ...q, filtri: [...q.filtri, { colonna, valori }] }),
    order: () => builder(q),
    single: () => builder({ ...q, singola: true }),
    then: (risolvi, rifiuta) =>
      new Promise((r) => setTimeout(() => r(esegui(q)), mia)).then(risolvi as never, rifiuta) as never,
  }
}

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (tabella: string) => builder({ tabella, tipo: 'select', filtri: [] }) },
  unwrap: (r: { data: unknown; error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
  unwrapVoid: (r: { error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message)
  },
}))

const { supabase } = await import('../../lib/supabase')
const db = supabase as unknown as { from: (tabella: string) => Catena }

const {
  createPersonalItem,
  createPersonalSection,
  deletePersonalItem,
  fetchPersonalSections,
  updatePersonalItem,
  updatePersonalSection,
} = await import('./supabaseChecklist')

const VIAGGIO = 'viaggio-1'
const MEMBRO = 'membro-1'
const ALTRO_MEMBRO = 'membro-2'

interface SezioneFinta {
  emoji: string
  name: string
  items: { label: string; done: boolean }[]
}

/**
 * Il metodo vecchio, copiato qui e non importato: nel modulo non esiste piu'.
 *
 * Sta nel test perche' e' la prova del difetto. Cancellare tutte le sezioni del
 * membro e riscriverle da capo funziona finche' i salvataggi sono uno alla
 * volta; i due test qui sotto mostrano cosa succede quando non lo sono, ed e'
 * la ragione per cui questa funzione e' stata tolta dal codice vero.
 */
async function metodoVecchio(tripId: string, memberId: string, sezioni: SezioneFinta[]) {
  await db.from('personal_checklist_sections').delete().eq('trip_id', tripId).eq('member_id', memberId)
  const righe = sezioni.map((s, i) => ({ trip_id: tripId, member_id: memberId, emoji: s.emoji, name: s.name, position: i }))
  const inserite = (await db.from('personal_checklist_sections').insert(righe).select()) as { data: Riga[] }
  const voci = sezioni.flatMap((s, si) =>
    s.items.map((it, ii) => ({ section_id: inserite.data[si].id, label: it.label, done: it.done, position: ii })),
  )
  if (voci.length) await db.from('personal_checklist_items').insert(voci)
}

const VALIGIA: SezioneFinta[] = [
  { emoji: '👕', name: 'Vestiti', items: [{ label: 'Costume', done: false }, { label: 'Felpa', done: false }] },
]

beforeEach(reset)

describe('COLLAUDO #34 — il difetto, riprodotto', () => {
  // Il caso vero: due salvataggi partiti a poca distanza, con il secondo che
  // cancella mentre il primo non ha ancora inserito. Nessuno dei due sbaglia da
  // solo; sbagliano insieme.
  it('il metodo vecchio duplica la valigia quando due salvataggi si accavallano', async () => {
    latenza = 10
    const primo = metodoVecchio(VIAGGIO, MEMBRO, VALIGIA)
    // Il secondo parte dopo che il primo ha cancellato e prima che abbia
    // inserito: la finestra dura quanto una scrittura, cioe' quanto basta per
    // un secondo tocco sullo schermo.
    await new Promise((r) => setTimeout(r, 15))
    latenza = 5
    const secondo = metodoVecchio(VIAGGIO, MEMBRO, VALIGIA)
    await Promise.all([primo, secondo])

    const valigia = await fetchPersonalSections(VIAGGIO, MEMBRO)
    // Una sola cancellazione, due inserimenti: la sezione compare due volte,
    // identica, senza che nessuno l'abbia riscritta.
    expect(valigia.map((s) => s.name)).toEqual(['Vestiti', 'Vestiti'])
  })

  // La seconda meta' del #34: i doppioni cancellati a mano tornano. Non e' un
  // difetto a parte, e' lo stesso — il salvataggio riscrive una fotografia
  // della lista scattata prima della cancellazione.
  it('il metodo vecchio disfa una cancellazione fatta mentre stava salvando', async () => {
    await metodoVecchio(VIAGGIO, MEMBRO, VALIGIA)

    latenza = 10
    // Chi salva ha in mano la lista com'era: due voci.
    const salvataggioInCorso = metodoVecchio(VIAGGIO, MEMBRO, VALIGIA)
    await new Promise((r) => setTimeout(r, 5))
    // Nel frattempo l'utente toglie "Felpa", e il suo salvataggio parte subito.
    latenza = 0
    await metodoVecchio(VIAGGIO, MEMBRO, [{ ...VALIGIA[0], items: [{ label: 'Costume', done: false }] }])
    await salvataggioInCorso

    const valigia = await fetchPersonalSections(VIAGGIO, MEMBRO)
    // "Felpa" e' tornata: l'ha rimessa il salvataggio piu' vecchio.
    expect(valigia.flatMap((s) => s.items.map((i) => i.label))).toContain('Felpa')
  })
})

describe('Le operazioni mirate — la cura del #31 applicata alla valigia', () => {
  it('due salvataggi accavallati non duplicano piu\' niente', async () => {
    const sezione = await createPersonalSection(VIAGGIO, MEMBRO, { emoji: '👕', name: 'Vestiti', position: 0 })

    // Stesso accavallamento del primo test, su due voci diverse: e' il gesto di
    // chi aggiunge in fretta due cose alla valigia.
    latenza = 10
    const primo = createPersonalItem(sezione, { label: 'Costume', done: false, position: 0 })
    latenza = 5
    const secondo = createPersonalItem(sezione, { label: 'Felpa', done: false, position: 1 })
    await Promise.all([primo, secondo])

    const valigia = await fetchPersonalSections(VIAGGIO, MEMBRO)
    expect(valigia).toHaveLength(1)
    expect(valigia[0].items.map((i) => i.label).sort()).toEqual(['Costume', 'Felpa'])
  })

  it('una voce cancellata resta cancellata anche se un altro salvataggio e\' in corso', async () => {
    const sezione = await createPersonalSection(VIAGGIO, MEMBRO, { emoji: '👕', name: 'Vestiti', position: 0 })
    const costume = await createPersonalItem(sezione, { label: 'Costume', done: false, position: 0 })
    const felpa = await createPersonalItem(sezione, { label: 'Felpa', done: false, position: 1 })

    latenza = 10
    const spuntaLenta = updatePersonalItem(costume, { done: true })
    latenza = 0
    await deletePersonalItem(felpa)
    await spuntaLenta

    const valigia = await fetchPersonalSections(VIAGGIO, MEMBRO)
    // La spunta lenta tocca la sua riga e basta: non riporta in vita l'altra.
    expect(valigia[0].items.map((i) => i.label)).toEqual(['Costume'])
    expect(valigia[0].items[0].done).toBe(true)
  })

  it('rinominare una sezione non tocca le sue voci', async () => {
    const sezione = await createPersonalSection(VIAGGIO, MEMBRO, { emoji: '👕', name: 'Vestiti', position: 0 })
    const voce = await createPersonalItem(sezione, { label: 'Costume', done: false, position: 0 })
    await updatePersonalSection(sezione, { name: 'Vestiti estivi', emoji: '🩳' })

    const valigia = await fetchPersonalSections(VIAGGIO, MEMBRO)
    expect(valigia[0].name).toBe('Vestiti estivi')
    expect(valigia[0].emoji).toBe('🩳')
    // L'identificativo della voce e' lo stesso di prima: e' esattamente cio' che
    // il metodo vecchio non poteva garantire, perche' li rifaceva tutti.
    expect(valigia[0].items[0].id).toBe(voce)
  })

  // Il #34 segnalava anche che, non riconoscendo l'utente, la schermata
  // ripiegava sul primo membro della crew: la valigia e' di chi la fa.
  it('la valigia di un membro non contiene quella di un altro', async () => {
    const mia = await createPersonalSection(VIAGGIO, MEMBRO, { emoji: '👕', name: 'Vestiti', position: 0 })
    await createPersonalItem(mia, { label: 'Costume', done: false, position: 0 })
    const sua = await createPersonalSection(VIAGGIO, ALTRO_MEMBRO, { emoji: '🧴', name: 'Bagno', position: 0 })
    await createPersonalItem(sua, { label: 'Spazzolino', done: false, position: 0 })

    expect((await fetchPersonalSections(VIAGGIO, MEMBRO)).map((s) => s.name)).toEqual(['Vestiti'])
    expect((await fetchPersonalSections(VIAGGIO, ALTRO_MEMBRO)).map((s) => s.name)).toEqual(['Bagno'])
  })
})
