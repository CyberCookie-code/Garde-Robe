import type { InferenceSession } from 'onnxruntime-web'

/**
 * Détourage du vêtement, entièrement sur le téléphone : aucune photo n'est envoyée.
 *
 * Modèle U²-Net « p » (4,6 Mo, licence Apache 2.0), exécuté par onnxruntime-web en WebAssembly.
 * Le moteur (≈ 14 Mo) et le modèle ne sont téléchargés qu'au premier détourage, puis gardés
 * en cache par le service worker : ensuite, ça marche hors ligne.
 */
const INPUT = 320
const MAX_SIDE = 720
const MODEL_URL = `${import.meta.env.BASE_URL}models/u2netp.onnx`

let session: Promise<InferenceSession> | undefined

export function loadCutoutModel(url = MODEL_URL) {
  session ??= (async () => {
    const [ort, wasm] = await Promise.all([
      import('onnxruntime-web/wasm'),
      import('onnxruntime-web/ort-wasm-simd-threaded.wasm?url').then((m) => m.default),
    ])
    ort.env.wasm.wasmPaths = { wasm }
    // GitHub Pages n'envoie pas les en-têtes requis pour le multithread : un seul fil.
    ort.env.wasm.numThreads = 1
    return ort.InferenceSession.create(url, { executionProviders: ['wasm'] })
  })()
  session.catch(() => (session = undefined))
  return session
}

const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

/** Image RVBA (taille INPUT²) → tenseur 1×3×H×W normalisé comme à l'entraînement du modèle. */
export function toInputTensor(rgba: Uint8ClampedArray, size = INPUT) {
  const n = size * size
  const out = new Float32Array(3 * n)
  for (let i = 0; i < n; i++)
    for (let c = 0; c < 3; c++) out[c * n + i] = (rgba[i * 4 + c] / 255 - MEAN[c]) / STD[c]
  return out
}

/** Sortie du modèle → opacité 0-255, après mise à l'échelle min-max. */
export function toAlpha(pred: Float32Array) {
  let min = Infinity
  let max = -Infinity
  for (const v of pred) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const range = max - min || 1
  const alpha = new Uint8ClampedArray(pred.length)
  for (let i = 0; i < pred.length; i++) alpha[i] = ((pred[i] - min) / range) * 255
  return alpha
}

/** Part de l'image gardée par le masque (0-1). */
export function coverage(alpha: Uint8ClampedArray) {
  let kept = 0
  for (const a of alpha) if (a >= 128) kept++
  return kept / alpha.length
}

/** Rectangle englobant les pixels gardés, en fraction de l'image, avec une petite marge. */
export function maskBounds(alpha: Uint8ClampedArray, size: number, margin = 0.04) {
  let x0 = size
  let y0 = size
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (alpha[y * size + x] >= 128) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 < 0) return { x: 0, y: 0, w: 1, h: 1 }
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  const x = clamp(x0 / size - margin)
  const y = clamp(y0 / size - margin)
  return { x, y, w: clamp((x1 + 1) / size + margin) - x, h: clamp((y1 + 1) / size + margin) - y }
}

export class CutoutError extends Error {}

/**
 * Renvoie la photo détourée (WebP ou PNG transparent, recadrée sur le vêtement).
 * Échoue proprement si le masque est vide ou couvre presque toute la photo :
 * l'app garde alors la photo d'origine.
 */
export async function removeBackground(photo: Blob): Promise<Blob> {
  const [model, bitmap] = await Promise.all([loadCutoutModel(), createImageBitmap(photo)])
  const ort = await import('onnxruntime-web/wasm')

  const small = document.createElement('canvas')
  small.width = small.height = INPUT
  const sctx = small.getContext('2d', { willReadFrequently: true })!
  sctx.drawImage(bitmap, 0, 0, INPUT, INPUT)
  const input = new ort.Tensor('float32', toInputTensor(sctx.getImageData(0, 0, INPUT, INPUT).data), [1, 3, INPUT, INPUT])
  const result = await model.run({ [model.inputNames[0]]: input })
  const alpha = toAlpha(result[model.outputNames[0]].data as Float32Array)

  const kept = coverage(alpha)
  if (kept < 0.03 || kept > 0.97) {
    bitmap.close()
    throw new CutoutError('Le vêtement n’a pas été trouvé sur la photo.')
  }

  // Masque en niveaux d'opacité, agrandi à la taille de la photo (lissage du navigateur).
  const mask = sctx.createImageData(INPUT, INPUT)
  for (let i = 0; i < alpha.length; i++) mask.data[i * 4 + 3] = alpha[i]
  sctx.putImageData(mask, 0, 0)

  const b = maskBounds(alpha, INPUT)
  // Recadrage sur le vêtement, côté le plus long limité à MAX_SIDE pour garder des fichiers légers.
  const scale = Math.min(1, MAX_SIDE / Math.max(b.w * bitmap.width, b.h * bitmap.height))
  const W = bitmap.width * scale
  const H = bitmap.height * scale
  const out = document.createElement('canvas')
  out.width = Math.round(b.w * W)
  out.height = Math.round(b.h * H)
  const ctx = out.getContext('2d')!
  ctx.drawImage(bitmap, -b.x * W, -b.y * H, W, H)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(small, -b.x * W, -b.y * H, W, H)
  bitmap.close()

  // WebP garde la transparence en pesant 3 à 5 fois moins que le PNG ; Safari ancien ne sait pas
  // l'écrire et renvoie alors un PNG, ce qui reste correct.
  const encode = (type: string) => new Promise<Blob | null>((resolve) => out.toBlob(resolve, type, 0.85))
  const blob = (await encode('image/webp')) ?? (await encode('image/png'))
  if (!blob) throw new CutoutError('Export impossible')
  return blob
}
