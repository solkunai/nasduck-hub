// Switches the OTC Candy Machine between its two modes:
//   --to otc     holders-only: requires the OTC backend's signature, OTC price
//   --to public  open to anyone: no backend signature, public price
// Keeps the guard's existing payment token + treasury; only the price and the
// signer requirement change. Dry run unless --apply is passed.
//
//   npx tsx scripts/otc-flip.ts --machine <address> --to public --amount <base units> [--apply]
//   npx tsx scripts/otc-flip.ts --machine <address> --to otc --signer <pubkey> --amount <base units> [--apply]
import { publicKey, some, type Umi } from '@metaplex-foundation/umi'
import { fetchCandyGuard, fetchCandyMachine, updateCandyGuard } from '@metaplex-foundation/mpl-core-candy-machine'
import { getUmi } from './_shared'

const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x))

export async function flipOtcMachine(umi: Umi, opts: { machine: string; to: 'otc' | 'public'; amount: bigint; signer?: string; apply: boolean }) {
  const cm = await fetchCandyMachine(umi, publicKey(opts.machine))
  const guard = await fetchCandyGuard(umi, cm.mintAuthority)
  const pay = guard.guards.token2022Payment
  if (pay.__option !== 'Some') throw new Error('Machine has no token2022Payment guard — refusing to guess payment settings.')
  if (guard.groups.length) throw new Error('Machine uses guard groups — this tool only manages the default guard set.')

  const payment = some({ amount: opts.amount, mint: pay.value.mint, destinationAta: pay.value.destinationAta })
  const guards =
    opts.to === 'otc'
      ? { thirdPartySigner: some({ signerKey: publicKey(opts.signer!) }), token2022Payment: payment }
      : { token2022Payment: payment }

  const current = {
    thirdPartySigner: guard.guards.thirdPartySigner.__option === 'Some' ? guard.guards.thirdPartySigner.value.signerKey : null,
    price: pay.value.amount,
    mint: pay.value.mint,
    destination: pay.value.destinationAta,
  }
  const next = { thirdPartySigner: opts.to === 'otc' ? opts.signer : null, price: opts.amount, mint: pay.value.mint, destination: pay.value.destinationAta }
  console.log(`machine:  ${opts.machine}  (${Number(cm.itemsRedeemed)}/${Number(cm.data.itemsAvailable)} minted)`)
  console.log(`current:  ${json(current)}`)
  console.log(`new (${opts.to}): ${json(next)}`)
  if (!opts.apply) {
    console.log('dry run — nothing changed. Re-run with --apply to switch.')
    return
  }
  await updateCandyGuard(umi, { candyGuard: guard.publicKey, guards, groups: [] }).sendAndConfirm(umi)
  const after = await fetchCandyGuard(umi, cm.mintAuthority)
  const ok =
    (opts.to === 'otc'
      ? after.guards.thirdPartySigner.__option === 'Some' && after.guards.thirdPartySigner.value.signerKey === opts.signer
      : after.guards.thirdPartySigner.__option === 'None') &&
    after.guards.token2022Payment.__option === 'Some' &&
    after.guards.token2022Payment.value.amount === opts.amount
  console.log(ok ? `switched to ${opts.to} — verified on-chain` : 'WARNING: on-chain guard does not match what was requested')
  if (!ok) throw new Error('flip verification failed')
}

if (process.argv[1]?.endsWith('otc-flip.ts')) {
  const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`)
    return i > -1 ? process.argv[i + 1] : undefined
  }
  const machine = arg('machine')
  const to = arg('to')
  const amount = arg('amount')
  const signer = arg('signer')
  if (!machine || (to !== 'otc' && to !== 'public') || !amount || !/^\d+$/.test(amount) || (to === 'otc' && !signer)) {
    console.error('usage: --machine <address> --to otc|public --amount <base units> [--signer <pubkey> for otc] [--apply]')
    process.exit(1)
  }
  flipOtcMachine(getUmi(), { machine, to, amount: BigInt(amount), signer, apply: process.argv.includes('--apply') }).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
