import { createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { walletConnect } from 'wagmi/connectors';
import { morpherWalletConnector } from './morpherWalletConnector';

const BASE_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ?? 'https://mainnet.base.org';

// Public, domain-whitelisted WalletConnect (Reown) projectId — whitelisted to
// close.morpher.com + localhost:3000. Safe to commit (it's a client-side id, gated by domain).
// `||` (not `??`) so an empty env var still falls back to this default.
const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '2b09d85e0c2013c83c59f688f5beb307';

// viem's `base` chain already includes multicall3 at
// 0xcA11bde05977b3631167028862bE2a173976CA11.
//
// multiInjectedProviderDiscovery is DISABLED on purpose: the relayer (a browser wallet like
// Rabby) is connected separately via useRelayer's own EIP-6963 discovery, purely to pay gas.
// If wagmi also discovered that injected provider, calling eth_requestAccounts on it (to connect
// the relayer) would make wagmi grab it as the active account — hijacking the trade wallet
// (header + positions would flip to the relayer). Disabling discovery keeps the trade wallet
// (Morpher Wallet / WalletConnect) as the single wagmi connection; the relayer stays gas-only.
export const config = createConfig({
  chains: [base],
  multiInjectedProviderDiscovery: false,
  connectors: [
    walletConnect({ projectId: WALLETCONNECT_PROJECT_ID, showQrModal: true }),
    morpherWalletConnector(),
  ],
  transports: {
    [base.id]: http(BASE_RPC_URL),
  },
  ssr: true,
});
