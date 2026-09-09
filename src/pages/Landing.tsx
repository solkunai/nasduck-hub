import { useScrollToHashOnLoad } from '../hooks/useScrollToHashOnLoad'
import { Header } from '../components/layout/Header'
import { TickerMarquee } from '../components/TickerMarquee'
import { Hero } from '../components/Hero'
import { MissionControl } from '../components/MissionControl'
import { OtcRewards } from '../components/OtcRewards'
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
  useScrollToHashOnLoad()

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <TickerMarquee />
      <Hero />
      <MissionControl />
      <OtcRewards />
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
