import { useState } from 'react'
import { useActiveWallet } from '../../hooks/useActiveWallet'
import { shortenAddress } from '../../lib/format'

// Replaces wallet-adapter's <WalletMultiButton /> now that Privy owns the
// wallet layer. Same "sign in" vs "connected" two-state button, but the
// connected dropdown adds the two things unique to an embedded wallet: a
// deposit address to fund it with (it starts empty — there's no seed phrase
// to import funds from, someone has to send SOL/NASDUCK to it) and an
// export-private-key action, so a user isn't ever locked into Privy's
// custody if they want to move to Phantom/Backpack later.
export function WalletMenu() {
  const { ready, connected, publicKey, login, logout, isEmbedded, canExport, exportWallet, xUsername } = useActiveWallet()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!ready) {
    return (
      <div className="h-[38px] w-[110px] animate-pulse rounded-lg border border-line bg-panel-deep" />
    )
  }

  if (!connected || !publicKey) {
    return (
      <button
        onClick={() => login()}
        style={{ whiteSpace: 'nowrap' }}
        className="rounded-lg border border-line-strong bg-[#0E2140] px-3 py-2 font-mono text-xs text-ink-primary transition-colors hover:border-brand"
      >
        SIGN IN
      </button>
    )
  }

  const address = publicKey.toBase58()
  // X handle when signed in that way — it's public-facing identity anyway
  // (unlike email, which stays hidden per the earlier choice), and more
  // recognizable than a truncated address for someone who knows the
  // person by their @. Falls back to the address for every other sign-in
  // method (email, Google, or an external wallet).
  const label = xUsername ? `@${xUsername}` : shortenAddress(address)

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard permission can be denied — the address is still shown in
      // the dropdown for a manual copy, so this isn't fatal.
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ whiteSpace: 'nowrap' }}
        className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-[#0E2140] px-3 py-2 font-mono text-xs text-ink-primary transition-colors hover:border-brand"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-up" />
        {label}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[46px] z-50 w-[260px] overflow-hidden rounded-xl border border-line-strong bg-panel shadow-[0_16px_40px_rgba(0,0,0,.5)]">
            <div className="border-b border-line px-4 py-3">
              <div className="font-mono text-[10px] tracking-wide text-ink-faint">
                {isEmbedded ? 'NASDUCK WALLET' : 'CONNECTED WALLET'}
                {xUsername && ' · SIGNED IN VIA X'}
              </div>
              {xUsername && <div className="mt-1 font-mono text-[12.5px] text-ink-primary">@{xUsername}</div>}
              <div className="mt-1 truncate font-mono text-[12.5px] text-ink-secondary">{address}</div>
            </div>

            <button
              onClick={copyAddress}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left font-mono text-[12.5px] text-ink-secondary hover:bg-panel-deep hover:text-ink-primary"
            >
              <span>{copied ? '✅' : '📋'}</span>
              {copied ? 'Copied' : 'Copy address'}
            </button>

            <a
              href={`https://solscan.io/account/${address}`}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left font-mono text-[12.5px] text-ink-secondary hover:bg-panel-deep hover:text-ink-primary"
            >
              <span>🔍</span>
              View on Solscan
            </a>

            {isEmbedded && (
              <div className="border-t border-line px-4 py-3">
                <div className="font-mono text-[10px] tracking-wide text-ink-faint">FUND THIS WALLET</div>
                <div className="mt-1 font-mono text-[10.5px] leading-snug text-ink-dim">
                  Send SOL or $NASDUCK to the address above from any wallet or exchange to start trading.
                </div>
              </div>
            )}

            {canExport && (
              <button
                onClick={() => {
                  setOpen(false)
                  exportWallet()
                }}
                className="flex w-full items-center gap-2.5 border-t border-line px-4 py-3 text-left font-mono text-[12.5px] text-ink-secondary hover:bg-panel-deep hover:text-ink-primary"
              >
                <span>🔑</span>
                Export private key
              </button>
            )}

            <button
              onClick={() => {
                setOpen(false)
                logout()
              }}
              className="flex w-full items-center gap-2.5 border-t border-line px-4 py-3 text-left font-mono text-[12.5px] text-down hover:bg-panel-deep"
            >
              <span>🚪</span>
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  )
}
