import { useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletTrades, type WalletTrades } from '../hooks/useWalletTrades'
import { useMarket } from '../providers/MarketProvider'
import { formatUsdCompact, formatPercent, formatTokenAmount } from '../lib/format'

// avgCost only reflects tokens actually bought in the 14d tracked window.
// Holdings beyond that (pre-existing, airdropped, or bought before the
// window) have no known cost basis — treating them as "free" would wildly
// overstate unrealized PnL, so unrealized value/cost is capped to the
// amount attributable to a tracked buy. Same math validated on ANSEM Hub.
function computePnl(data: WalletTrades, price: number, solPrice: number) {
  const avgCost = data.nasduckBought > 0 ? data.costBasisSol / data.nasduckBought : 0
  const realizedPnlSol = data.proceedsSol - avgCost * data.nasduckSold
  const trackedRemaining = Math.max(0, data.nasduckBought - data.nasduckSold)
  const pnlKnown = data.nasduckBought > 0
  const priceInSol = price > 0 && solPrice > 0 ? price / solPrice : 0

  let pnlPercentLabel = 'n/a'
  let totalPnlUsd = 0
  let unrealizedUsd = 0
  const realizedUsd = realizedPnlSol * solPrice
  const costBasisUsd = data.costBasisSol * solPrice

  if (pnlKnown) {
    const unrealizedBasisAmount = Math.min(data.currentBalance, trackedRemaining)
    const unrealizedPnlSol = unrealizedBasisAmount * priceInSol - avgCost * unrealizedBasisAmount
    const totalPnlSol = realizedPnlSol + unrealizedPnlSol
    totalPnlUsd = totalPnlSol * solPrice
    unrealizedUsd = unrealizedPnlSol * solPrice
    pnlPercentLabel = costBasisUsd > 0 ? formatPercent((totalPnlUsd / costBasisUsd) * 100) : 'n/a'
  }

  return { pnlKnown, pnlPercentLabel, totalPnlUsd, unrealizedUsd, realizedUsd, costBasisUsd }
}

export function PnlCard() {
  const { publicKey, connected } = useWallet()
  const { data, loading, error, fetchTrades } = useWalletTrades()
  const market = useMarket()

  useEffect(() => {
    if (connected && publicKey) fetchTrades(publicKey.toBase58())
  }, [connected, publicKey, fetchTrades])

  if (!connected) return null

  return (
    <div className="mx-auto max-w-[1240px] px-5 pb-9">
      <div className="rounded-2xl border border-line bg-panel p-[22px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-display text-lg text-ink-primary">YOUR POSITION</div>
          <div className="font-mono text-[10.5px] text-ink-faint">14D WINDOW · APPROX</div>
        </div>

        {loading && <div className="py-6 text-center font-mono text-sm text-ink-muted">loading pnl…</div>}
        {error && <div className="py-6 text-center font-mono text-sm text-down">{error}</div>}

        {!loading && !error && data && (
          <PnlBody data={data} price={market.price} solPrice={market.solPrice} />
        )}
      </div>
    </div>
  )
}

function PnlBody({ data, price, solPrice }: { data: WalletTrades; price: number; solPrice: number }) {
  const { pnlKnown, pnlPercentLabel, totalPnlUsd, unrealizedUsd, realizedUsd, costBasisUsd } = computePnl(
    data,
    price,
    solPrice,
  )

  return (
    <>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
        <div className="font-mono text-[10.5px] tracking-wide text-ink-faint">TOTAL PNL</div>
        <div className={`font-mono text-lg font-bold ${totalPnlUsd >= 0 ? 'text-up' : 'text-down'}`}>
          {pnlPercentLabel}
        </div>
      </div>

      {!pnlKnown ? (
        <p className="mt-3 font-mono text-xs text-ink-faint">
          no buys tracked in the last 14 days — pnl unknown. Current balance: {formatTokenAmount(data.currentBalance)}{' '}
          $NASDUCK.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line bg-line sm:grid-cols-4">
          <PnlCell label="COST BASIS" value={formatUsdCompact(costBasisUsd)} />
          <PnlCell label="CURRENT VALUE" value={formatUsdCompact(data.currentBalance * price)} />
          <PnlCell
            label="UNREALIZED"
            value={`${unrealizedUsd >= 0 ? '+' : ''}${formatUsdCompact(unrealizedUsd)}`}
            valueClass={unrealizedUsd >= 0 ? 'text-up' : 'text-down'}
          />
          <PnlCell
            label="REALIZED"
            value={`${realizedUsd >= 0 ? '+' : ''}${formatUsdCompact(realizedUsd)}`}
            valueClass={realizedUsd >= 0 ? 'text-up' : 'text-down'}
          />
        </div>
      )}
    </>
  )
}

function PnlCell({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-panel px-4 py-3.5">
      <div className="font-mono text-[10px] text-ink-faint">{label}</div>
      <div className={`mt-1 font-mono text-[15px] text-ink-secondary ${valueClass ?? ''}`}>{value}</div>
    </div>
  )
}
