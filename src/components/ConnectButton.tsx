'use client';

import * as React from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Wallet, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

function shorten(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function connectorLabel(id: string, name: string) {
  if (id === 'morpherWallet') return 'Morpher Wallet';
  if (id === 'walletConnect') return 'WalletConnect';
  if (id === 'injected' || id === 'metaMask') return name || 'Browser Wallet';
  return name;
}

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = React.useState(false);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm">
          {shorten(address)}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => disconnect()}
          aria-label="Disconnect"
        >
          <LogOut />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Wallet />
        Connect
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClose={() => setOpen(false)}>
          <DialogHeader>
            <DialogTitle>Connect a wallet</DialogTitle>
            <DialogDescription>
              Choose how to connect to Base mainnet.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            {connectors.map((c) => (
              <Button
                key={c.uid}
                variant="outline"
                className="justify-start"
                disabled={isPending}
                onClick={() => {
                  connect({ connector: c });
                  setOpen(false);
                }}
              >
                <Wallet />
                {connectorLabel(c.id, c.name)}
              </Button>
            ))}
          </div>

          {error && (
            <p className="mt-3 text-sm text-danger">{error.message}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
