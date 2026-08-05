// Genera le icone dell'app da public/icona-sorgente.png.
//
// COME SI RILANCIA (quando cambia l'icona):
//   1. metti la nuova immagine in app/public/icona-sorgente.png (quadrata, almeno 512x512)
//   2. cd app && node scripts/genera-icone.mjs
//   3. guarda i quattro PNG prodotti e committali
//
// Gira UNA TANTUM, a mano. Non e' agganciato a `npm run build` di proposito:
// i PNG sono file statici, si generano una volta e si committano. Farli
// rigenerare a Netlify a ogni deploy vorrebbe dire portarsi sharp (e i suoi
// binari nativi) dentro la build per produrre sempre gli stessi quattro file.
//
// Cosa produce, in public/:
//   icona-192.png            192x192   manifest, purpose "any"
//   icona-512.png            512x512   manifest, purpose "any"
//   icona-512-maskable.png   512x512   manifest, purpose "maskable"
//   apple-touch-icon.png     180x180   iOS, senza canale alpha
//
// favicon.svg NON viene toccato: per la scheda del browser un SVG e' meglio.

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const QUI = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(QUI, '..', 'public')
const SORGENTE = join(PUBLIC, 'icona-sorgente.png')

// Il crema del fondo dell'app (--color-cream, src/index.css). Serve solo come
// rete di sicurezza se la sorgente ha trasparenza: iOS non gestisce l'alpha
// sull'apple-touch-icon e ci mette un fondo NERO.
const CREMA = { r: 0xf2, g: 0xed, b: 0xe3 }

// Quanto puo' allontanarsi un pixel dal colore d'angolo della sorgente (per
// canale) e contare ancora come "fuori dal disegno". Largo di proposito:
// deve prendere anche l'ombra sfumata sotto la piastrella e il bordo
// sfumato dell'antialiasing. Puo' permetterselo perche' non viene applicato
// a tutta l'immagine, ma solo a partire dai bordi (vedi sotto): all'interno
// del disegno non ci arriva mai.
const TOLLERANZA = 100

// Di quanto si allarga il ritaglio del fondo, per mangiare il filo sfumato
// che resta sul bordo del disegno.
const ALLARGAMENTO = 3

// Android ritaglia dentro la maskable forme diverse (cerchio, goccia, quadrato
// stondato). Garantito e' solo il cerchio centrale pari all'80% del lato.
const QUOTA_SICURA = 0.8

function errore(msg) {
  console.error(`\n  ✗ ${msg}\n`)
  process.exit(1)
}

if (!existsSync(SORGENTE)) {
  errore(
    'manca app/public/icona-sorgente.png.\n' +
      "    Mettici l'immagine dell'icona (quadrata, almeno 512x512) e rilancia.\n" +
      "    Non usare favicon.svg: e' un'altra cosa e resta dov'e'.",
  )
}

const originale = sharp(readFileSync(SORGENTE))
const meta = await originale.metadata()
if (meta.width < 512 || meta.height < 512) {
  errore(`la sorgente e' ${meta.width}x${meta.height}: serve almeno 512x512.`)
}

const { data, info } = await originale
  .clone()
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const { width: W, height: H, channels: CH } = info

// --- 1. Separare il disegno da quello che ha intorno ------------------------
//
// Le sorgenti arrivano spesso gia' impaginate come icona: piastrella con
// angoli stondati, ombra sfumata, e margine bianco intorno. Nessuna di queste
// tre cose va sul telefono — il bianco diventerebbe una cornice chiara, e gli
// angoli stondati lascerebbero quattro spicchi bianchi quando il sistema
// applica sopra il SUO arrotondamento.
//
// Il fuori si trova riempiendo a partire dai quattro bordi, non con una
// soglia sul colore applicata a tutta l'immagine. La differenza conta: il
// becco e le luci del cappello sono crema chiaro, vicinissimi al bianco, e
// una soglia larga li bucherebbe. Partendo dai bordi il riempimento si ferma
// sul corallo della piastrella e all'interno non entra mai, quindi la soglia
// puo' essere larga quanto serve per prendere anche l'ombra.

const riferimento = { r: data[0], g: data[1], b: data[2], a: data[3] }
const fuoriDalDisegno = (i) => {
  const j = i * CH
  return (
    data[j + 3] < 8 ||
    (Math.abs(data[j] - riferimento.r) <= TOLLERANZA &&
      Math.abs(data[j + 1] - riferimento.g) <= TOLLERANZA &&
      Math.abs(data[j + 2] - riferimento.b) <= TOLLERANZA)
  )
}

