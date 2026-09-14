// Confirmed live and root-caused, not guessed: real meme uploads were
// averaging ~1.9MB (up to 2.5MB) with zero resizing — the storage bucket
// only enforces a 5MB cap and a MIME allowlist, nothing shrinks the actual
// pixels. The meme wall shows a hero image plus 6-10 grid cards per page
// load, so a single visit could pull down 15-20MB of meme images alone —
// the real driver behind a Supabase bandwidth overage (15.15GB against a
// 5.5GB cap) days into going live. This resizes/recompresses client-side
// before the file ever reaches Storage, cutting both what's stored and
// what every future pageview re-downloads.
const MAX_DIMENSION = 800
const JPEG_QUALITY = 0.82
// Below this, resizing isn't worth the CPU/quality cost — already small
// enough that re-encoding wouldn't meaningfully shrink it further.
const SKIP_BELOW_BYTES = 300_000
// Sampled, not exhaustive — every Nth pixel is enough to detect "any
// meaningful transparency exists," not measure it precisely, and scanning
// every pixel of an 800px image isn't worth the cost for that question.
const ALPHA_SAMPLE_STRIDE = 40

export async function resizeImageForUpload(file: File): Promise<File> {
  // Animated GIFs would be destroyed by this — canvas only ever captures a
  // single static frame. Passed through unchanged; the 5MB bucket cap
  // still applies.
  if (file.type === 'image/gif') return file
  if (file.size < SKIP_BELOW_BYTES) return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    // Already smaller than the target — resizing dimensions wouldn't help,
    // and re-encoding an already-small image can occasionally grow it
    // (JPEG re-compression artifacts, PNG re-palettization). Not worth
    // the risk for no guaranteed benefit.
    if (scale >= 1) {
      bitmap.close()
      return file
    }

    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }

    // Draw once to check for real transparency before deciding the output
    // format — PNG only stays PNG if there's actual alpha worth protecting.
    // Most meme uploads are opaque photos/screenshots saved as PNG rather
    // than genuinely transparent graphics, and lossless PNG alone (no
    // quality knob) only got a real 2.57MB test upload down to 1.28MB
    // (50%) versus JPEG's typical 80-90% reduction — worth the extra check
    // given this is fixing an active bandwidth overage, not a hypothetical.
    ctx.drawImage(bitmap, 0, 0, width, height)
    const hasTransparency = file.type === 'image/png' && canvasHasTransparency(ctx, width, height)

    if (!hasTransparency) {
      // JPEG has no alpha channel — if this canvas has any transparent
      // pixels at all (even ones too minor to trip the check above, e.g.
      // anti-aliased edges), the browser's own JPEG encoder has to pick
      // something to composite them onto, and that's black by default in
      // most implementations, not white. Redraw on an explicit white fill
      // first so that never happens, rather than trust the browser default.
      ctx.globalCompositeOperation = 'destination-over'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
    }
    bitmap.close()

    const outputType = hasTransparency ? 'image/png' : 'image/jpeg'
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, outputType === 'image/jpeg' ? JPEG_QUALITY : undefined),
    )
    if (!blob) return file

    // Only actually use the resized version if it's genuinely smaller —
    // rare edge cases (a tiny/simple source image) could re-encode larger.
    if (blob.size >= file.size) return file

    const newName = file.name.replace(/\.\w+$/, outputType === 'image/png' ? '.png' : '.jpg')
    return new File([blob], newName, { type: outputType })
  } catch {
    // A corrupt file, a browser without createImageBitmap/canvas support,
    // or any other unexpected failure — upload the original rather than
    // block the whole post over an optimization step.
    return file
  }
}

function canvasHasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = ctx.getImageData(0, 0, width, height)
  // Alpha is every 4th byte (R,G,B,A). A pixel isn't "meaningfully"
  // transparent until its alpha drops enough to be visually obvious —
  // catches real transparent backgrounds without false-triggering on a
  // fully opaque image's occasional 254-vs-255 rounding noise.
  for (let i = 3; i < data.length; i += 4 * ALPHA_SAMPLE_STRIDE) {
    if (data[i] < 250) return true
  }
  return false
}
