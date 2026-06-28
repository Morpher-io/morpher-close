'use client';

import {
  useAccount,
  useWalletClient,
  useBalance,
  useDisconnect,
} from 'wagmi';
import type { WalletClient } from 'viem';
import { Wallet } from 'lucide-react';
import { Header } from '@/components/Header';
import { Banner } from '@/components/Banner';
import { GasStatusBar } from '@/components/GasStatusBar';
import { WalletSection } from '@/components/WalletSection';
import { ExportKeyNotice } from '@/components/ExportKeyNotice';
import { AddWalletDialog } from '@/components/AddWalletDialog';
import { useWallets } from '@/hooks/useWallets';
import {
  pickGasWallet,
  walletHasGas,
  type ConnectedWallet,
} from '@/lib/wallets';
import { Card, CardContent } from '@/components/ui/card';

export default function Home() {
  const { address: wagmiAddr, isConnected, connector } = useAccount();
  const { data: wagmiClient } = useWalletClient();
  const { data: wagmiBal } = useBalance({
    address: wagmiAddr,
    query: { refetchInterval: 30_000 },
  });
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { wallets: injected, disconnect: injDisconnect } = useWallets();

  const connected: ConnectedWallet[] = [];
  if (isConnected && wagmiAddr && wagmiClient) {
    const kind =
      connector?.id === 'walletConnect'
        ? 'wagmi-walletconnect'
        : 'wagmi-morpher';
    connected.push({
      key: connector?.uid ?? 'wagmi',
      kind,
      label:
        connector?.id === 'walletConnect' ? 'WalletConnect' : 'Morpher Wallet',
      address: wagmiAddr,
      balance: wagmiBal?.value ?? null,
      walletClient: wagmiClient as WalletClient,
    });
  }
  for (const w of injected)
    connected.push({
      key: w.id,
      kind: 'injected',
      label: w.name,
      icon: w.icon,
      address: w.address,
      balance: w.balance,
      walletClient: w.walletClient,
    });

  const gasWallet = pickGasWallet(connected);
  const anyOwnerNeedsGas = connected.some((w) => !walletHasGas(w));
  const hasMorpherWallet = connected.some((w) => w.kind === 'wagmi-morpher');

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl">
            Close your Morpher positions
          </h1>
          <p className="text-text-secondary">
            Wind down your positions on Base, then move your MPH wherever you
            want.
          </p>
        </div>

        <Banner />

        {connected.length > 0 ? (
          <div className="space-y-6">
            <GasStatusBar
              gasWallet={gasWallet}
              anyOwnerNeedsGas={anyOwnerNeedsGas}
            />

            {connected.map((w) => (
              <WalletSection
                key={w.key}
                wallet={w}
                gasWallet={gasWallet}
                isRelayer={gasWallet?.key === w.key}
                onDisconnect={
                  w.kind === 'injected'
                    ? () => injDisconnect(w.key)
                    : () => wagmiDisconnect()
                }
              />
            ))}

            {hasMorpherWallet && <ExportKeyNotice />}

            <AddWalletDialog variant="outline" label="Add another wallet" />
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Wallet className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold">Connect your wallet to begin</p>
                <p className="text-sm text-text-secondary">
                  Connect with your browser wallet, WalletConnect, or the
                  Morpher Wallet to see your open positions.
                </p>
              </div>
              <AddWalletDialog />
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="mx-auto max-w-4xl px-4 py-8 text-center text-xs text-text-secondary">
        Morpher wind-down · Base mainnet (chainId 8453) · You pay your own gas,
        or connect a wallet with Base ETH to relay it.
      </footer>
    </div>
  );
}
