'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Logo } from '@/components/DesignSystem/Logo';

const NAV_LINKS = [
  { href: '/verify', label: 'Verify a Property' },
  { href: '/challenges/open', label: 'Open Challenges' },
  { href: '/claim/new', label: 'File a Claim' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/challenges', label: 'Challenges' },
  { href: '/how-it-works', label: 'How it Works' },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 z-50 w-full border-b border-border-subtle bg-surface/80 backdrop-blur-md">
      <nav className="mx-auto flex h-20 max-w-container-max items-center justify-between px-margin-mobile md:px-margin-desktop">
        <div className="flex items-center gap-8">
          <Logo />
          <div className="hidden md:flex gap-6">
            {NAV_LINKS.map((link) => {
              const active = pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-label-caps font-label-caps transition-colors duration-200 ${
                    active
                      ? 'border-b-2 border-surface-tint pb-1 text-primary'
                      : 'text-on-surface-variant hover:text-surface-tint'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <ConnectButton
          label="Connect Wallet"
          chainStatus="icon"
          accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }}
        />
      </nav>
    </header>
  );
}
