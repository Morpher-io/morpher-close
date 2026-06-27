'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import type { Address } from 'viem';
import { CONTRACTS, TRADE_ENGINE_ABI } from '@/lib/contracts';
import { MARKET_NAMES, marketIdHash } from '@/lib/markets';

export interface Position {
  name: string;
  longShares: bigint;
  shortShares: bigint;
  meanEntryPrice: bigint;
  direction: 'long' | 'short';
  shares: bigint; // shares of the held side
  deactivatedPrice: bigint; // 0 = market not yet frozen
}

const CHUNK_SIZE = 120;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
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
        | { status: 'success'; result: readonly bigint[] }
        | { status: 'failure'; error: unknown }
      > = [];

      for (const idxChunk of chunk(
        names.map((_, i) => i),
        CHUNK_SIZE,
      )) {
        const contracts = idxChunk.map((i) => ({
          address: CONTRACTS.MorpherTradeEngine as Address,
          abi: TRADE_ENGINE_ABI,
          functionName: 'portfolio' as const,
          args: [address, hashes[i]] as const,
        }));
        const res = await publicClient.multicall({
          contracts,
          allowFailure: true,
        });
        for (const r of res) {
          portfolioResults.push(
            r.status === 'success'
              ? { status: 'success', result: r.result as unknown as readonly bigint[] }
              : { status: 'failure', error: r.error },
          );
        }
      }

      // 2) Keep markets with a non-zero position.
      const held: Array<{
        index: number;
        name: string;
        longShares: bigint;
        shortShares: bigint;
        meanEntryPrice: bigint;
      }> = [];

      portfolioResults.forEach((r, i) => {
        if (r.status !== 'success') return;
        // portfolio returns a tuple; viem yields it as an array.
        const [, longShares, shortShares, meanEntryPrice] = r.result;
        if ((longShares ?? 0n) > 0n || (shortShares ?? 0n) > 0n) {
          held.push({
            index: i,
            name: names[i],
            longShares: longShares ?? 0n,
            shortShares: shortShares ?? 0n,
            meanEntryPrice: meanEntryPrice ?? 0n,
          });
        }
      });

      if (held.length === 0) return [];

      // 3) Fetch deactivated (locked exit) price for held markets.
      const priceContracts = held.map((h) => ({
        address: CONTRACTS.MorpherTradeEngine as Address,
        abi: TRADE_ENGINE_ABI,
        functionName: 'getDeactivatedMarketPrice' as const,
        args: [hashes[h.index]] as const,
      }));
      const priceResults = await publicClient.multicall({
        contracts: priceContracts,
        allowFailure: true,
      });

      return held.map((h, i) => {
        const direction: 'long' | 'short' =
          h.longShares >= h.shortShares ? 'long' : 'short';
        const shares = direction === 'long' ? h.longShares : h.shortShares;
        const priceRes = priceResults[i];
        const deactivatedPrice =
          priceRes?.status === 'success'
            ? (priceRes.result as unknown as bigint)
            : 0n;
        return {
          name: h.name,
          longShares: h.longShares,
          shortShares: h.shortShares,
          meanEntryPrice: h.meanEntryPrice,
          direction,
          shares,
          deactivatedPrice,
        };
      });
    },
  });
}
