import { KeyRound, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function ExportKeyNotice() {
  return (
    <Card className="border-danger/30 bg-danger/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-danger">
          <KeyRound className="size-5" />
          Export your private key
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-text-primary">
        <p>
          Morpher is winding down. If you use the embedded{' '}
          <strong>Morpher Wallet</strong>, export your private key or recovery
          seed now so you keep access to your funds independently of Morpher&apos;s
          servers.
        </p>
        <p className="text-text-secondary">
          Once exported, you can import the same account into MetaMask or any
          other wallet and control your MPH and ETH on Base directly — even if
          the Morpher Wallet service is no longer available.
        </p>
        <a
          href="https://wallet.morpher.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="danger">
            Open Morpher Wallet
            <ExternalLink />
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}
