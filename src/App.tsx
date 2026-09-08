import { SolanaProviders } from './providers/WalletProvider'
import { MarketProvider } from './providers/MarketProvider'
import { Landing } from './pages/Landing'

export default function App() {
  return (
    <SolanaProviders>
      <MarketProvider>
        <Landing />
      </MarketProvider>
    </SolanaProviders>
  )
}
