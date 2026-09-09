import { useEffect } from 'react'
import { Header } from '../components/layout/Header'
import { TickerMarquee } from '../components/TickerMarquee'
import { Hero } from '../components/Hero'
import { MissionControl } from '../components/MissionControl'
import { PriceChart } from '../components/PriceChart'
import { SwapWidget } from '../components/SwapWidget'
import { PnlCard } from '../components/PnlCard'
import { WhaleFeed } from '../components/WhaleFeed'
import { Leaderboard } from '../components/Leaderboard'
import { MemeWall } from '../components/MemeWall'
import { ClickerGame } from '../components/ClickerGame'
import { Memo } from '../components/Memo'
import { Footer } from '../components/layout/Footer'

export function Landing() {
  // Confirmed live: a direct/shared link like nasduck.wtf/#memes does NOT
  // auto-scroll on load — the browser's native hash-jump only fires once,
  // at the moment the URL is first processed, before this SPA has rendered
  // the target element into the DOM. An in-page click on an #anchor link
  // works fine (the element already exists by then); only the
  // load-with-hash-already-in-the-URL case needs this.
  useEffect(() => {
    if (!window.location.hash) return
    const id = window.location.hash.slice(1)
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'auto' })
    }, 50)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <TickerMarquee />
      <Hero />
      <MissionControl />
      <div id="swap" className="mx-auto grid max-w-[1240px] scroll-mt-[110px] items-start gap-[18px] px-5 pb-9 pt-5 [grid-template-columns:repeat(auto-fit,minmax(330px,1fr))]">
        <PriceChart />
        <SwapWidget />
      </div>
      <PnlCard />
      <div className="mx-auto grid max-w-[1240px] items-start gap-[18px] px-5 pb-9 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
        <WhaleFeed />
        <Leaderboard />
      </div>
      <MemeWall />
      <ClickerGame />
      <Memo />
      <Footer />
    </div>
  )
}
