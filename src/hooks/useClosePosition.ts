'use client';

import * as React from 'react';
import { usePublicClient } from 'wagmi';
import { base } from 'viem/chains';
import { CONTRACTS, ORACLE_ABI } from '@/lib/contracts';
import { ORACLE_EIP712_DOMAIN, CREATE_ORDER_TYPES } from '@/lib/eip712';
import { marketIdHash } from '@/lib/markets';
import { walletHasGas, type ConnectedWallet } from '@/lib/wallets';
import type { Position } from './usePositions';

// 1e8 — the order-leverage convention used by createOrder (1.0x = 100000000).
const ORDER_LEVERAGE_1X = 100000000n;

type Status = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

export function useClosePosition(
  owner: ConnectedWallet,
  gasWallet: ConnectedWallet | null,
) {
  const publicClient = usePublicClient();

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
        if (!publicClient) throw new Error('Public client unavailable');

        // To close a LONG, send a SELL (tradeDirection = false) for the held shares.
        // To close a SHORT, send a BUY (tradeDirection = true).
        const closeDir = position.direction === 'long' ? false : true;
        const shares = position.shares;
        const marketId = marketIdHash(position.name);
        const ownerCanPay = walletHasGas(owner);

        let txHash: `0x${string}`;

        if (ownerCanPay) {
          // DIRECT path: the owner wallet pays its own gas.
          setStatus('pending');
          txHash = await owner.walletClient.writeContract({
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
            account: owner.address,
            chain: base,
          });
        } else if (gasWallet && gasWallet.key !== owner.key) {
          // RELAYED (gasless) path: owner signs the EIP-712 permit (free),
          // the relayer wallet submits the tx and pays the gas.
          const nonce = (await publicClient.readContract({
            address: CONTRACTS.MorpherOracle,
            abi: ORACLE_ABI,
            functionName: 'nonces',
            args: [owner.address],
          })) as bigint;

          const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

          setStatus('pending');
          const signature = await owner.walletClient.signTypedData({
            account: owner.address,
            domain: ORACLE_EIP712_DOMAIN,
            types: CREATE_ORDER_TYPES,
            primaryType: 'CreateOrder',
            message: {
              _marketId: marketId,
              _closeSharesAmount: shares,
              _openMPHTokenAmount: 0n,
              _msgSender: owner.address,
              nonce,
              deadline,
            },
          });

          // The deployed Base oracle takes (v, r, s), not a packed signature — split it.
          const r = `0x${signature.slice(2, 66)}` as `0x${string}`;
          const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
          const v = parseInt(signature.slice(130, 132), 16);

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

          txHash = await gasWallet.walletClient.writeContract({
            address: CONTRACTS.MorpherOracle,
            abi: ORACLE_ABI,
            functionName: 'createOrderPermittedBySignature',
            args: [orderParams, owner.address, deadline, v, r, s],
            account: gasWallet.address,
            chain: base,
          });
        } else {
          throw new Error(
            'No connected wallet has Base ETH to pay gas. Connect a browser wallet that holds ETH, or fund this wallet.',
          );
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
    [owner, gasWallet, publicClient],
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
