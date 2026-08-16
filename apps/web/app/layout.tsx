import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';

import { PRODUCT_NAME } from '../lib/product';
import './globals.css';
import './app-system.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
});

export const metadata: Metadata = {
  description:
    'Multi-channel AI support operations with grounded answers and human oversight.',
  icons: {
    apple: '/brand/chanda-panda-logo.png',
    icon: '/brand/chanda-panda-logo.png',
    shortcut: '/brand/chanda-panda-logo.png',
  },
  title: PRODUCT_NAME,
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body className={plusJakartaSans.variable}>{children}</body>
    </html>
  );
}
