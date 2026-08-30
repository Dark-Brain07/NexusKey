/**
 * Machine data -- claim IDs, wallet addresses, timestamps, bond amounts --
 * always renders in JetBrains Mono, never Inter. Per DESIGN.md this is
 * the single most important legibility signal distinguishing "machine
 * data" from "human narrative" in the NexusKey UI; routing every such
 * value through this component (instead of ad hoc `font-mono-data`
 * classes scattered across pages) is what keeps that distinction from
 * drifting.
 */
export function MonoData({
  children,
  className = '',
  tone = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'default' | 'accent' | 'muted' | 'error';
}) {
  const toneClass = {
    default: 'text-on-surface',
    accent: 'text-surface-tint',
    muted: 'text-on-surface-variant',
    error: 'text-status-error',
  }[tone];
  return <span className={`font-mono-data text-mono-data ${toneClass} ${className}`}>{children}</span>;
}

export function truncateAddress(address: string, chars = 4): string {
  if (!address || address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
