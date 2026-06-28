'use client';

/* eslint-disable @next/next/no-img-element */
import { formatUnits } from 'viem';
import { Unplug, Wallet as WalletIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PositionsList } from './PositionsList';
import { CashOutCard } from './CashOutCard';
import { shortenAddress, type ConnectedWallet } from '@/lib/wallets';

function fmtEth(v: bigint | null | undefined) {
  if (v === null || v === undefined) return '—';
  return Number(formatUnits(v, 18)).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
}

export function WalletSection({
  wallet,
  gasWallet,
  isRelayer,
  onDisconnect,
}: {
  wallet: ConnectedWallet;
  gasWallet: ConnectedWallet | null;
  isRelayer: boolean;
  onDisconnect: () => void;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {wallet.icon ? (
            <img
              src={wallet.icon}
              alt=""
              className="size-9 shrink-0 rounded-full"
            />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <WalletIcon className="size-5" />
            </div>
          )}
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{wallet.label}</p>
              {isRelayer && (
                <Badge variant="accent">Relayer ⛽</Badge>
              )}
            </div>
            <p className="font-mono text-xs text-text-secondary">
              {shortenAddress(wallet.address)} · {fmtEth(wallet.balance)} ETH
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onDisconnect}>
          <Unplug />
          Disconnect
        </Button>
      </div>

      <PositionsList
        address={wallet.address}
        owner={wallet}
        gasWallet={gasWallet}
      />
      <CashOutCard address={wallet.address} />
    </section>
  );
}
