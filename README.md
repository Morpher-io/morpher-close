# Morpher — Close your positions

A minimal, static, public dapp for the **Morpher wind-down on Base**. It lets
users connect a wallet, see their open Morpher positions, close each one at its
locked final price, and then cash out their now-freely-transferable MPH.

It is intentionally tiny and fully **static** — it ships as a Next.js static
export and is hosted on GitHub Pages.

## What it does

- Scans the bundled Morpher market list on-chain (`TradeEngine.portfolio`) for
  the connected address and lists any positions with open shares.
- Closes a full position via `MorpherOracle.createOrder` (opposite trade
  direction, full share amount, zero MPH in). Markets being wound down settle
  at a **locked exit price** (`getDeactivatedMarketPrice`).
- After closing, MPH is freely transferable. The cash-out card shows the MPH
  token address (copy button), an "Add MPH to MetaMask" button
  (`wallet_watchAsset`), and the live MPH balance.
- Prominently reminds embedded **Morpher Wallet** users to export their private
  key / seed so they keep access to their funds independently of Morpher's
  servers.

You pay your own Base ETH gas for every transaction.

## Stack

- Next.js 15 (app router, `output: 'export'`) + React 19 + TypeScript
- Tailwind CSS v4 (`@tailwindcss/postcss`)
- Hand-written shadcn-style primitives (Button, Card, Dialog, Badge) with
  `class-variance-authority` + `clsx` + `tailwind-merge`, `lucide-react` icons
- wagmi v2 + viem v2 + `@tanstack/react-query` v5
- Dual wallet support: `injected()`, `walletConnect()`, and a custom
  **Morpher Wallet** connector (`morpherwallet-sdk`)
- Package manager: **bun**

## Run

```bash
bun install
bun run dev      # local dev at http://localhost:3000
bun run build    # static export to ./out
```

Copy `.env.example` to `.env.local` and fill in values (a real
`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is needed for WalletConnect; the others
have sensible defaults).

## Hosting on GitHub Pages

`bun run build` produces a static site in `out/`. Publish that directory to
GitHub Pages (e.g. via a `gh-pages` branch or an Actions workflow). Because
`next.config.mjs` uses `output: 'export'`, `images: { unoptimized: true }`, and
`trailingSlash: true`, the export is fully static and self-contained.

### Morpher Wallet origin note

The embedded Morpher Wallet validates the parent page origin. To use the
**Morpher Wallet** connector from a custom domain such as
`close.morpher.com`, the Morpher Wallet's `parentOrigin` allow-list regex must
be patched to permit that origin. The `injected()` and `walletConnect()`
connectors work from any origin without changes.

## Contracts (Base mainnet, chainId 8453)

| Contract            | Address                                      |
| ------------------- | -------------------------------------------- |
| MorpherOracle       | `0x694aa11EC58b7dE7F1bb3a83dae00dCa55Dc986B` |
| MorpherState        | `0x361e10a8fa2C9a5c339Dbd2B3f1b6f6a22c2618F` |
| MorpherTradeEngine  | `0x42747a45FAA00a55EC17c02AC8b1A360d4827a54` |
| MorpherToken (MPH)  | `0x537C96C822C15b8361f4DbbE56805bd4E60d0F05` |
