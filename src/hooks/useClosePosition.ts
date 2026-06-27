'use client';

import * as React from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { base } from 'viem/chains';
import { CONTRACTS, ORACLE_ABI } from '@/lib/contracts';
import { ORACLE_EIP712_DOMAIN, CREATE_ORDER_TYPES } from '@/lib/eip712';
import { marketIdHash } from '@/lib/markets';
import { useRelayer } from './useRelayer';
import type { Position } from './usePositions';

// 1e8 — the order-leverage convention used by createOrder (1.0x = 100000000).
const ORDER_LEVERAGE_1X = 100000000n;

type Status = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

export function useClosePosition() {
  const { address } = useAccount();
  const { data: tradeClient } = useWalletClient(); // the connected trade wallet (holds positions)
  const publicClient = usePublicClient();
  const { relayer } = useRelayer();

  const [status, setStatus] = React.useState<Status>('idle');
  const [error, setError] = React.useState<Error | null>(null);
  const [hash, setHash] = React.useState<`0x${string}` | undefined>(undefined);

  const reset = React.useCallback(() => {
    setStatus('idle');
    setError(null);
    setHash(undefined);
  }, []);

  const close = React.useCallback(
    async (position: Position) => {
      setError(null);
      setHash(undefined);
      try {
        if (!address) throw new Error('No connected wallet');
        if (!tradeClient) throw new Error('Trade wallet client unavailable');
        if (!publicClient) throw new Error('Public client unavailable');

        // To close a LONG, send a SELL (tradeDirection = false) for the held shares.
        // To close a SHORT, send a BUY (tradeDirection = true).
        const closeDir = position.direction === 'long' ? false : true;
        const shares = position.shares;
        const marketId = marketIdHash(position.name);

        let txHash: `0x${string}`;

        if (relayer) {
          // RELAYED (gasless) path: trade wallet signs the EIP-712 permit (free),
          // relayer wallet submits the tx and pays the gas.
          const nonce = (await publicClient.readContract({
            address: CONTRACTS.MorpherOracle,
            abi: ORACLE_ABI,
            functionName: 'nonces',
            args: [address],
          })) as bigint;

          const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

          setStatus('pending');
          const signature = await tradeClient.signTypedData({
            account: address,
            domain: ORACLE_EIP712_DOMAIN,
            types: CREATE_ORDER_TYPES,
            primaryType: 'CreateOrder',
            message: {
              _marketId: marketId,
              _closeSharesAmount: shares,
              _openMPHTokenAmount: 0n,
              _msgSender: address,
              nonce,
              deadline,
            },
          });

          const orderParams = {
            _marketId: marketId,
            _closeSharesAmount: shares,
            _openMPHTokenAmount: 0n,
            _tradeDirection: closeDir,
            _orderLeverage: ORDER_LEVERAGE_1X,
            _onlyIfPriceAbove: 0n,
            _onlyIfPriceBelow: 0n,
            _goodUntil: 0n,
            _goodFrom: 0n,
          } as const;

          txHash = await relayer.walletClient.writeContract({
            address: CONTRACTS.MorpherOracle,
            abi: ORACLE_ABI,
            functionName: 'createOrderPermittedBySignature',
            args: [orderParams, address, deadline, signature],
            account: relayer.address,
            chain: base,
          });
        } else {
          // DIRECT path: the trade wallet pays its own gas.
          setStatus('pending');
          txHash = await tradeClient.writeContract({
            address: CONTRACTS.MorpherOracle,
            abi: ORACLE_ABI,
            functionName: 'createOrder',
            args: [
              marketId, // _marketId
              shares, // _closeSharesAmount
              0n, // _openMPHTokenAmount
              closeDir, // _tradeDirection
              ORDER_LEVERAGE_1X, // _orderLeverage
              0n, // _onlyIfPriceAbove
              0n, // _onlyIfPriceBelow
              0n, // _goodUntil
              0n, // _goodFrom
            ],
            value: 0n,
            account: address,
            chain: base,
          });
        }

        setHash(txHash);
        setStatus('confirming');
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        setStatus('success');
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus('error');
      }
    },
    [address, tradeClient, publicClient, relayer],
  );

  return {
    close,
    hash,
    isPending: status === 'pending',
    isConfirming: status === 'confirming',
    isSuccess: status === 'success',
    error,
    reset,
  };
}
