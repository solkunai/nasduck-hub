import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

// Local-only admin page for creating and operating the NasDucks Candy
// Machines with the authority signing in Phantom. Never built or deployed:
// run it with `npm run admin` from candy-machine/.
export default defineConfig(({ mode }) => {
  // candy-machine/.env (gitignored). Only the Helius key is exposed, and only
  // to this local page, for a reliable RPC.
  const here = fileURLToPath(new URL('.', import.meta.url))
  const env = loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), '')
  return {
    root: here,
    server: { host: 'localhost', port: 5180, strictPort: true },
    define: { 'import.meta.env.VITE_ADMIN_HELIUS_KEY': JSON.stringify(env.HELIUS_API_KEY ?? '') },
  }
})
