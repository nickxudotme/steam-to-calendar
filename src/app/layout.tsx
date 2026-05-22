import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './styles.css';

export const metadata: Metadata = {
  title: 'Wishlist in Calendar',
  description: 'Put your Steam wishlist into your real calendar.',
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/assets/brand/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/assets/brand/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/assets/brand/apple-touch-icon.png', type: 'image/png', sizes: '180x180' },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
