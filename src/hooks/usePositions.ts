'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import type { Address } from 'viem';
import { CONTRACTS, TRADE_ENGINE_ABI, PRECISION } from '@/lib/contracts';
import { MARKET_NAMES, marketIdHash } from '@/lib/markets';

export interface Position {
  name: string;
  longShares: bigint;
  shortShares: bigint;
  meanEntryPrice: bigint;
  direction: 'long' | 'short';
  shares: bigint; // shares of the held side (PRECISION-scaled)
  deactivatedPrice: bigint; // 0 = market not yet frozen
  estimatedMph: bigint; // est. MPH returned on close; 0 unless a locked price is set
}

const CHUNK_SIZE = 120;
const TE = CONTRACTS.MorpherTradeEngine as Address;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function usePositions(address?: Address) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ['positions', address],
    enabled: Boolean(address && publicClient),
    staleTime: 30_000,
    queryFn: async (): Promise<Position[]> => {
      if (!address || !publicClient) return [];

      const names = MARKET_NAMES;
      const hashes = names.map((n) => marketIdHash(n));

      // 1) Multicall portfolio() over all markets, chunked.
      const portfolioResults: Array<
        { status: 'success'; result: readonly bigint[] } | { status: 'failure' }
      > = [];
      for (const idxChunk of chunk(
        names.map((_, i) => i),
        CHUNK_SIZE,
      )) {
        const res = await publicClient.multicall({
          allowFailure: true,
          contracts: idxChunk.map((i) => ({
            address: TE,
            abi: TRADE_ENGINE_ABI,
            functionName: 'portfolio' as const,
            args: [address, hashes[i]] as const,
          })),
        });
        for (const r of res) {
          portfolioResults.push(
            r.status === 'success'
              ? { status: 'success', result: r.result as unknown as readonly bigint[] }
              : { status: 'failure' },
          );
        }
      }

      // 2) Keep markets with a non-zero position (capture the fields share-value needs).
      const held: Array<{
        index: number;
        name: string;
        lastUpdated: bigint;
        longShares: bigint;
        shortShares: bigint;
        meanEntryPrice: bigint;
        meanEntryLeverage: bigint;
        direction: 'long' | 'short';
        shares: bigint;
        deactivatedPrice: bigint;
      }> = [];

      portfolioResults.forEach((r, i) => {
        if (r.status !== 'success') return;
        // portfolio tuple: [lastUpdated, longShares, shortShares, meanEntryPrice,
        //                   meanEntrySpread, meanEntryLeverage, liquidationPrice, hash]
        const [lastUpdated, longShares, shortShares, meanEntryPrice, , meanEntryLeverage] =
          r.result;
        if ((longShares ?? 0n) > 0n || (shortShares ?? 0n) > 0n) {
          const direction = (longShares ?? 0n) >= (shortShares ?? 0n) ? 'long' : 'short';
          held.push({
            index: i,
            name: names[i],
            lastUpdated: lastUpdated ?? 0n,
            longShares: longShares ?? 0n,
            shortShares: shortShares ?? 0n,
            meanEntryPrice: meanEntryPrice ?? 0n,
            meanEntryLeverage: meanEntryLeverage ?? 0n,
            direction,
            shares: direction === 'long' ? (longShares ?? 0n) : (shortShares ?? 0n),
            deactivatedPrice: 0n,
          });
        }
      });

      if (held.length === 0) return [];

      // 3) Locked exit price per held market.
      const priceResults = await publicClient.multicall({
        allowFailure: true,
        contracts: held.map((h) => ({
          address: TE,
          abi: TRADE_ENGINE_ABI,
          functionName: 'getDeactivatedMarketPrice' as const,
          args: [hashes[h.index]] as const,
        })),
      });
      held.forEach((h, i) => {
        const r = priceResults[i];
        h.deactivatedPrice = r?.status === 'success' ? (r.result as unknown as bigint) : 0n;
      });

      // 4) For markets WITH a locked price, estimate the MPH a close returns:
      //    estimatedMph = shares * shareValue(lockedPrice) / PRECISION. (≈ — interest accrues
      //    until the actual close.) No estimate without a locked price.
      const valued = held.filter((h) => h.deactivatedPrice > 0n);
      const estByName = new Map<string, bigint>();
      if (valued.length > 0) {
        const valueResults = await publicClient.multicall({
          allowFailure: true,
          contracts: valued.map((h) => ({
            address: TE,
            abi: TRADE_ENGINE_ABI,
            functionName: h.direction === 'long' ? 'longShareValue' : 'shortShareValue',
            args: [
              h.meanEntryPrice,
              h.meanEntryLeverage,
              h.lastUpdated,
              h.deactivatedPrice, // market price = locked price
              0n, // spread (deactivated close settles at locked mid, spread 0)
              h.meanEntryLeverage, // order leverage = position leverage (full close)
              true, // sell
            ] as const,
          })),
        });
        valued.forEach((h, i) => {
          const r = valueResults[i];
          if (r?.status === 'success') {
            const shareValue = r.result as unknown as bigint;
            estByName.set(h.name, (h.shares * shareValue) / PRECISION);
          }
        });
      }

      return held.map((h) => ({
        name: h.name,
        longShares: h.longShares,
        shortShares: h.shortShares,
        meanEntryPrice: h.meanEntryPrice,
        direction: h.direction,
        shares: h.shares,
        deactivatedPrice: h.deactivatedPrice,
        estimatedMph: estByName.get(h.name) ?? 0n,
      }));
    },
  });
}
