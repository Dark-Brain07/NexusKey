import Link from 'next/link';

function NexusKeyMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <path
        d="M32 16a10 10 0 0 1 10 10c0 4.42-2.53 7.65-6.13 9.36L40.5 46a2 2 0 0 1-1.9 2.6h-13.2a2 2 0 0 1-1.9-2.6l4.63-10.64C24.53 33.65 22 30.42 22 26a10 10 0 0 1 10-10Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-2 text-headline-md font-headline-md font-bold tracking-tight text-surface-tint ${className}`}
    >
      <NexusKeyMark className="h-6 w-6 text-surface-tint" />
      NexusKey
    </Link>
  );
}
