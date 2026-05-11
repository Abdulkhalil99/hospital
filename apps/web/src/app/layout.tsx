import type { Metadata, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'MediCore HMS',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
