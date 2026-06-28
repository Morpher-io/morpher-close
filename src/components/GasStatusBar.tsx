'use client';

import { formatUnits } from 'viem';
import { Fuel } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { shortenAddress, type ConnectedWallet } from '@/lib/wallets';

function fmtEth(v: bigint | null | undefined) {
  if (v === null || v === undefined) return '—';
  return Number(formatUnits(v, 18)).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
}

export function GasStatusBar({
  gasWallet,
  anyOwnerNeedsGas,
}: {
  gasWallet: ConnectedWallet | null;
  anyOwnerNeedsGas: boolean;
}) {
  if (gasWallet) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-text-secondary">
        <Fuel className="size-3.5 text-primary" />
        Gas paid by {gasWallet.label} ({shortenAddress(gasWallet.address)}) ·{' '}
        {fmtEth(gasWallet.balance)} ETH
      </p>
    );
  }

  if (anyOwnerNeedsGas) {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <Fuel className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-text-secondary">
            No connected wallet has Base ETH for gas. Positions in gas-less
            wallets (e.g. Morpher Wallet) can&apos;t be closed until you connect a
            browser wallet that holds Base ETH, or fund one.
          </p>
        </CardContent>
      </Card>
    );
  }

  return null;
}