const esterno = new Uint8Array(W * H)
const pila = new Int32Array(W * H)
let cima = 0
const spingi = (i) => {
  if (!esterno[i] && fuoriDalDisegno(i)) {
    esterno[i] = 1
    pila[cima++] = i
  }
}
for (let x = 0; x < W; x++) {
  spingi(x)
  spingi((H - 1) * W + x)
}
for (let y = 0; y < H; y++) {
  spingi(y * W)
  spingi(y * W + W - 1)
}
while (cima > 0) {
  const i = pila[--cima]
  const x = i % W
  const y = (i / W) | 0
  if (x > 0) spingi(i - 1)
  if (x < W - 1) spingi(i + 1)
  if (y > 0) spingi(i - W)
  if (y < H - 1) spingi(i + W)
}

let x0 = W, y0 = H, x1 = -1, y1 = -1
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (esterno[y * W + x]) continue
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
}
if (x1 < 0) errore("la sorgente e' tutta di un colore solo: non c'e' niente da ritagliare.")

// Riquadro quadrato centrato sul disegno: le icone sono quadrate, e un
// ritaglio non quadrato verrebbe schiacciato dal resize.
const cx = (x0 + x1) / 2
const cy = (y0 + y1) / 2
let lato = Math.min(Math.max(x1 - x0 + 1, y1 - y0 + 1), W, H)
const left0 = Math.max(0, Math.min(Math.round(cx - lato / 2), W - lato))
const top0 = Math.max(0, Math.min(Math.round(cy - lato / 2), H - lato))

const margineTolto = Math.round(((W - lato) / W) * 100)

// --- 2. Il ritaglio a tutto campo, per le icone "any" -----------------------
//
// Si stringe il riquadro finche' tutti e quattro gli angoli cadono dentro il
// disegno: per un rettangolo stondato basta questo, perche' l'arco e' convesso
// e il punto piu' esterno del ritaglio e' proprio l'angolo. Se la sorgente e'
// gia' a tutto campo (angoli vivi), il ciclo esce subito e non toglie niente.

const angoliDentro = (i) =>
  !esterno[(top0 + i) * W + left0 + i] &&
  !esterno[(top0 + i) * W + left0 + lato - 1 - i] &&
  !esterno[(top0 + lato - 1 - i) * W + left0 + i] &&
  !esterno[(top0 + lato - 1 - i) * W + left0 + lato - 1 - i]

const passo = Math.max(1, Math.round(lato * 0.002))
const massimo = Math.round(lato * 0.25)
let stretta = 0
while (stretta <= massimo && !angoliDentro(stretta)) stretta += passo
if (stretta > massimo) {
  errore(
    "non riesco a trovare un ritaglio senza angoli chiari.\n" +
      '    La sorgente ha angoli troppo stondati o un fondo che non riconosco.\n' +
      "    Serve un'immagine a tutto campo: colore fino ai bordi, angoli vivi.",
  )
}
stretta += Math.round(lato * 0.005) // un filo oltre l'arco

const pieno = await originale
  .clone()
  .extract({ left: left0 + stretta, top: top0 + stretta, width: lato - stretta * 2, height: lato - stretta * 2 })
  .resize(512, 512, { fit: 'fill' })
  .png()
  .toBuffer()

// --- 3. La maskable ---------------------------------------------------------
//
// Qui NON si rimpicciolisce il disegno dentro il quadrato inventandogli un
// fondo intorno. Provato, e si vede: dove finisce il disegno resta una
// giuntura netta (misurata: fino a 32 su 255), perche' il fenicottero arriva
// al bordo e li' viene tagliato di colpo.
//
// Si tiene invece la piastrella intera, con IL SUO margine — l'aria che il
// disegnatore le ha messo intorno — e si riempiono solo i quattro angoli
// stondati. Quegli angoli sono esattamente la parte che Android ritaglia via
// con qualunque maschera: il punto dove un'imprecisione costa meno.
//
// ⚠️ Vuol dire che il margine della maskable dipende dalla sorgente, non da
// questo script. Va guardato ogni volta che si cambia icona.

const L = lato
const dentro = (x, y) => {
  const j = ((top0 + y) * W + left0 + x) * CH
  return [data[j], data[j + 1], data[j + 2]]
}

