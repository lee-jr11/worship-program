import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Worship Program Generator',
  description: 'Generate and dispatch weekly worship program documents by email.',
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
