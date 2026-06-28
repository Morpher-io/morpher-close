'use client';

import * as React from 'react';
import { usePublicClient } from 'wagmi';
import { base } from 'viem/chains';
import type { Address } from 'viem';
import { CONTRACTS, TOKEN_ABI } from '@/lib/contracts';
import { TOKEN_EIP712_DOMAIN, PERMIT_TYPES } from '@/lib/eip712';
import { walletHasGas, type ConnectedWallet } from '@/lib/wallets';

type Status =
  | 'idle'
  | 'signing'
  | 'permitting'
  | 'transferring'
  | 'success'
  | 'error';

/**
 * Move MPH out of `owner` to a destination.
 * - If `owner` holds Base ETH → it sends `transfer` directly and pays its own gas.
 * - Otherwise → `owner` signs an EIP-2612 permit (free) and the relayer (`gasWallet`)
 *   submits `permit` + `transferFrom`, paying the gas. Verified end-to-end on a Base fork.
 */
export function useTransferMph(
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

  const transfer = React.useCallback(
    async (dest: Address, amount: bigint) => {
      setError(null);
      setHash(undefined);
      try {
        if (!publicClient) throw new Error('Public client unavailable');
        if (amount <= 0n) throw new Error('Enter an amount greater than zero');

        const ownerCanPay = walletHasGas(owner);
        let txHash: `0x${string}`;

        if (ownerCanPay) {
          // DIRECT: owner sends its own transfer and pays gas.
          setStatus('transferring');
          txHash = await owner.walletClient.writeContract({
            address: CONTRACTS.MorpherToken,
            abi: TOKEN_ABI,
            functionName: 'transfer',
            args: [dest, amount],
            account: owner.address,
            chain: base,
          });
          setHash(txHash);
          await publicClient.waitForTransactionReceipt({ hash: txHash });
        } else if (gasWallet && gasWallet.key !== owner.key) {
          // RELAYED: owner signs the EIP-2612 permit (free); relayer submits permit +
          // transferFrom and pays the gas.
          const nonce = (await publicClient.readContract({
            address: CONTRACTS.MorpherToken,
            abi: TOKEN_ABI,
            functionName: 'nonces',
            args: [owner.address],
          })) as bigint;

          const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

          setStatus('signing');
          const signature = await owner.walletClient.signTypedData({
            account: owner.address,
            domain: TOKEN_EIP712_DOMAIN,
            types: PERMIT_TYPES,
            primaryType: 'Permit',
            message: {
              owner: owner.address,
              spender: gasWallet.address,
              value: amount,
              nonce,
              deadline,
            },
          });

          const r = `0x${signature.slice(2, 66)}` as `0x${string}`;
          const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
          const v = parseInt(signature.slice(130, 132), 16);

          // Tx 1 — relayer registers the approval on-chain.
          setStatus('permitting');
          const permitHash = await gasWallet.walletClient.writeContract({
            address: CONTRACTS.MorpherToken,
            abi: TOKEN_ABI,
            functionName: 'permit',
            args: [owner.address, gasWallet.address, amount, deadline, v, r, s],
            account: gasWallet.address,
            chain: base,
          });
          await publicClient.waitForTransactionReceipt({ hash: permitHash });

          // Tx 2 — relayer pulls the MPH from owner to the destination.
          setStatus('transferring');
          txHash = await gasWallet.walletClient.writeContract({
            address: CONTRACTS.MorpherToken,
            abi: TOKEN_ABI,
            functionName: 'transferFrom',
            args: [owner.address, dest, amount],
            account: gasWallet.address,
            chain: base,
          });
          setHash(txHash);
          await publicClient.waitForTransactionReceipt({ hash: txHash });
        } else {
          throw new Error(
            'No connected wallet has Base ETH to pay gas. Connect a browser wallet that holds ETH, or fund this wallet.',
          );
        }

        setStatus('success');
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus('error');
      }
    },
    [owner, gasWallet, publicClient],
  );

  return {
    transfer,
    hash,
    status,
    isSigning: status === 'signing',
    isPermitting: status === 'permitting',
    isTransferring: status === 'transferring',
    isBusy:
      status === 'signing' ||
      status === 'permitting' ||
      status === 'transferring',
    isSuccess: status === 'success',
    error,
    reset,
  };
}
