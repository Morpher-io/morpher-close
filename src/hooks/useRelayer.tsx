'use client';

import * as React from 'react';
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  type Address,
  type WalletClient,
} from 'viem';
import { base } from 'viem/chains';

// ---- EIP-6963 multi-injected provider discovery ----

interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: EIP1193Provider;
}

interface EIP6963AnnounceEvent extends CustomEvent {
  detail: EIP6963ProviderDetail;
}

export interface Relayer {
  address: Address;
  walletClient: WalletClient;
}

interface RelayerContextValue {
  providers: EIP6963ProviderDetail[];
  relayer: Relayer | null;
  balance: bigint | null;
  connect: (detail: EIP6963ProviderDetail) => Promise<void>;
  disconnect: () => void;
}

const BASE_HEX = '0x2105'; // 8453
const BASE_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ?? 'https://mainnet.base.org';

const RelayerContext = React.createContext<RelayerContextValue | null>(null);

export function RelayerProvider({ children }: { children: React.ReactNode }) {
  const [providers, setProviders] = React.useState<EIP6963ProviderDetail[]>([]);
  const [relayer, setRelayer] = React.useState<Relayer | null>(null);
  const [balance, setBalance] = React.useState<bigint | null>(null);

  // Discover injected wallets via EIP-6963.
  React.useEffect(() => {
    function onAnnounce(event: Event) {
      const { detail } = event as EIP6963AnnounceEvent;
      setProviders((prev) => {
        if (prev.some((p) => p.info.uuid === detail.info.uuid)) return prev;
        return [...prev, detail];
      });
    }

    window.addEventListener('eip6963:announceProvider', onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    return () => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
    };
  }, []);

  const connect = React.useCallback(async (detail: EIP6963ProviderDetail) => {
    const provider = detail.provider;

    const accounts = (await provider.request({
      method: 'eth_requestAccounts',
    })) as string[];
    const account = accounts?.[0] as Address | undefined;
    if (!account) throw new Error('No account returned from relayer wallet');

    // Ensure the relayer is on Base.
    const chainId = (await provider.request({ method: 'eth_chainId' })) as string;
    if (chainId !== BASE_HEX) {
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BASE_HEX }],
        });
      } catch (err) {
        // 4902 = chain not added to wallet — add Base, then it becomes active.
        const code = (err as { code?: number })?.code;
        if (code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: BASE_HEX,
                chainName: 'Base',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org'],
              },
            ],
          });
        } else {
          throw err;
        }
      }
    }

    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: custom(provider),
    });

    setRelayer({ address: account, walletClient });

    // Fetch the relayer's Base ETH balance via a public client.
    const publicClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    });
    try {
      const bal = await publicClient.getBalance({ address: account });
      setBalance(bal);
    } catch {
      setBalance(null);
    }
  }, []);

  const disconnect = React.useCallback(() => {
    setRelayer(null);
    setBalance(null);
  }, []);

  const value = React.useMemo<RelayerContextValue>(
    () => ({ providers, relayer, balance, connect, disconnect }),
    [providers, relayer, balance, connect, disconnect],
  );

  return (
    <RelayerContext.Provider value={value}>{children}</RelayerContext.Provider>
  );
}

export function useRelayer(): RelayerContextValue {
  const ctx = React.useContext(RelayerContext);
  if (!ctx) throw new Error('useRelayer must be used within a RelayerProvider');
  return ctx;
}
