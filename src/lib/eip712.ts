// EIP-712 domain and types for the MorpherOracle `CreateOrder` permit, used by the
// gasless relayed close flow (createOrderPermittedBySignature). Verified on-chain:
// domain version '1', chainId 8453 (Base). `_msgSender` is the POSITION OWNER address.

import { CONTRACTS, BASE_CHAIN_ID } from './contracts';

export const ORACLE_EIP712_DOMAIN = {
  name: 'MorpherOracle',
  version: '1',
  chainId: BASE_CHAIN_ID,
  verifyingContract: CONTRACTS.MorpherOracle as `0x${string}`,
} as const;

export const CREATE_ORDER_TYPES = {
  CreateOrder: [
    { name: '_marketId', type: 'bytes32' },
    { name: '_closeSharesAmount', type: 'uint256' },
    { name: '_openMPHTokenAmount', type: 'uint256' },
    { name: '_msgSender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;
