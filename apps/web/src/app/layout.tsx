import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MediCore HMS',
};

// add some comments for this file 

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
