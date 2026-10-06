// Everything the admin page creates on-chain, per network. Only public
// addresses live here — no keys. The authority signs in Phantom.
import split from '../output/pool-split.json'
import fixtures from '../output/devnet-fixtures.json'
import rehearsal from '../output/devnet-rehearsal.json'

export type Cluster = 'devnet' | 'mainnet'

export interface LaunchConfig {
  cluster: Cluster
  rpc: string
  genesisHash: string
  /** Phantom account that must be connected (null = any, devnet only). */
  authority: string | null
  collectionName: string
  collectionUri: string | null
  royaltyBasisPoints: number
  royaltyWallet: string | null
  paymentMint: string
  paymentDecimals: number
  /** Wallet that receives payments; its token account is derived. */
  paymentWallet: string | null
  /** Backend signer for holders-only $2 mints (OTC machine while OTC is open). */
  otcSigner: string | null
  /** Backend signer for public $5 mints (public machine; OTC machine after the flip). */
  mintSigner: string | null
  /** On-chain minimum per mint, whole tokens. The backend charges the live
   *  dollar price on top of this; it only matters if the backend is bypassed. */
  floorPrice: bigint | null
  metadataBase: string
  otcItems: number[]
  publicItems: number[]
}

const METADATA_BASE = 'https://gateway.irys.xyz/A2248P6eCF9VGp8hpr5AbdFF9HoNeocor2Ac729CJmqa/'
const HELIUS_KEY = import.meta.env.VITE_ADMIN_HELIUS_KEY as string | undefined

export const CONFIGS: Record<Cluster, LaunchConfig> = {
  // Full-size rehearsal of the mainnet setup, using the devnet test token
  // and the devnet backend's OTC signer so the deployed backend can serve it.
  devnet: {
    cluster: 'devnet',
    rpc: HELIUS_KEY ? `https://devnet.helius-rpc.com/?api-key=${HELIUS_KEY}` : 'https://api.devnet.solana.com',
    genesisHash: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
    authority: null,
    collectionName: 'NasDucks (devnet rehearsal)',
    collectionUri: 'https://nasduck.wtf',
    royaltyBasisPoints: 500,
    royaltyWallet: fixtures.wallets.treasury,
    paymentMint: fixtures.testNasduckMint,
    paymentDecimals: 6,
    paymentWallet: fixtures.wallets.treasury,
    otcSigner: rehearsal.otcSigner,
    mintSigner: rehearsal.mintSigner,
    floorPrice: BigInt(rehearsal.floorTokens),
    metadataBase: METADATA_BASE,
    otcItems: split.otc,
    publicItems: split.public,
  },
  // Fields left null must be filled in (and reviewed) before launch; the
  // page refuses to create anything on mainnet while any are missing.
  mainnet: {
    cluster: 'mainnet',
    rpc: HELIUS_KEY ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}` : 'https://api.mainnet-beta.solana.com',
    genesisHash: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
    authority: '35CgjGqpkzkdL8hbWnbLSEQzrnLpUBgkFuCYM7ZAHsYQ',
    collectionName: 'NasDucks',
    // Logo + description on Arweave (see output/collection-metadata.json).
    collectionUri: 'https://gateway.irys.xyz/vhkh4iSnZMPQJWE3BZTdHr9SrFmTDJE1w8TyhfdKXNH',
    royaltyBasisPoints: 500,
    royaltyWallet: '7uf7v4rHwDLEYwwrn9fcnYdsoS8JC7iGdMvbX7191F2V',
    paymentMint: '7Y7V1a4m2nWK7BMgbka5B4vR1pDvCK7yva3Hnrqkraze',
    paymentDecimals: 6,
    paymentWallet: '5VLFrEeyDsYkvhsf6SLbuZNkxc7PqcJ6fB6thQvonBwf', // Ledger
    otcSigner: 'DZnR9yWprW88EeuCg7eMDeD2pLPiSrNwXKdnzBt92GpV',
    mintSigner: '2kZBtWj71pWnNRKAYuNUSJGuuZLUkaiVBQybES3sfFXS',
    // Part of the $5/$2, never extra: the backend tops up to the live dollar
    // price. Set to the minimum (1 token) so price moves can never affect
    // what buyers pay; the backend signature is the real gate.
    floorPrice: 1n,
    metadataBase: METADATA_BASE,
    otcItems: split.otc,
    publicItems: split.public,
  },
}

export function missingFields(c: LaunchConfig): string[] {
  const required: (keyof LaunchConfig)[] = ['collectionUri', 'royaltyWallet', 'paymentWallet', 'otcSigner', 'mintSigner', 'floorPrice']
  return required.filter((k) => c[k] === null)
}
