'use client';

import * as React from 'react';
import { formatUnits, type Address } from 'viem';
import { useBalance } from 'wagmi';
import { Copy, Check, Fuel, Plug, Unplug } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRelayer } from '@/hooks/useRelayer';

function shorten(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtEth(v: bigint | null | undefined) {
  if (v === null || v === undefined) return '—';
  return Number(formatUnits(v, 18)).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
}

export function RelayerBar({ address }: { address: Address }) {
  const { providers, relayer, balance, connect, disconnect } = useRelayer();
  const [copied, setCopied] = React.useState(false);
  const [connecting, setConnecting] = React.useState(false);
  const [connectError, setConnectError] = React.useState<string | null>(null);

  // The connected trade wallet's native Base ETH balance.
  const { data: gasBalance } = useBalance({
    address,
    query: { refetchInterval: 30_000 },
  });

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — ignore.
    }
  }

  async function handleConnect(detail: (typeof providers)[number]) {
    setConnectError(null);
    setConnecting(true);
    try {
      await connect(detail);
    } catch (err) {
      setConnectError(
        err instanceof Error ? err.message.split('\n')[0] : String(err),
      );
    } finally {
      setConnecting(false);
    }
  }

  // Relayer connected: gas is covered, closes route through it automatically.
  if (relayer) {
    return (
      <Card className="border-primary/40">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Fuel className="size-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Gas paid by relayer</p>
              <p className="font-mono text-xs text-text-secondary">
                {shorten(relayer.address)} · {fmtEth(balance)} ETH
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => disconnect()}>
            <Unplug />
            Disconnect relayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasGas = (gasBalance?.value ?? 0n) > 0n;

  // Trade wallet can pay its own gas — no relayer needed.
  if (hasGas) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-text-secondary">
        <Fuel className="size-3.5 text-primary" />
        Gas ready · {fmtEth(gasBalance?.value)} ETH on Base
      </p>
    );
  }

  // Trade wallet has no Base ETH — offer to fund it or connect a relayer.
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fuel className="size-5 text-primary" />
          Your wallet has no Base ETH to pay gas
        </CardTitle>
        <CardDescription>
          Closing a position is an on-chain transaction. Either fund this wallet
          with a little Base ETH, or connect a separate wallet to pay the gas for
          you — your trade wallet only signs (free).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">
            Option 1 · Send Base ETH to your address
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs">
              {address}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={copyAddress}
              aria-label="Copy your address"
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">
            Option 2 · Connect a relayer wallet to pay the gas
          </p>
          {providers.length === 0 ? (
            <p className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-secondary">
              No browser wallet detected. Install Rabby, MetaMask, or another
              wallet to use as a relayer.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {providers.map((detail) => (
                <Button
                  key={detail.info.uuid}
                  variant="outline"
                  className="justify-start"
                  disabled={connecting}
                  onClick={() => handleConnect(detail)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {detail.info.icon ? (
                    <img
                      src={detail.info.icon}
                      alt=""
                      className="size-4 shrink-0 rounded"
                    />
                  ) : (
                    <Plug />
                  )}
                  {detail.info.name}
                </Button>
              ))}
            </div>
          )}
          {connectError && (
            <p className="mt-2 text-xs text-danger">{connectError}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
