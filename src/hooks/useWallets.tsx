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

export interface InjectedWallet {
  id: string; // EIP-6963 uuid
  name: string;
  icon?: string;
  address: Address;
  walletClient: WalletClient;
  balance: bigint | null; // Base ETH
}

interface WalletsContextValue {
  providers: EIP6963ProviderDetail[]; // discovered (for the Add-wallet list)
  wallets: InjectedWallet[]; // connected injected wallets
  connect: (detail: EIP6963ProviderDetail) => Promise<void>;
  disconnect: (id: string) => void;
}

const BASE_HEX = '0x2105'; // 8453
const BASE_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ?? 'https://mainnet.base.org';

// Module-level public client for balance reads.
const publicClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_URL),
});

const WalletsContext = React.createContext<WalletsContextValue | null>(null);

export function WalletsProvider({ children }: { children: React.ReactNode }) {
  const [providers, setProviders] = React.useState<EIP6963ProviderDetail[]>([]);
  const [wallets, setWallets] = React.useState<InjectedWallet[]>([]);

  // Keep a ref in sync with the current wallet list so the periodic refresh
  // effect can read it without depending on `wallets` (avoids resubscribe churn).
  const walletsRef = React.useRef<InjectedWallet[]>(wallets);
  walletsRef.current = wallets;

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
    if (!account) throw new Error('No account returned from wallet');

    // Ensure the wallet is on Base.
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

    // Fetch the wallet's Base ETH balance.
    let balance: bigint | null = null;
    try {
      balance = await publicClient.getBalance({ address: account });
    } catch {
      balance = null;
    }

    const newWallet: InjectedWallet = {
      id: detail.info.uuid,
      name: detail.info.name,
      icon: detail.info.icon,
      address: account,
      walletClient,
      balance,
    };

    // Dedupe by uuid AND address.
    setWallets((prev) => [
      ...prev.filter(
        (w) =>
          w.id !== detail.info.uuid &&
          w.address.toLowerCase() !== account.toLowerCase(),
      ),
      newWallet,
    ]);
  }, []);

  const disconnect = React.useCallback((id: string) => {
    setWallets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  // Periodic balance refresh — mounted once; reads the current list via ref.
  React.useEffect(() => {
    const interval = setInterval(async () => {
      const current = walletsRef.current;
      if (current.length === 0) return;
      const updates = await Promise.all(
        current.map(async (w) => {
          try {
            const bal = await publicClient.getBalance({ address: w.address });
            return { address: w.address.toLowerCase(), balance: bal };
          } catch {
            return null;
          }
        }),
      );
      const byAddress = new Map<string, bigint>();
      for (const u of updates) {
        if (u) byAddress.set(u.address, u.balance);
      }
      if (byAddress.size === 0) return;
      setWallets((prev) =>
        prev.map((w) => {
          const next = byAddress.get(w.address.toLowerCase());
          return next === undefined ? w : { ...w, balance: next };
        }),
      );
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  const value = React.useMemo<WalletsContextValue>(
    () => ({ providers, wallets, connect, disconnect }),
    [providers, wallets, connect, disconnect],
  );

  return (
    <WalletsContext.Provider value={value}>{children}</WalletsContext.Provider>
  );
}

export function useWallets(): WalletsContextValue {
  const ctx = React.useContext(WalletsContext);
  if (!ctx) throw new Error('useWallets must be used within a WalletsProvider');
  return ctx;
}
