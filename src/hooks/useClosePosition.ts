'use client';

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACTS, ORACLE_ABI } from '@/lib/contracts';
import { marketIdHash } from '@/lib/markets';
import type { Position } from './usePositions';

// 1e8 — the order-leverage convention used by createOrder (1.0x = 100000000).
const ORDER_LEVERAGE_1X = 100000000n;

export function useClosePosition() {
  const {
    writeContract,
    data: hash,
    isPending,
    error,
    reset,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  function close(position: Position) {
    // To close a LONG, send a SELL (tradeDirection = false) for longShares.
    // To close a SHORT, send a BUY (tradeDirection = true) for shortShares.
    const closeDirection = position.direction === 'long' ? false : true;
    const shares =
      position.direction === 'long'
        ? position.longShares
        : position.shortShares;

    writeContract({
      address: CONTRACTS.MorpherOracle,
      abi: ORACLE_ABI,
      functionName: 'createOrder',
      args: [
        marketIdHash(position.name), // _marketId
        shares, // _closeSharesAmount
        0n, // _openMPHTokenAmount
        closeDirection, // _tradeDirection
        ORDER_LEVERAGE_1X, // _orderLeverage
        0n, // _onlyIfPriceAbove
        0n, // _onlyIfPriceBelow
        0n, // _goodUntil
        0n, // _goodFrom
      ],
      value: 0n,
    });
  }

  return {
    close,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: error ?? receiptError ?? null,
    reset,
  };
}
