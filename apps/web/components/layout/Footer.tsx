import Link from 'next/link';

const FOOTER_LINKS = [
  { href: '/docs', label: 'Documentation' },
  { href: '/docs#safety', label: 'Safety Guides' },
  { href: '/docs#legal', label: 'Legal Disclaimers' },
  { href: '/docs#privacy', label: 'Privacy Policy' },
];

export function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-surface-container-lowest">
      <div className="mx-auto flex w-full max-w-container-max flex-col items-center justify-between gap-8 px-margin-mobile py-12 md:flex-row md:px-margin-desktop">
        <div className="flex flex-col items-center gap-2 md:items-start">
          <span className="text-body-lg font-headline-md font-semibold text-surface-tint">NexusKey</span>
          <p className="max-w-sm text-center text-body-sm text-on-surface-variant/70 md:text-left">
            NexusKey is a verification and risk-assessment tool. Verification is not a legal
            determination of ownership and not a guarantee that a rental transaction is safe.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-8">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-label-caps font-label-caps uppercase tracking-widest text-on-surface-variant/70 transition-colors hover:text-on-surface"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <p className="text-body-sm text-on-surface-variant/60">© 2026 NexusKey Bonded Registry.</p>
      </div>
    </footer>
  );
}
