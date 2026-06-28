'use client';

/* eslint-disable @next/next/no-img-element */
import { AddWalletDialog } from './AddWalletDialog';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <img
            src="/morpher_logo.svg"
            alt="Morpher"
            className="h-7 w-auto"
            width={120}
            height={28}
          />
          <span className="hidden text-sm font-medium text-text-secondary sm:inline">
            Close your positions
          </span>
        </div>
        <AddWalletDialog label="Add wallet" />
      </div>
    </header>
  );
}
