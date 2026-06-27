import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Morpher — Close your positions',
  description:
    'Close your Morpher positions on Base during the wind-down. Settle at a locked final price and reclaim your MPH.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={roboto.variable}>
      <body className={roboto.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
