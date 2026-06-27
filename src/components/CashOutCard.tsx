'use client';

import * as React from 'react';
import { formatUnits, type Address } from 'viem';
import { useReadContract } from 'wagmi';
import { Copy, Check, Plus, Coins } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CONTRACTS, TOKEN_ABI } from '@/lib/contracts';

const MPH_DECIMALS = 18;

export function CashOutCard({ address }: { address: Address }) {
  const [copied, setCopied] = React.useState(false);

  const { data: balance } = useReadContract({
    address: CONTRACTS.MorpherToken,
    abi: TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address],
    query: { refetchInterval: 30_000 },
  });

  const { data: symbol } = useReadContract({
    address: CONTRACTS.MorpherToken,
    abi: TOKEN_ABI,
    functionName: 'symbol',
  });

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(CONTRACTS.MorpherToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — ignore.
    }
  }

  async function addToWallet() {
    const eth = (globalThis as { ethereum?: { request: (a: unknown) => Promise<unknown> } })
      .ethereum;
    if (!eth) return;
    try {
      await eth.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: CONTRACTS.MorpherToken,
            symbol: (symbol as string) ?? 'MPH',
            decimals: MPH_DECIMALS,
          },
        },
      });
    } catch {
      // User rejected or wallet unsupported — ignore.
    }
  }

  const formattedBalance =
    balance !== undefined
      ? Number(formatUnits(balance as bigint, MPH_DECIMALS)).toLocaleString(
          undefined,
          { maximumFractionDigits: 4 },
        )
      : '—';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="size-5 text-primary" />
          Cash out your MPH
        </CardTitle>
        <CardDescription>
          Once a position is closed, your MPH is freely transferable. Send it to
          any wallet or exchange that supports MPH on Base.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline justify-between rounded-lg border border-border bg-background px-4 py-3">
          <span className="text-sm text-text-secondary">Your MPH balance</span>
          <span className="text-lg font-bold">
            {formattedBalance} {(symbol as string) ?? 'MPH'}
          </span>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">
            MPH token (Base)
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs">
              {CONTRACTS.MorpherToken}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={copyAddress}
              aria-label="Copy MPH token address"
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
        </div>

        <Button variant="secondary" onClick={addToWallet} className="w-full">
          <Plus />
          Add MPH to MetaMask
        </Button>
      </CardContent>
    </Card>
  );
}