// Il fondo degli angoli si ricava dai quattro punti dove il ritaglio di prima
// ha trovato il disegno: sono i pixel di sfumatura veri piu' vicini all'arco,
// quindi la giuntura cade dove i due colori gia' coincidono. Un 2x2 allargato
// da' una sfumatura bilineare, che segue anche le sfumature in diagonale.
const s = stretta
const fondo = await sharp(
  Buffer.from([dentro(s, s), dentro(L - 1 - s, s), dentro(s, L - 1 - s), dentro(L - 1 - s, L - 1 - s)].flat()),
  { raw: { width: 2, height: 2, channels: 3 } },
)
  .resize(L, L, { kernel: 'linear' })
  .png()
  .toBuffer()

// La maschera del fuori, allargata di qualche pixel per mangiare il filo
// sfumato dell'antialiasing lungo l'arco. Allargamento separabile: prima in
// orizzontale, poi in verticale.
const fuori = new Uint8Array(L * L)
for (let y = 0; y < L; y++) {
  for (let x = 0; x < L; x++) fuori[y * L + x] = esterno[(top0 + y) * W + left0 + x]
}
const allarga = (src, orizzontale) => {
  const out = new Uint8Array(L * L)
  for (let a = 0; a < L; a++) {
    for (let b = 0; b < L; b++) {
      let acceso = 0
      for (let d = -ALLARGAMENTO; d <= ALLARGAMENTO && !acceso; d++) {
        const c = b + d
        if (c < 0 || c >= L) continue
        acceso = orizzontale ? src[a * L + c] : src[c * L + a]
      }
      if (acceso) {
        if (orizzontale) out[a * L + b] = 1
        else out[b * L + a] = 1
      }
    }
  }
  return out
}
const fuoriLargo = allarga(allarga(fuori, true), false)

const conAlpha = Buffer.alloc(L * L * 4)
for (let y = 0; y < L; y++) {
  for (let x = 0; x < L; x++) {
    const i = y * L + x
    const j = ((top0 + y) * W + left0 + x) * CH
    conAlpha[i * 4] = data[j]
    conAlpha[i * 4 + 1] = data[j + 1]
    conAlpha[i * 4 + 2] = data[j + 2]
    conAlpha[i * 4 + 3] = fuoriLargo[i] ? 0 : 255
  }
}

// Due passaggi di proposito: sharp ridimensiona PRIMA di sovrapporre, quindi
// componendo e ridimensionando in una catena sola il fondo diventerebbe 512 e
// la piastrella, che e' piu' grande, non ci starebbe piu' sopra.
const maskable = await sharp(fondo)
  .composite([
    { input: await sharp(conAlpha, { raw: { width: L, height: L, channels: 4 } }).png().toBuffer(), left: 0, top: 0 },
  ])
  .png()
  .toBuffer()

// --- 4. I quattro file ------------------------------------------------------

await sharp(pieno).resize(192, 192).png().toFile(join(PUBLIC, 'icona-192.png'))
writeFileSync(join(PUBLIC, 'icona-512.png'), pieno)
await sharp(maskable).resize(512, 512).png().toFile(join(PUBLIC, 'icona-512-maskable.png'))

// apple-touch-icon: 180x180 e SENZA canale alpha. iOS la trasparenza non la
// gestisce e ci mette un fondo nero.
await sharp(pieno)
  .resize(180, 180)
  .flatten({ background: CREMA })
  .png({ palette: false })
  .toFile(join(PUBLIC, 'apple-touch-icon.png'))

// --- 5. Resoconto -----------------------------------------------------------

const controllo = await sharp(join(PUBLIC, 'apple-touch-icon.png')).metadata()
const cerchio = Math.round(512 * QUOTA_SICURA)

console.log(`
  Sorgente        ${meta.width}x${meta.height}
  Margine tolto   ${margineTolto}% del lato ${margineTolto > 0 ? '(la sorgente aveva aria intorno)' : ''}
  Angoli          ${stretta > 0 ? `stondati, ritagliati ${stretta}px per lato sulle icone "any"` : "gia' vivi, niente da togliere"}
  Maskable        piastrella intera (${L}px) con gli angoli riempiti, poi 512

  Scritti in public/:
    icona-192.png            192x192  purpose "any"
    icona-512.png            512x512  purpose "any"
    icona-512-maskable.png   512x512  purpose "maskable"
    apple-touch-icon.png     180x180  alpha: ${controllo.hasAlpha ? '⚠ PRESENTE' : "assente, giusto"}

  ⚠️ Sulla maskable il margine viene dalla sorgente, non da questo script.
  Guardala prima di committare: becco, cappello e collo devono stare dentro
  il cerchio centrale da ${cerchio}px (l'${QUOTA_SICURA * 100}% del lato), perche' fuori Android taglia.
`)
