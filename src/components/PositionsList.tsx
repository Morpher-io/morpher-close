'use client';

import { Loader2 } from 'lucide-react';
import type { Address } from 'viem';
import { usePositions } from '@/hooks/usePositions';
import { PositionCard } from './PositionCard';
import { Card, CardContent } from '@/components/ui/card';

export function PositionsList({ address }: { address: Address }) {
  const { data: positions, isLoading, isError, error, refetch } =
    usePositions(address);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-6 text-text-secondary">
          <Loader2 className="size-5 animate-spin" />
          Scanning markets for your positions…
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-danger">
          Failed to load positions: {error?.message}
        </CardContent>
      </Card>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-text-secondary">
          No open positions found. If you just closed a position, it may take a
          few moments to settle on-chain.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-text-secondary">
        Your open positions ({positions.length})
      </h2>
      {positions.map((p) => (
        <PositionCard key={p.name} position={p} onClosed={() => refetch()} />
      ))}
    </div>
  );
}
