import type { Address, WalletClient } from 'viem';

export type WalletKind = 'wagmi-morpher' | 'wagmi-walletconnect' | 'injected';

export interface ConnectedWallet {
  key: string; // stable unique key (wagmi connector uid, or EIP-6963 uuid)
  kind: WalletKind;
  label: string; // 'Morpher Wallet' | 'WalletConnect' | injected wallet name
  icon?: string;
  address: Address;
  balance: bigint | null; // Base ETH (wei)
  walletClient: WalletClient;
}

// Min Base ETH (wei) we treat as "can pay its own gas" for a close (~460k gas, trivial on Base).
export const MIN_GAS_WEI = 30_000_000_000_000n; // 0.00003 ETH

export function walletHasGas(w: { balance: bigint | null }): boolean {
  return w.balance != null && w.balance >= MIN_GAS_WEI;
}

// Relayer = connected wallet with the most Base ETH (and at least MIN_GAS_WEI).
export function pickGasWallet(wallets: ConnectedWallet[]): ConnectedWallet | null {
  let best: ConnectedWallet | null = null;
  for (const w of wallets) {
    if (!walletHasGas(w)) continue;
    if (!best || (w.balance ?? 0n) > (best.balance ?? 0n)) best = w;
  }
  return best;
}

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
