'use client';

import { useAccount } from 'wagmi';
import { Wallet } from 'lucide-react';
import { Header } from '@/components/Header';
import { Banner } from '@/components/Banner';
import { PositionsList } from '@/components/PositionsList';
import { RelayerBar } from '@/components/RelayerBar';
import { CashOutCard } from '@/components/CashOutCard';
import { ExportKeyNotice } from '@/components/ExportKeyNotice';
import { ConnectButton } from '@/components/ConnectButton';
import { Card, CardContent } from '@/components/ui/card';

export default function Home() {
  const { address, isConnected } = useAccount();

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

        {isConnected && address ? (
          <div className="space-y-6">
            <RelayerBar address={address} />
            <PositionsList address={address} />
            <CashOutCard address={address} />
            <ExportKeyNotice />
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
              <ConnectButton />
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="mx-auto max-w-4xl px-4 py-8 text-center text-xs text-text-secondary">
        Morpher wind-down · Base mainnet (chainId 8453) · You pay your own gas.
      </footer>
    </div>
  );
}
