// Falling $NASDUCK bill sprites — fixed background layer, purely decorative.
// `big` controls size/speed: small+slow for the page background, large+fast
// for the Order Filled modal backdrop (per the design handoff).
export function MoneyRain({ count, big = false }: { count: number; big?: boolean }) {
  const bills = Array.from({ length: count }, (_, i) => {
    const left = (i * 37 + (i % 7) * 3) % 100
    const dur = (big ? 3 : 7) + (i % 5) * (big ? 0.5 : 1.3)
    const delay = -((i * 1.7) % dur)
    const width = big ? 130 : 44 + (i % 4) * 10
    const swayDur = 3 + (i % 3)
    return (
      <div
        key={i}
        className="absolute top-0 animate-mintSway"
        style={{ left: `${left}%`, animationDuration: `${swayDur}s` }}
      >
        <img
          src="/mint/duck_bill.png"
          alt=""
          className="block animate-mintFall [image-rendering:pixelated] [filter:drop-shadow(2px_3px_0_rgba(2,6,14,.45))]"
          style={{ width, height: 'auto', animationDuration: `${dur}s`, animationDelay: `${delay}s` }}
        />
      </div>
    )
  })

  return <div className="pointer-events-none fixed inset-0 overflow-hidden">{bills}</div>
}
