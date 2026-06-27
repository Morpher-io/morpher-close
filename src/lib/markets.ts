import { keccak256, toBytes, type Hex } from 'viem';
import marketIds from './market_ids.json';

// Deduped list of on-chain market names (e.g. "CRYPTO_BTC").
export const MARKET_NAMES: string[] = Array.from(
  new Set(
    (marketIds.marketsarray as Array<{ marketid: string }>)
      .map((m) => m.marketid)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  ),
);

// The on-chain marketId is keccak256(abi.encodePacked(name)).
// For a plain string, abi.encodePacked is just the UTF-8 bytes, so this
// equals keccak256(toBytes(name)).
export function marketIdHash(name: string): Hex {
  return keccak256(toBytes(name));
}
