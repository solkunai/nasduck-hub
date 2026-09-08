export function shortenAddress(addr: string, lead = 4, tail = 4): string {
  if (addr.length <= lead + tail + 1) return addr
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

export function formatCompact(n: number, maxFractionDigits = 2): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: maxFractionDigits,
  }).format(n)
}

export function formatUsdCompact(n: number): string {
  return '$' + formatCompact(n)
}

// Sub-cent meme-coin prices need more precision than a plain 2dp currency
// formatter gives — $0.00345 would otherwise round to $0.00.
export function formatPrice(n: number): string {
  if (n === 0) return '$0.00'
  if (n >= 1) return '$' + n.toFixed(4)
  const decimals = Math.max(4, -Math.floor(Math.log10(n)) + 3)
  return '$' + n.toFixed(Math.min(decimals, 10))
}

export function formatPercent(n: number, withSign = true): string {
  const sign = withSign && n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

export function formatTokenAmount(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return Math.round(n).toString()
}

export function formatTimeAgo(secondsAgo: number): string {
  const s = Math.max(0, Math.round(secondsAgo))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
