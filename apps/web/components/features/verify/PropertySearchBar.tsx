'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PropertySearchBar() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateOrRegion, setStateOrRegion] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (address) params.set('q', address);
    if (city) params.set('city', city);
    if (stateOrRegion) params.set('stateOrRegion', stateOrRegion);
    router.push(`/verify?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl p-2 transition-all duration-500 bg-white">
      <div className="flex flex-col items-stretch gap-2 md:flex-row">
        <div className="flex flex-1 items-center gap-3 border-b border-border-subtle/50 px-4 md:border-b-0 md:border-r">
          <SearchIcon className="text-surface-tint" />
          <input
            className="w-full bg-transparent py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none"
            placeholder="Street address (partial is fine)"
            value={address}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
            aria-label="Property address"
          />
        </div>
        <div className="flex flex-1 items-center gap-3 border-b border-border-subtle/50 px-4 md:border-b-0 md:border-r">
          <BuildingIcon className="text-on-surface-variant" />
          <input
            className="w-full bg-transparent py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none"
            placeholder="City (optional)"
            value={city}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
            aria-label="City"
          />
        </div>
        <div className="flex w-full items-center gap-3 px-4 md:w-28">
          <input
            className="w-full bg-transparent py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none"
            placeholder="State"
            value={stateOrRegion}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStateOrRegion(e.target.value)}
            aria-label="State or region"
          />
        </div>
        <button
          type="submit"
          className="flex items-center justify-center gap-2 rounded-lg bg-surface-tint px-8 py-4 text-label-caps font-label-caps text-on-primary transition-all hover:brightness-110"
        >
          <SearchIcon className="text-on-primary" />
          Verify Rental Authority
        </button>
      </div>
    </form>
  );
}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={`h-5 w-5 flex-shrink-0 ${className}`} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 1 0 3.61 9.65l3.12 3.12a1 1 0 0 0 1.42-1.42l-3.12-3.12A5.5 5.5 0 0 0 9 3.5Zm-3.5 5.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
function BuildingIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={`h-5 w-5 flex-shrink-0 ${className}`} aria-hidden="true">
      <path d="M4 2a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3h4a1 1 0 0 0 1-1V6.5a1 1 0 0 0-.4-.8l-5-3.75a1 1 0 0 0-1.2 0l-1.4 1.05V3a1 1 0 0 0-1-1H4Z" />
    </svg>
  );
}
