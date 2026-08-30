'use client';

import { Button } from '@/components/DesignSystem/Button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col items-center justify-center bg-background px-margin-mobile text-center text-on-surface">
        <h1 className="mb-4 font-display text-display">Something went wrong</h1>
        <p className="mb-8 max-w-md text-body-lg text-on-surface-variant">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <Button onClick={reset}>Try Again</Button>
      </body>
    </html>
  );
}
