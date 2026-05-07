import type { Metadata } from 'next';
import './globals.css';
import { NavBar } from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'memory-os',
  description: 'Your AI memory vault',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 font-sans antialiased">
        <NavBar />
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
