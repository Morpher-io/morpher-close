import { createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { walletConnect } from 'wagmi/connectors';
import { morpherWalletConnector } from './morpherWalletConnector';

const BASE_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ?? 'https://mainnet.base.org';

const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'PLACEHOLDER_PROJECT_ID';

// viem's `base` chain already includes multicall3 at
// 0xcA11bde05977b3631167028862bE2a173976CA11.
// No explicit injected() connector: EIP-6963 discovery (multiInjectedProviderDiscovery,
// on by default) surfaces installed browser wallets (MetaMask, Rabby, ...) as their own
// connectors, so a generic injected() would just duplicate them and cause mis-mapping.
export const config = createConfig({
  chains: [base],
  connectors: [
    walletConnect({ projectId: WALLETCONNECT_PROJECT_ID, showQrModal: true }),
    morpherWalletConnector(),
  ],
  transports: {
    [base.id]: http(BASE_RPC_URL),
  },
  ssr: true,
});
