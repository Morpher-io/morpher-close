import { createConnector } from 'wagmi';
import {
  getAddress,
  type Address,
  type ProviderConnectInfo,
  SwitchChainError,
} from 'viem';
import { BASE_CHAIN_ID } from './contracts';

// ---------------------------------------------------------------------------
// Custom wagmi v2 connector for the Morpher embedded wallet.
//
// The morpherwallet-sdk default export (`MorpherWalletProvider`) is an
// EventEmitter that also exposes an EIP-1193-style `request({ method, params })`
// interface. frontend-v2 instantiates it and wraps `getProvider()` (which
// returns `this`) with viem's `custom(provider)`. Here we adapt that to a
// wagmi connector so the injected / walletConnect / morpher paths are uniform.
//
// NOTE: This connector cannot be runtime-tested in this build environment
// because it requires the live wallet iframe + an interactive login. The
// surface used below (constructor, getProvider, request, loginWallet,
// isLoggedIn, logout, EventEmitter `on`/`removeListener`) is taken from the
// SDK's index.d.ts (v1.2.x). Places where the exact SDK behaviour is uncertain
// are marked with `// SDK-UNCERTAIN`.
// ---------------------------------------------------------------------------

type LoginStatus = { isLoggedIn: boolean; walletEmail?: string; recovery_type?: string };

type MorpherWalletSdk = {
  request: (request: { method: string; params?: unknown[] }) => Promise<unknown>;
  getProvider: () => MorpherWalletSdk;
  // loginWallet() resolves with accounts if already logged in; otherwise it opens the wallet
  // iframe UI and the login completes asynchronously via the onLogin callback.
  loginWallet: () => Promise<unknown>;
  isLoggedIn: () => Promise<LoginStatus>;
  logout: () => Promise<unknown>;
  // SDK lifecycle callbacks (NOT EIP-1193 events). onLogin's first arg is the address.
  onLogin: (cb: (address: string, email?: string, recoveryType?: string) => void) => void;
  onLoginError?: (cb: (email: string, error: unknown) => void) => void;
  onLogout?: (cb: () => void) => void;
  onActiveWalletChanged?: (cb: (address: string) => void) => void;
};

export interface MorpherWalletConnectorParameters {
  /** Chain RPC URL the wallet uses to read/broadcast. NOT the wallet iframe URL. */
  rpcUrl?: string;
  /** Wallet environment — selects the iframe origin. 'live' -> https://wallet.morpher.com. */
  env?: 'live' | 'dev' | 'localhost';
  chainId?: number;
}

morpherWalletConnector.type = 'morpherWallet' as const;

export function morpherWalletConnector(parameters: MorpherWalletConnectorParameters = {}) {
  // The SDK constructor is `new MorpherWallet(rpcURL, chainId, config)`. The FIRST arg is the
  // chain RPC URL (the wallet broadcasts through it), and the iframe origin is chosen by
  // `config.env` ('live' -> https://wallet.morpher.com). Confirmed in the SDK's index.js.
  const rpcUrl =
    parameters.rpcUrl ??
    process.env.NEXT_PUBLIC_MORPHER_WALLET_RPC ??
    process.env.NEXT_PUBLIC_BASE_RPC_URL ??
    'https://mainnet.base.org';
  const walletEnv =
    parameters.env ??
    (process.env.NEXT_PUBLIC_MORPHER_WALLET_ENV as 'live' | 'dev' | 'localhost' | undefined) ??
    'live';
  const walletChainId =
    parameters.chainId ??
    Number(process.env.NEXT_PUBLIC_MORPHER_WALLET_CHAIN_ID ?? BASE_CHAIN_ID);

  let sdk: MorpherWalletSdk | undefined;

  type Provider = MorpherWalletSdk;

  return createConnector<Provider>((config) => {
    // Bridge SDK events into wagmi's emitter.
    function onAccountsChanged(accounts: string[]) {
      if (accounts.length === 0) {
        config.emitter.emit('disconnect');
      } else {
        config.emitter.emit('change', {
          accounts: accounts.map((a) => getAddress(a)),
        });
      }
    }
    function onChainChanged(chainId: string) {
      config.emitter.emit('change', { chainId: Number(chainId) });
    }
    function onDisconnect() {
      config.emitter.emit('disconnect');
    }
    async function onConnect(connectInfo: ProviderConnectInfo) {
      const provider = sdk;
      let accounts: Address[] = [];
      if (provider) {
        try {
          const raw = (await provider.request({
            method: 'eth_accounts',
          })) as string[];
          accounts = raw.map((a) => getAddress(a));
        } catch {
          // ignore
        }
      }
      config.emitter.emit('connect', {
        accounts,
        chainId: Number(connectInfo.chainId),
      });
    }

    return {
      id: 'morpherWallet',
      name: 'Morpher Wallet',
      type: morpherWalletConnector.type,

      async setup() {
        // No-op: the SDK creates an iframe lazily on first getProvider().
      },

      async getProvider(): Promise<Provider> {
        if (!sdk) {
          // Lazy-import keeps the SDK (and its DOM/iframe side effects) out of
          // SSR / static-export time.
          const mod = await import('morpherwallet-sdk');
          const MorpherWallet = (mod.default ?? mod) as unknown as new (
            url: string,
            chainId: number,
            config: Record<string, unknown>,
          ) => MorpherWalletSdk;

          const instance = new MorpherWallet(rpcUrl, walletChainId, {
            env: walletEnv,
            show_transaction: true,
            confirm_transaction: true,
            show_message: true,
            confirm_message: true,
          });

          // getProvider() returns `this` (an EIP-1193-style provider).
          sdk = instance.getProvider();

          // The SDK exposes lifecycle CALLBACKS (not EIP-1193 events).
          sdk.onActiveWalletChanged?.((address) =>
            onAccountsChanged(address ? [address] : []),
          );
          sdk.onLogout?.(() => onDisconnect());
        }
        return sdk;
      },

      async connect(parameters = {}) {
        const provider = await this.getProvider();

        // If already logged in, read accounts directly. Otherwise open the wallet
        // login UI (loginWallet) and wait for the onLogin callback — the SDK does
        // NOT implement eth_requestAccounts, and login completes asynchronously.
        let addresses: readonly Address[] = [];
        const status = await provider.isLoggedIn().catch(() => undefined);
        if (status?.isLoggedIn) {
          addresses = await this.getAccounts();
        } else {
          addresses = await new Promise<Address[]>((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error('Morpher Wallet login timed out')),
              180_000,
            );
            provider.onLogin((address) => {
              clearTimeout(timer);
              resolve(address ? [getAddress(address)] : []);
            });
            provider.onLoginError?.((_email, err) => {
              clearTimeout(timer);
              reject(err instanceof Error ? err : new Error(String(err)));
            });
            Promise.resolve(provider.loginWallet()).catch((err) => {
              clearTimeout(timer);
              reject(err instanceof Error ? err : new Error(String(err)));
            });
          });
        }

        const currentChainId = await this.getChainId();

        // wagmi v2 `connect` is generic over `withCapabilities`. When set, it
        // expects `{ address, capabilities }[]`; otherwise a plain address[].
        const accounts = parameters.withCapabilities
          ? addresses.map((address) => ({ address, capabilities: {} }))
          : addresses;

        return { accounts: accounts as never, chainId: currentChainId };
      },

      async disconnect() {
        const provider = await this.getProvider();
        try {
          await provider.logout();
        } catch {
          // Ignore — wallet may already be logged out.
        }
        sdk = undefined;
      },

      async getAccounts() {
        const provider = await this.getProvider();
        // The SDK only implements eth_accounts (returns [] unless logged in).
        const accounts = (await provider.request({
          method: 'eth_accounts',
        })) as string[] | undefined;
        return (accounts ?? []).map((a) => getAddress(a));
      },

      async getChainId() {
        const provider = await this.getProvider();
        const chainId = (await provider.request({ method: 'eth_chainId' })) as string;
        return Number(chainId);
      },

      async isAuthorized() {
        // Don't spawn the wallet iframe on reconnect: only authorized if the
        // SDK is already instantiated this session and reports a login.
        try {
          if (!sdk) return false;
          const status = await sdk.isLoggedIn();
          if (!status?.isLoggedIn) return false;
          const accounts = await this.getAccounts();
          return accounts.length > 0;
        } catch {
          return false;
        }
      },

      async switchChain({ chainId }) {
        // The embedded Morpher wallet runs on its single configured chain.
        if (chainId !== walletChainId) {
          throw new SwitchChainError(
            new Error('Morpher Wallet is pinned to its configured chain.'),
          );
        }
        const chain = config.chains.find((c) => c.id === chainId);
        if (!chain) {
          throw new SwitchChainError(new Error('Chain not configured.'));
        }
        return chain;
      },

      onAccountsChanged(accounts) {
        onAccountsChanged(accounts);
      },
      onChainChanged(chainId) {
        onChainChanged(chainId);
      },
      onConnect(connectInfo) {
        onConnect(connectInfo);
      },
      onDisconnect() {
        onDisconnect();
      },
    };
  });
}
