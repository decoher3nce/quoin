/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Served under a "/quoin/" path prefix so it can sit behind the home reverse-proxy
// gateway (Caddy on the Tailscale host) alongside other apps, reachable at
//     http://<PUBLIC_HOST>/quoin/
// `base` matches the prefix so asset URLs resolve under it (also convenient for a
// GitHub Pages project site at /quoin/). The gateway forwards the prefixed path
// un-stripped and rewrites Host→localhost.
//
// PUBLIC_HOST is the bare short-name of the gateway host. It is read from
// .env.local (gitignored) so the deployment hostname never lands in the repo —
// see .env.example. It is only used to widen the dev server's allowedHosts for
// DIRECT short-name access; proxied access already works via the Host rewrite.
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ''); // '' prefix ⇒ load unprefixed vars like PUBLIC_HOST
  const publicHost = env.PUBLIC_HOST?.trim();
  return {
    base: '/quoin/',
    plugins: [react(), tailwindcss()],
    server: {
      host: true, // bind all interfaces so it's reachable across the tailnet
      port: 5174, // distinct from other local dev servers (e.g. brambletooth :5173)
      strictPort: true, // fail loudly rather than drift — the gateway expects 5174
      allowedHosts: ['.tail7e6e30.ts.net', 'localhost', ...(publicHost ? [publicHost] : [])],
    },
    preview: {
      port: 5174,
      strictPort: true,
      allowedHosts: ['.tail7e6e30.ts.net', 'localhost', ...(publicHost ? [publicHost] : [])],
    },
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  };
});
