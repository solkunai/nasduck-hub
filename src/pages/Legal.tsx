import { useScrollToHashOnLoad } from '../hooks/useScrollToHashOnLoad'
import { Header } from '../components/layout/Header'
import { Footer } from '../components/layout/Footer'
import { NASDUCK_X } from '../lib/nasduck'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-[100px] border-t border-line py-8 first:border-t-0 first:pt-0">
      <h2 className="font-display text-[22px] tracking-tight text-ink-primary">{title}</h2>
      <div className="mt-4 grid gap-4 font-mono text-[13px] leading-relaxed text-ink-secondary">{children}</div>
    </div>
  )
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-2 font-mono text-[12px] font-bold tracking-wide text-ink-primary">{children}</h3>
}

export function Legal() {
  useScrollToHashOnLoad()

  return (
    <div className="min-h-screen bg-bg">
      <Header />

      <div className="mx-auto max-w-[760px] px-5 py-12">
        <h1 className="font-display text-[clamp(28px,4vw,40px)] tracking-tight text-ink-primary">LEGAL</h1>
        <p className="mt-2 font-mono text-[11px] text-ink-faint">
          Terms of Service &amp; Privacy Policy · Last updated September 9, 2026
        </p>

        <div className="mt-4 flex gap-4 font-mono text-[11px] text-ink-muted">
          <a href="#terms" className="underline decoration-dotted hover:text-brand">
            Terms of Service
          </a>
          <a href="#privacy" className="underline decoration-dotted hover:text-brand">
            Privacy Policy
          </a>
        </div>

        <div className="mt-8 rounded-xl border border-line bg-panel-deep p-4 font-mono text-[11.5px] leading-relaxed text-ink-dim">
          $NASDUCK is a community-driven meme coin project with no formal company, no team allocation, and no
          registered legal entity behind it. These pages are provided in good faith as a plain-language explanation
          of how the site handles data and what you're agreeing to by using it — not a substitute for professional
          legal advice, and not a promise about anything's value.
        </div>

        <Section id="terms" title="Terms of Service">
          <div>
            <H3>1. Not financial advice</H3>
            Nothing on this site — the price ticker, the Mission Control tracker, the Holder Rewards numbers, the
            swap widget, anything — is financial, investment, tax, or legal advice. The $NASDUCK token itself has no
            intrinsic value: it isn't backed by or redeemable for any asset by design, and its price is driven by
            market speculation like any other meme coin. The Holder Rewards described in Section 5 are real, but
            they're a separate, voluntary benefit from a third-party protocol, not a property of the token contract
            — see Section 5 before assuming they're guaranteed. Decisions you make here are entirely your own.
          </div>
          <div>
            <H3>2. Non-custodial, always</H3>
            This site never holds your funds or your private keys. Swaps execute through Jupiter's Ultra API, which
            you approve directly in your own wallet (Phantom, Solflare, an embedded wallet created through Privy, or
            any other connected wallet) — this site cannot move your funds without your explicit signature on each
            transaction, and cannot see or export your private key on your behalf.
          </div>
          <div>
            <H3>3. Third-party services</H3>
            This site relies on several independent third-party services it does not control or operate: Jupiter
            (swap execution and routing), Privy (wallet authentication and embedded wallet infrastructure), Supabase
            (backend hosting and database), Helius (Solana blockchain data), DexScreener (price charts), and OTC
            Desks (creator-fee reward distribution — see below). This site is not responsible for their uptime,
            accuracy, security, or business practices. Read their own terms and privacy policies separately.
          </div>
          <div>
            <H3>4. Mission Control targets aren't promises</H3>
            The $1B market cap and 100,000 holder goals shown on this site are aspirational community trackers, not
            projections, forecasts, or guarantees that either will ever be reached.
          </div>
          <div>
            <H3>5. Holder rewards depend on a third party</H3>
            The Holder Rewards shown on this site (SOL converting to QQQx, distributed to holders) are provided
            entirely by OTC Desks, an independent third-party protocol this site does not operate. This mechanism,
            its payout schedule, and its continued existence are outside this site's control and can change or stop
            without notice.
          </div>
          <div>
            <H3>6. Risk disclosure</H3>
            Cryptocurrency, including $NASDUCK, is highly volatile and speculative. You could lose some or all of
            what you put in. Copycat tokens using the NASDUCK name exist — always verify the contract address
            yourself against the one shown on this site (
            <code className="rounded bg-panel-deep px-1 py-0.5 text-[11px]">7Y7V1a4m2nWK7BMgbka5B4vR1pDvCK7yva3Hnrqkraze</code>
            ) before trading.
          </div>
          <div>
            <H3>7. Acceptable use</H3>
            Don't use this site for anything illegal, or attempt to exploit, disrupt, or gain unauthorized access to
            it or the infrastructure behind it.
          </div>
          <div>
            <H3>8. No warranty, limitation of liability</H3>
            This site is provided "as is," with no warranty of any kind, express or implied. To the fullest extent
            permitted by law, nobody involved in building or running this site is liable for any loss arising from
            your use of it, including losses from smart contract risk, third-party service failures, or market
            volatility.
          </div>
          <div>
            <H3>9. Changes</H3>
            These terms can be updated at any time by editing this page. Continued use of the site after a change
            means you accept the update.
          </div>
        </Section>

        <Section id="privacy" title="Privacy Policy">
          <div>
            <H3>What gets collected</H3>
            <ul className="mt-1.5 list-disc pl-5">
              <li>Your public wallet address — already public on-chain regardless of this site</li>
              <li>Your email address, only if you sign in via email/Google/X through Privy (not collected for wallet-only sign-in)</li>
              <li>IP address, used only for abuse-prevention rate limiting on backend endpoints — not linked to your identity or stored long-term beyond that purpose</li>
              <li>Anything you voluntarily submit — meme wall uploads (image, caption, wallet address) are public by design once posted</li>
            </ul>
          </div>
          <div>
            <H3>What never gets collected</H3>
            This site never asks for, sees, or stores your private key or seed phrase — not for an embedded wallet
            (Privy assembles those in an isolated frame this site has no access to), and not for an external wallet
            (Phantom, Solflare, etc. keep those in their own extension).
          </div>
          <div>
            <H3>Third-party processors</H3>
            Privy processes authentication and embedded wallet creation under its own privacy policy. Supabase hosts
            the backend database. Swap transactions route through Jupiter, which briefly handles the transaction but
            is never given anything beyond what's required to execute a swap you've already approved.
          </div>
          <div>
            <H3>Cookies &amp; local storage</H3>
            Used only for lightweight functionality (remembering UI state in your own browser) — no ad tracking, and
            nothing collected here is sold to anyone.
          </div>
          <div>
            <H3>Data requests</H3>
            Since there's no formal company behind this project, reach out via{' '}
            <a href={NASDUCK_X} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-brand">
              X/Twitter
            </a>{' '}
            for any data question or removal request — handled on a best-effort basis. Note that on-chain data (your
            wallet address, transaction history) is public and permanent by the nature of a blockchain and can't be
            deleted by this site or anyone else.
          </div>
          <div>
            <H3>Age</H3>
            This site isn't intended for use by anyone under 18.
          </div>
          <div>
            <H3>Changes</H3>
            This policy can be updated at any time by editing this page.
          </div>
        </Section>
      </div>

      <Footer />
    </div>
  )
}
