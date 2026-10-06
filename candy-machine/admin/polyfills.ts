// @solana/web3.js (used under Umi) expects Node's Buffer global in the browser.
import { Buffer } from 'buffer'

;(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer
