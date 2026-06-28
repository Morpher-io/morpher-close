import { test, expect } from '@playwright/test';

// Inject a mock EIP-6963 browser wallet (simulating Rabby/MetaMask) BEFORE app scripts run.
// In the multi-wallet model, injected wallets ARE listed in the Add-wallet dialog (each becomes
// its own ConnectedWallet section), connected via useWallets' EIP-6963 discovery — separately
// from the single wagmi connection (Morpher Wallet / WalletConnect).
function installMockInjectedWallet() {
  const w = window as unknown as { __injectedCalls: string[]; ethereum: unknown };
  w.__injectedCalls = [];
  const provider = {
    request: async ({ method }: { method: string }) => {
      w.__injectedCalls.push(method);
      if (method === 'eth_chainId') return '0x2105'; // 8453
      // Realistic: not previously authorized -> eth_accounts returns []. Only an
      // explicit eth_requestAccounts (user approving THIS dapp) yields an account.
      if (method === 'eth_accounts') return [];
      if (method === 'eth_requestAccounts')
        return ['0x1111111111111111111111111111111111111111'];
      return null;
    },
    on() {},
    removeListener() {},
  };
  const info = {
    uuid: '00000000-0000-0000-0000-000000000001',
    name: 'Mock Rabby',
    icon: 'data:image/svg+xml;base64,PHN2Zy8+',
    rdns: 'io.rabby.mock',
  };
  const announce = () =>
    window.dispatchEvent(
      new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }),
    );
  window.addEventListener('eip6963:requestProvider', announce);
  announce();
  w.ethereum = provider;
}

test('add-wallet dialog is portaled and lists wagmi connectors plus injected wallets', async ({
  page,
}) => {
  await page.addInitScript(installMockInjectedWallet);
  await page.goto('/');

  // Open the Add-wallet dialog from the HEADER (the one with the reported positioning bug).
  await page.getByRole('banner').getByRole('button', { name: 'Add wallet', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Regression: the dialog must be portaled to <body>, NOT trapped in <header>.
  await expect(page.locator('header [role="dialog"]')).toHaveCount(0);

  // The dialog lists the wagmi connectors (Morpher Wallet, WalletConnect) AND the
  // EIP-6963 injected wallet (Mock Rabby) — they are separate connect paths.
  await expect(page.getByRole('button', { name: 'Morpher Wallet' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'WalletConnect (mobile)' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Mock Rabby/ })).toBeVisible();

  await page.screenshot({ path: 'test-results/add-wallet-dialog.png', fullPage: true });
});
