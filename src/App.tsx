import { AppProviders } from './providers/PrivyProviders'
import { MarketProvider } from './providers/MarketProvider'
import { Landing } from './pages/Landing'

export default function App() {
  return (
    <AppProviders>
      <MarketProvider>
        <Landing />
      </MarketProvider>
    </AppProviders>
  )
}
