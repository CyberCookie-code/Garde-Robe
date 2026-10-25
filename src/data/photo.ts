/** Réduit la photo (les photos iPhone / Pixel font 3-12 Mo) avant de la stocker. */
export async function compressPhoto(file: File, maxSide = 900, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Compression impossible'))), 'image/jpeg', quality),
  )
}

const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]

/** Distance perceptive simple (« redmean ») entre deux couleurs RVB. */
function colorDistance([r1, g1, b1]: number[], [r2, g2, b2]: number[]) {
  const rm = (r1 + r2) / 2
  return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2)
}

/** Couleur de la palette la plus proche de chaque pixel, triées par fréquence (fonction pure, testée).
 *  `background` : couleur du fond ; les pixels qui lui ressemblent sont ignorés (sauf s'il n'en reste presque plus). */
export function rankPaletteColors<T extends { hex: string }>(
  pixels: Uint8ClampedArray,
  palette: T[],
  background?: [number, number, number],
) {
  const refs = palette.map((p) => hexToRgb(p.hex))
  const rank = (skipBackground: boolean) => {
    const counts = new Array(palette.length).fill(0)
    let total = 0
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < 128) continue
      const px = [pixels[i], pixels[i + 1], pixels[i + 2]]
      if (skipBackground && background && colorDistance(px, background) < 60) continue
      let best = 0
      let bestD = Infinity
      refs.forEach((ref, k) => {
        const d = colorDistance(px, ref)
        if (d < bestD) {
          bestD = d
          best = k
        }
      })
      counts[best]++
      total++
    }
    return { counts, total }
  }
  let { counts, total } = rank(true)
  // Vêtement de la même couleur que le fond : on garde tout.
  if (background && total < pixels.length / 4 / 10) ({ counts, total } = rank(false))
  return palette
    .map((color, k) => ({ color, share: total ? counts[k] / total : 0 }))
    .filter((x) => x.share > 0)
    .sort((a, b) => b.share - a.share)
}

/** Couleur moyenne du bord de l'image, pris comme fond (lit, sol, mur…). */
export function borderColor(pixels: Uint8ClampedArray, size: number): [number, number, number] {
  const sum = [0, 0, 0]
  let n = 0
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (x > 1 && y > 1 && x < size - 2 && y < size - 2) continue
      const i = (y * size + x) * 4
      sum[0] += pixels[i]
      sum[1] += pixels[i + 1]
      sum[2] += pixels[i + 2]
      n++
    }
  return sum.map((v) => v / n) as [number, number, number]
}

/**
 * Devine les couleurs du vêtement : on retire le fond (couleur du bord de la photo)
 * puis on regarde le centre. Renvoie la couleur principale, et une seconde si elle
 * occupe une part importante. C'est une suggestion : l'utilisateur peut la corriger.
 */
export async function guessColors<T extends { hex: string }>(photo: Blob, palette: T[]): Promise<T[]> {
  const bitmap = await createImageBitmap(photo)
  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0, size, size)
  const background = borderColor(ctx.getImageData(0, 0, size, size).data, size)
  const sw = bitmap.width * 0.6
  const sh = bitmap.height * 0.6
  ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, size, size)
  bitmap.close()
  const ranked = rankPaletteColors(ctx.getImageData(0, 0, size, size).data, palette, background)
  return ranked.filter((x, i) => i === 0 || (i === 1 && x.share >= 0.3)).map((x) => x.color)
}
