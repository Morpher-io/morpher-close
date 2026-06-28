// Morpher protocol contract addresses on Base mainnet (chainId 8453).
// Sourced from MorpherProtocol/deployments/8453.json.

export const CONTRACTS = {
  MorpherOracle: '0x694aa11EC58b7dE7F1bb3a83dae00dCa55Dc986B',
  MorpherState: '0x361e10a8fa2C9a5c339Dbd2B3f1b6f6a22c2618F',
  MorpherTradeEngine: '0x42747a45FAA00a55EC17c02AC8b1A360d4827a54',
  MorpherToken: '0x537C96C822C15b8361f4DbbE56805bd4E60d0F05',
} as const;

export const BASE_CHAIN_ID = 8453;

// ---- ABIs (viem const ABIs) ----

export const ORACLE_ABI = [
  {
    type: 'function',
    name: 'createOrder',
    stateMutability: 'payable',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_closeSharesAmount', type: 'uint256' },
      { name: '_openMPHTokenAmount', type: 'uint256' },
      { name: '_tradeDirection', type: 'bool' },
      { name: '_orderLeverage', type: 'uint256' },
      { name: '_onlyIfPriceAbove', type: 'uint256' },
      { name: '_onlyIfPriceBelow', type: 'uint256' },
      { name: '_goodUntil', type: 'uint256' },
      { name: '_goodFrom', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'gasForCallback',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // EIP-712 nonce for the position owner — incremented on each permitted order.
  {
    type: 'function',
    name: 'nonces',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Gasless relayed order: relayer submits, position owner only signs the EIP-712 permit.
  // NOTE: Base mainnet's deployed oracle exposes the (v, r, s) overload, NOT the bytes one
  // (the bytes variant was added later in the contract source). Verified on-chain via fork test.
  {
    type: 'function',
    name: 'createOrderPermittedBySignature',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'createOrderParams',
        type: 'tuple',
        components: [
          { name: '_marketId', type: 'bytes32' },
          { name: '_closeSharesAmount', type: 'uint256' },
          { name: '_openMPHTokenAmount', type: 'uint256' },
          { name: '_tradeDirection', type: 'bool' },
          { name: '_orderLeverage', type: 'uint256' },
          { name: '_onlyIfPriceAbove', type: 'uint256' },
          { name: '_onlyIfPriceBelow', type: 'uint256' },
          { name: '_goodUntil', type: 'uint256' },
          { name: '_goodFrom', type: 'uint256' },
        ],
      },
      { name: '_addressPositionOwner', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const;

export const STATE_ABI = [
  {
    type: 'function',
    name: 'getMarketActive',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const TRADE_ENGINE_ABI = [
  {
    type: 'function',
    name: 'portfolio',
    stateMutability: 'view',
    inputs: [
      { name: '', type: 'address' },
      { name: '', type: 'bytes32' },
    ],
    outputs: [
      { name: 'lastUpdated', type: 'uint256' },
      { name: 'longShares', type: 'uint256' },
      { name: 'shortShares', type: 'uint256' },
      { name: 'meanEntryPrice', type: 'uint256' },
      { name: 'meanEntrySpread', type: 'uint256' },
      { name: 'meanEntryLeverage', type: 'uint256' },
      { name: 'liquidationPrice', type: 'uint256' },
      { name: 'positionHash', type: 'bytes32' },
    ],
  },
  {
    type: 'function',
    name: 'getDeactivatedMarketPrice',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Per-share value at a given market price — used to estimate the MPH a close returns.
  {
    type: 'function',
    name: 'longShareValue',
    stateMutability: 'view',
    inputs: [
      { name: '_positionAveragePrice', type: 'uint256' },
      { name: '_positionAverageLeverage', type: 'uint256' },
      { name: '_positionTimeStampInMs', type: 'uint256' },
      { name: '_marketPrice', type: 'uint256' },
      { name: '_marketSpread', type: 'uint256' },
      { name: '_orderLeverage', type: 'uint256' },
      { name: '_sell', type: 'bool' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'shortShareValue',
    stateMutability: 'view',
    inputs: [
      { name: '_positionAveragePrice', type: 'uint256' },
      { name: '_positionAverageLeverage', type: 'uint256' },
      { name: '_positionTimeStampInMs', type: 'uint256' },
      { name: '_marketPrice', type: 'uint256' },
      { name: '_marketSpread', type: 'uint256' },
      { name: '_orderLeverage', type: 'uint256' },
      { name: '_sell', type: 'bool' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// Protocol fixed-point precision (1e8) — shares and leverage are scaled by this.
export const PRECISION = 100000000n;

export const TOKEN_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '', type: 'address' },
      { name: '', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  // EIP-2612 permit support (MorpherToken inherits ERC20PermitUpgradeable). Enables gasless
  // transfers: the owner signs a permit (free), a relayer submits permit + transferFrom and
  // pays the gas. Verified end-to-end on a Base fork.
  {
    type: 'function',
    name: 'nonces',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'permit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'transferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;
