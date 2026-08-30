import Link from 'next/link';
import { TopNav } from '@/components/layout/TopNav';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/DesignSystem/Button';

export default function NotFound() {
  return (
    <>
      <TopNav />
      <main className="flex min-h-[60vh] flex-col items-center justify-center px-margin-mobile pt-20 text-center">
        <h1 className="mb-4 font-display text-display text-white">404</h1>
        <p className="mb-8 max-w-md text-body-lg text-on-surface-variant">
          This page doesn&apos;t exist in the registry.
        </p>
        <Link href="/">
          <Button variant="secondary">Return Home</Button>
        </Link>
      </main>
      <Footer />
    </>
  );
}
