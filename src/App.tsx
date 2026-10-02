import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProviders } from './providers/PrivyProviders'
import { MarketProvider } from './providers/MarketProvider'
import { Landing } from './pages/Landing'
import { Legal } from './pages/Legal'
import { Mint } from './pages/Mint'

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <MarketProvider>
                <Landing />
              </MarketProvider>
            }
          />
          {/* No MarketProvider here — this page has no live price ticker,
              no reason to open that polling loop just to render static
              text. */}
          <Route path="/legal" element={<Legal />} />
          {/* Mint charges $5 of $NASDUCK per duck (see lib/mint/config.ts) —
              needs the live price feed to compute the token amount. */}
          <Route
            path="/mint"
            element={
              <MarketProvider>
                <Mint />
              </MarketProvider>
            }
          />
        </Routes>
      </BrowserRouter>
    </AppProviders>
  )
}
