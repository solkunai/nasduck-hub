// Computes the REAL Candy Machine account size using the package's own
// getCandyMachineSize() function, then asks a live Solana RPC for the
// actual current rent-exemption cost for that many bytes — no hand-rolled
// formula, no guessing.
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { getCandyMachineSize } from '@metaplex-foundation/mpl-core-candy-machine'

async function main() {
  const itemsAvailable = 5555
  // Real naming scheme: prefixName "NasDucks #" + 4-digit zero-padded
  // number (e.g. "0001".."5555") = nameLength 4. prefixUri is the fixed
  // Irys manifest base + 4-digit number + ".json" = uriLength 9.
  const nameLength = 4
  const uriLength = 9

  const bytes = getCandyMachineSize(itemsAvailable, { nameLength, uriLength })
  console.log(`account size: ${bytes.toLocaleString()} bytes`)

  const umi = createUmi('https://api.mainnet-beta.solana.com')
  const lamports = await umi.rpc.getRent(bytes)
  const sol = Number(lamports.basisPoints) / 1e9
  console.log(`rent-exempt minimum: ${lamports.basisPoints.toString()} lamports = ${sol.toFixed(4)} SOL`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
