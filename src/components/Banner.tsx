import { Info } from 'lucide-react';

export function Banner() {
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
      <div className="flex gap-3">
        <Info className="mt-0.5 size-5 shrink-0 text-accent" />
        <div className="space-y-1 text-sm text-text-primary">
          <p className="font-semibold">Morpher markets are being wound down.</p>
          <ul className="list-inside list-disc space-y-1 text-text-secondary">
            <li>Close your open positions at a locked final price.</li>
            <li>You pay your own Base ETH gas for each transaction.</li>
            <li>
              After closing, your MPH becomes freely transferable — you can
              move it anywhere.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
