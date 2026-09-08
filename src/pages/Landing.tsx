import { Header } from '../components/layout/Header'
import { TickerMarquee } from '../components/TickerMarquee'
import { Hero } from '../components/Hero'
import { MissionControl } from '../components/MissionControl'
import { PriceChart } from '../components/PriceChart'
import { SwapWidget } from '../components/SwapWidget'
import { PnlCard } from '../components/PnlCard'
import { Memo } from '../components/Memo'
import { ComingSoonStrip } from '../components/ComingSoonStrip'
import { Footer } from '../components/layout/Footer'

export function Landing() {
  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <TickerMarquee />
      <Hero />
      <MissionControl />
      <div id="swap" className="mx-auto grid max-w-[1240px] items-start gap-[18px] px-5 pb-9 pt-5 [grid-template-columns:repeat(auto-fit,minmax(330px,1fr))]">
        <PriceChart />
        <SwapWidget />
      </div>
      <PnlCard />
      <ComingSoonStrip />
      <Memo />
      <Footer />
    </div>
  )
}
