import { test, expect } from '@playwright/test';

// Inject a mock EIP-6963 browser wallet (simulating Rabby/MetaMask) BEFORE app scripts run,
// and record every request() it receives so we can prove the Morpher Wallet button never
// routes to the injected wallet.
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

test('connect modal is portaled, lists only wagmi connectors, and ignores injected wallets', async ({
  page,
}) => {
  await page.addInitScript(installMockInjectedWallet);
  await page.goto('/');

  // Open the connect modal from the HEADER (the one with the reported positioning bug).
  await page.getByRole('banner').getByRole('button', { name: 'Connect', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // BUG 1 regression: the dialog must be portaled to <body>, NOT trapped in <header>.
  await expect(page.locator('header [role="dialog"]')).toHaveCount(0);

  // wagmi injected-discovery is disabled, so the trade-wallet modal lists ONLY the wagmi
  // connectors (Morpher Wallet, WalletConnect). The injected wallet must NOT appear here —
  // it is connected separately as a gas relayer (useRelayer), so it can't hijack the account.
  await expect(page.getByRole('button', { name: 'Morpher Wallet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'WalletConnect' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Mock Rabby/ })).toHaveCount(0);

  await page.screenshot({ path: 'test-results/connect-modal.png', fullPage: true });

  // BUG 2 regression: clicking "Morpher Wallet" must NOT connect the injected wallet.
  // Reset the call log first so we ignore wagmi's background reconnect-probing on load.
  await page.evaluate(() => {
    (window as unknown as { __injectedCalls: string[] }).__injectedCalls = [];
  });
  await page.getByRole('button', { name: 'Morpher Wallet' }).click();
  await page.waitForTimeout(2500);

  const postClickCalls = await page.evaluate(
    () => (window as unknown as { __injectedCalls: string[] }).__injectedCalls,
  );
  // eth_requestAccounts is the injected-wallet CONNECT trigger — it must not fire.
  expect(postClickCalls).not.toContain('eth_requestAccounts');
  // And the app must not have connected to the injected (mock) account.
  await expect(page.getByText('0x1111', { exact: false })).toHaveCount(0);
});
