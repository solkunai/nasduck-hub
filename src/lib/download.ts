// Fetch-as-blob rather than a plain <a download href={url}> — the download
// attribute is unreliable cross-origin in several browsers (Safari in
// particular), but a blob: URL built from a same-origin-fetched blob always
// downloads regardless of where the original file lived. Confirmed
// Supabase Storage serves public bucket objects with
// access-control-allow-origin: * before relying on this.
export async function downloadImage(url: string, filename: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed: ${res.status}`)
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}
