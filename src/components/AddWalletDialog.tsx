'use client';

/* eslint-disable @next/next/no-img-element */
import * as React from 'react';
import { useAccount, useConnect } from 'wagmi';
import { Plus, Wallet, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useWallets, type EIP6963ProviderDetail } from '@/hooks/useWallets';

function wagmiConnectorLabel(id: string, name: string) {
  if (id === 'morpherWallet') return 'Morpher Wallet';
  if (id === 'walletConnect') return 'WalletConnect (mobile)';
  return name;
}

export function AddWalletDialog({
  variant = 'default',
  label = 'Add wallet',
}: {
  variant?: 'default' | 'outline';
  label?: string;
}) {
  const { isConnected } = useAccount();
  const { connect: wagmiConnect, connectors } = useConnect();
  const { providers, wallets, connect: injectedConnect } = useWallets();

  const [open, setOpen] = React.useState(false);
  const [connecting, setConnecting] = React.useState(false);
  const [connectError, setConnectError] = React.useState<string | null>(null);

  // Injected providers not already connected.
  const availableInjected = providers.filter(
    (detail) => !wallets.some((w) => w.id === detail.info.uuid),
  );

  async function handleInjected(detail: EIP6963ProviderDetail) {
    setConnectError(null);
    setConnecting(true);
    try {
      await injectedConnect(detail);
      setOpen(false);
    } catch (err) {
      setConnectError(
        err instanceof Error ? err.message.split('\n')[0] : String(err),
      );
    } finally {
      setConnecting(false);
    }
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClose={() => setOpen(false)}>
          <DialogHeader>
            <DialogTitle>Add a wallet</DialogTitle>
            <DialogDescription>
              Connect another wallet to manage its positions on Base.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            {!isConnected &&
              connectors.map((c) => (
                <Button
                  key={c.uid}
                  variant="outline"
                  className="justify-start"
                  disabled={connecting}
                  onClick={() => {
                    wagmiConnect({ connector: c });
                    setOpen(false);
                  }}
                >
                  <Wallet />
                  {wagmiConnectorLabel(c.id, c.name)}
                </Button>
              ))}

            {availableInjected.map((detail) => (
              <Button
                key={detail.info.uuid}
                variant="outline"
                className="justify-start"
                disabled={connecting}
                onClick={() => handleInjected(detail)}
              >
                {detail.info.icon ? (
                  <img
                    src={detail.info.icon}
                    alt=""
                    className="size-4 shrink-0 rounded"
                  />
                ) : (
                  <Plug />
                )}
                {detail.info.name}
              </Button>
            ))}
          </div>

          <p className="mt-3 text-xs text-text-secondary">
            Browser extensions connect instantly. Use WalletConnect for mobile
            wallets.
          </p>

          {connectError && (
            <p className="mt-2 text-xs text-danger">{connectError}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
