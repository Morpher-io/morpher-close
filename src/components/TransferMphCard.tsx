'use client';

import * as React from 'react';
import { formatUnits, parseUnits, isAddress, type Address } from 'viem';
import { Send, Copy, Check, Plus, Loader2, ExternalLink } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTransferMph } from '@/hooks/useTransferMph';
import { walletHasGas, shortenAddress, type ConnectedWallet } from '@/lib/wallets';
import { CONTRACTS } from '@/lib/contracts';

const MPH_DECIMALS = 18;

function fmtMph(v: bigint) {
  return Number(formatUnits(v, MPH_DECIMALS)).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
}

export function TransferMphCard({
  owner,
  gasWallet,
  mphBalance,
  onTransferred,
}: {
  owner: ConnectedWallet;
  gasWallet: ConnectedWallet | null;
  mphBalance: bigint | undefined;
  onTransferred?: () => void;
}) {
  const ownerHasGas = walletHasGas(owner);
  const relayer = !ownerHasGas && gasWallet && gasWallet.key !== owner.key ? gasWallet : null;
  const blockedNoGas = !ownerHasGas && !relayer;

  const defaultDest = relayer ? relayer.address : '';
  const [dest, setDest] = React.useState<string>(defaultDest);
  const [amount, setAmount] = React.useState<string>('');
  const [copied, setCopied] = React.useState(false);

  const {
    transfer,
    hash,
    isBusy,
    isSigning,
    isPermitting,
    isTransferring,
    isSuccess,
    error,
    reset,
  } = useTransferMph(owner, gasWallet);

  // Pre-fill the destination with the relayer once it's known — but never clobber
  // an address the user has already typed.
  React.useEffect(() => {
    setDest((cur) => (cur === '' && defaultDest ? defaultDest : cur));
  }, [defaultDest]);

  React.useEffect(() => {
    if (isSuccess) onTransferred?.();
  }, [isSuccess, onTransferred]);

  const bal = mphBalance ?? 0n;

  let parsedAmount: bigint | null = null;
  let amountError: string | null = null;
  if (amount.trim() !== '') {
    try {
      parsedAmount = parseUnits(amount.trim(), MPH_DECIMALS);
      if (parsedAmount <= 0n) amountError = 'Amount must be greater than zero';
      else if (parsedAmount > bal) amountError = 'Amount exceeds balance';
    } catch {
      amountError = 'Invalid amount';
    }
  }

  const destValid = isAddress(dest);
  const canSubmit =
    !isBusy &&
    !blockedNoGas &&
    bal > 0n &&
    destValid &&
    parsedAmount !== null &&
    !amountError;

  async function onSubmit() {
    if (!canSubmit || parsedAmount === null) return;
    reset();
    await transfer(dest as Address, parsedAmount);
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(CONTRACTS.MorpherToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — ignore.
    }
  }

  async function addToWallet() {
    const eth = (
      globalThis as { ethereum?: { request: (a: unknown) => Promise<unknown> } }
    ).ethereum;
    if (!eth) return;
    try {
      await eth.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: CONTRACTS.MorpherToken,
            symbol: 'MPH',
            decimals: MPH_DECIMALS,
          },
        },
      });
    } catch {
      // User rejected or wallet unsupported — ignore.
    }
  }

  const busyLabel = isSigning
    ? 'Sign in your wallet…'
    : isPermitting
      ? 'Approving (gasless)…'
      : isTransferring
        ? 'Transferring…'
        : 'Working…';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="size-5 text-primary" />
          Transfer MPH
        </CardTitle>
        <CardDescription>
          {relayer
            ? `This wallet holds no Base ETH — ${relayer.label} will pay the gas, you just sign the transfer (free).`
            : ownerHasGas
              ? 'Send your MPH anywhere on Base. You pay a small gas fee from this wallet.'
              : 'Connect a browser wallet that holds Base ETH to move this MPH gaslessly, or fund this wallet.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline justify-between rounded-lg border border-border bg-background px-4 py-3">
          <span className="text-sm text-text-secondary">Balance</span>
          <span className="text-lg font-bold">{fmtMph(bal)} MPH</span>
        </div>

        {isSuccess ? (
          <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
            <span className="flex items-center gap-2 font-medium text-primary">
              <Check className="size-4" />
              MPH sent
            </span>
            {hash && (
              <a
                href={`https://basescan.org/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
              >
                View tx <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Destination address
              </label>
              <Input
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                placeholder="0x…"
                spellCheck={false}
                className="font-mono"
                disabled={isBusy}
              />
              {relayer && dest.toLowerCase() === relayer.address.toLowerCase() && (
                <p className="text-xs text-text-secondary">
                  Sending to your relayer wallet ({shortenAddress(relayer.address)}).
                </p>
              )}
              {dest.trim() !== '' && !destValid && (
                <p className="text-xs text-danger">Not a valid address.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text-secondary">
                  Amount
                </label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  disabled={isBusy || bal === 0n}
                  onClick={() => setAmount(formatUnits(bal, MPH_DECIMALS))}
                >
                  Max
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  inputMode="decimal"
                  disabled={isBusy}
                />
                <span className="text-sm font-medium text-text-secondary">
                  MPH
                </span>
              </div>
              {amountError && (
                <p className="text-xs text-danger">{amountError}</p>
              )}
            </div>

            <Button
              className="w-full"
              disabled={!canSubmit}
              onClick={onSubmit}
            >
              {isBusy ? (
                <>
                  <Loader2 className="animate-spin" />
                  {busyLabel}
                </>
              ) : (
                <>
                  <Send />
                  {relayer ? 'Send MPH (gasless)' : 'Send MPH'}
                </>
              )}
            </Button>

            {error && (
              <p className="text-xs text-danger">
                {error.message.split('\n')[0]}
              </p>
            )}
          </>
        )}

        <div className="border-t border-border pt-3">
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
              onClick={copyToken}
              aria-label="Copy MPH token address"
            >
              {copied ? <Check /> : <Copy />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={addToWallet}
              aria-label="Add MPH to wallet"
            >
              <Plus />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
