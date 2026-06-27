'use client';

import * as React from 'react';
import { formatUnits } from 'viem';
import { ArrowUpRight, ArrowDownRight, Check, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useClosePosition } from '@/hooks/useClosePosition';
import type { Position } from '@/hooks/usePositions';

function fmtShares(v: bigint) {
  const n = Number(formatUnits(v, 18));
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function fmtPrice(v: bigint) {
  // Morpher market prices are stored with 8 decimals.
  const n = Number(formatUnits(v, 8));
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function PositionCard({
  position,
  onClosed,
}: {
  position: Position;
  onClosed?: () => void;
}) {
  const { close, isPending, isConfirming, isSuccess, error } =
    useClosePosition();

  React.useEffect(() => {
    if (isSuccess) onClosed?.();
  }, [isSuccess, onClosed]);

  const isLong = position.direction === 'long';
  const busy = isPending || isConfirming;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{position.name}</span>
            <Badge variant={isLong ? 'default' : 'danger'}>
              {isLong ? (
                <ArrowUpRight className="mr-1 size-3" />
              ) : (
                <ArrowDownRight className="mr-1 size-3" />
              )}
              {isLong ? 'Long' : 'Short'}
            </Badge>
          </div>
          <p className="text-sm text-text-secondary">
            {fmtShares(position.shares)} shares
            {position.deactivatedPrice > 0n && (
              <>
                {' · '}
                <span className="text-text-primary">
                  Locked exit price: {fmtPrice(position.deactivatedPrice)}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSuccess ? (
            <Badge variant="default">
              <Check className="mr-1 size-3" />
              Closed
            </Badge>
          ) : (
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => close(position)}
            >
              {busy && <Loader2 className="animate-spin" />}
              {isPending
                ? 'Confirm…'
                : isConfirming
                  ? 'Closing…'
                  : 'Close'}
            </Button>
          )}
        </div>
      </CardContent>
      {error && (
        <p className="px-4 pb-3 text-xs text-danger">
          {error.message.split('\n')[0]}
        </p>
      )}
    </Card>
  );
}
