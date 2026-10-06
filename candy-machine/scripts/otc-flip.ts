// Sets which backend signer a NasDucks Candy Machine requires, plus its
// on-chain floor price. Both machines always require a backend signature;
// the backend prices each mint live in dollars and tops up above the floor.
//   OTC signer  = holders-only $2 mints (the OTC machine while OTC is open)
//   mint signer = public $5 mints (the public machine, and the OTC machine
//                 after it is flipped to public)
// Keeps the guard's existing payment token + treasury. Dry run unless --apply.
//
//   npx tsx scripts/otc-flip.ts --machine <address> --signer <pubkey> --floor <base units> [--apply]
import { publicKey, some, type Umi } from '@metaplex-foundation/umi'
import { fetchCandyGuard, fetchCandyMachine, updateCandyGuard } from '@metaplex-foundation/mpl-core-candy-machine'
import { getUmi } from './_shared'

const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x))

export async function setMachineSigner(umi: Umi, opts: { machine: string; signer: string; floor: bigint; apply: boolean }) {
  const cm = await fetchCandyMachine(umi, publicKey(opts.machine))
  const guard = await fetchCandyGuard(umi, cm.mintAuthority)
  const pay = guard.guards.token2022Payment
  if (pay.__option !== 'Some') throw new Error('Machine has no token2022Payment guard — refusing to guess payment settings.')
  if (guard.groups.length) throw new Error('Machine uses guard groups — this tool only manages the default guard set.')

  const guards = {
    thirdPartySigner: some({ signerKey: publicKey(opts.signer) }),
    token2022Payment: some({ amount: opts.floor, mint: pay.value.mint, destinationAta: pay.value.destinationAta }),
  }
  const current = {
    signer: guard.guards.thirdPartySigner.__option === 'Some' ? guard.guards.thirdPartySigner.value.signerKey : null,
    floor: pay.value.amount,
    mint: pay.value.mint,
    destination: pay.value.destinationAta,
  }
  console.log(`machine:  ${opts.machine}  (${Number(cm.itemsRedeemed)}/${Number(cm.data.itemsAvailable)} minted)`)
  console.log(`current:  ${json(current)}`)
  console.log(`new:      ${json({ ...current, signer: opts.signer, floor: opts.floor })}`)
  if (!opts.apply) {
    console.log('dry run — nothing changed. Re-run with --apply to switch.')
    return
  }
  await updateCandyGuard(umi, { candyGuard: guard.publicKey, guards, groups: [] }).sendAndConfirm(umi)
  // RPC nodes can briefly serve the pre-update account, so re-read a few
  // times before calling it a mismatch.
  let ok = false
  for (let attempt = 0; attempt < 10 && !ok; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500))
    const after = (await fetchCandyGuard(umi, cm.mintAuthority, { commitment: 'confirmed' })).guards
    ok =
      after.thirdPartySigner.__option === 'Some' &&
      after.thirdPartySigner.value.signerKey === opts.signer &&
      after.token2022Payment.__option === 'Some' &&
      after.token2022Payment.value.amount === opts.floor
  }
  console.log(ok ? 'updated — verified on-chain' : 'WARNING: on-chain guard does not match what was requested')
  if (!ok) throw new Error('guard update verification failed')
}

if (process.argv[1]?.endsWith('otc-flip.ts')) {
  const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`)
    return i > -1 ? process.argv[i + 1] : undefined
  }
  const machine = arg('machine')
  const signer = arg('signer')
  const floor = arg('floor')
  if (!machine || !signer || !floor || !/^\d+$/.test(floor)) {
    console.error('usage: --machine <address> --signer <pubkey> --floor <base units> [--apply]')
    process.exit(1)
  }
  setMachineSigner(getUmi(), { machine, signer, floor: BigInt(floor), apply: process.argv.includes('--apply') }).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
