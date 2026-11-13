import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wednesday Worship Program Generator',
  description: 'Generate and dispatch weekly Wednesday worship program documents by email.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
