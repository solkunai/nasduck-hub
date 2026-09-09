import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProviders } from './providers/PrivyProviders'
import { MarketProvider } from './providers/MarketProvider'
import { Landing } from './pages/Landing'
import { Legal } from './pages/Legal'

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
        </Routes>
      </BrowserRouter>
    </AppProviders>
  )
}
