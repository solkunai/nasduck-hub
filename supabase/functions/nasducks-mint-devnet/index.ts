// Devnet test copy of nasducks-mint: same code, its own DEVNET_* settings
// (see the prefix handling at the top of ../nasducks-mint/index.ts). It
// refuses to run on anything but devnet and never touches the live page's
// stats. Used to test backend changes without taking the live mint offline.
;(globalThis as { NASDUCKS_ENV_PREFIX?: string }).NASDUCKS_ENV_PREFIX = 'DEVNET_'
await import('../nasducks-mint/index.ts')
