import type { Metadata } from 'next';
import { Hanken_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-hanken',
  display: 'swap',
});
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'NexusKey | Bonded Rental Authority Registry',
    template: '%s | NexusKey',
  },
  description:
    'Before you trust a door, you look through the NexusKey first. NexusKey is a bonded verification registry for rental authority, backed by GenLayer Intelligent Contract consensus.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${hanken.variable} ${inter.variable} ${mono.variable}`}>
      <body className="font-body-md selection:bg-surface-tint selection:text-on-primary">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
