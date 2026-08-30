import type { ClaimStatus, ChallengeStatus } from '@NexusKey/shared';

export type DisplayStatus = ClaimStatus | ChallengeStatus | 'NOT_FOUND' | 'UNDER_REVIEW' | 'CONFLICTED';

interface StatusConfig {
  label: string;
  colorClass: string;
  bgClass: string;
  glowClass: string;
  icon: JSX.Element;
}

const CHECK = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
      clipRule="evenodd"
    />
  </svg>
);
const CLOCK = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-12a.75.75 0 0 0-1.5 0v4c0 .2.08.39.22.53l2.5 2.5a.75.75 0 1 0 1.06-1.06l-2.28-2.28V6Z"
      clipRule="evenodd"
    />
  </svg>
);
const WARN = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M9.4 2.7a1.5 1.5 0 0 1 1.2 0c.28.12.5.33.65.55.06.09 8.02 13.87 8.02 13.87.13.24.2.5.2.78a1.5 1.5 0 0 1-1.5 1.5H2.03a1.5 1.5 0 0 1-1.5-1.5c0-.28.07-.54.2-.78L8.75 3.25c.15-.22.37-.43.65-.55ZM10 7.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 7.5Zm0 6.5a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z"
      clipRule="evenodd"
    />
  </svg>
);
const X = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M4.3 4.3a1 1 0 0 1 1.4 0L10 8.6l4.3-4.3a1 1 0 1 1 1.4 1.4L11.4 10l4.3 4.3a1 1 0 0 1-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 0 1-1.4-1.4L8.6 10 4.3 5.7a1 1 0 0 1 0-1.4Z"
      clipRule="evenodd"
    />
  </svg>
);
const GAVEL = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
    <path d="M12.7 2.3a1 1 0 0 1 1.4 0l3.6 3.6a1 1 0 0 1 0 1.4l-1.4 1.4-5-5 1.4-1.4ZM10.3 4.7l5 5-6.3 6.3-5-5 6.3-6.3ZM2 17a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Z" />
  </svg>
);
const SEARCH = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M9 3.5a5.5 5.5 0 1 0 3.61 9.65l3.12 3.12a1 1 0 0 0 1.42-1.42l-3.12-3.12A5.5 5.5 0 0 0 9 3.5Zm-3.5 5.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z"
      clipRule="evenodd"
    />
  </svg>
);

const STATUS_CONFIG: Record<string, StatusConfig> = {
  VERIFIED: {
    label: 'Verified',
    colorClass: 'text-status-verified',
    bgClass: 'bg-status-verified/10',
    glowClass: 'shadow-[0_0_15px_rgba(102,252,241,0.1)]',
    icon: CHECK,
  },
  PENDING: {
    label: 'Under Review',
    colorClass: 'text-status-warning',
    bgClass: 'bg-status-warning/10',
    glowClass: 'shadow-[0_0_15px_rgba(241,196,15,0.1)]',
    icon: CLOCK,
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    colorClass: 'text-status-warning',
    bgClass: 'bg-status-warning/10',
    glowClass: 'shadow-[0_0_15px_rgba(241,196,15,0.1)]',
    icon: CLOCK,
  },
  CONTEST_WINDOW: {
    label: 'Contest Window',
    colorClass: 'text-status-warning',
    bgClass: 'bg-status-warning/10',
    glowClass: 'shadow-[0_0_15px_rgba(241,196,15,0.1)]',
    icon: CLOCK,
  },
  CHALLENGED: {
    label: 'Challenged',
    colorClass: 'text-status-error',
    bgClass: 'bg-status-error/10',
    glowClass: 'shadow-[0_0_15px_rgba(231,76,60,0.1)]',
    icon: GAVEL,
  },
  CONFLICTED: {
    label: 'Conflicted',
    colorClass: 'text-status-error',
    bgClass: 'bg-status-error/10',
    glowClass: 'shadow-[0_0_15px_rgba(231,76,60,0.1)]',
    icon: WARN,
  },
  REJECTED: {
    label: 'Rejected',
    colorClass: 'text-status-error',
    bgClass: 'bg-status-error/10',
    glowClass: 'shadow-[0_0_15px_rgba(231,76,60,0.1)]',
    icon: X,
  },
  RESOLVED_CLAIMANT_WINS: {
    label: 'Claimant Upheld',
    colorClass: 'text-status-verified',
    bgClass: 'bg-status-verified/10',
    glowClass: 'shadow-[0_0_15px_rgba(102,252,241,0.1)]',
    icon: CHECK,
  },
  RESOLVED_CHALLENGER_WINS: {
    label: 'Challenge Upheld',
    colorClass: 'text-status-error',
    bgClass: 'bg-status-error/10',
    glowClass: 'shadow-[0_0_15px_rgba(231,76,60,0.1)]',
    icon: GAVEL,
  },
  EXPIRED: {
    label: 'Expired',
    colorClass: 'text-on-surface-variant',
    bgClass: 'bg-on-surface-variant/10',
    glowClass: '',
    icon: CLOCK,
  },
  REVOKED: {
    label: 'Revoked',
    colorClass: 'text-on-surface-variant',
    bgClass: 'bg-on-surface-variant/10',
    glowClass: '',
    icon: X,
  },
};

const NOT_FOUND_CONFIG: StatusConfig = {
  label: 'Not Found',
  colorClass: 'text-on-surface-variant',
  bgClass: 'bg-on-surface-variant/10',
  glowClass: '',
  icon: SEARCH,
};

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const config = STATUS_CONFIG[status] ?? NOT_FOUND_CONFIG;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-label-caps font-label-caps uppercase ${config.colorClass} ${config.bgClass} ${config.glowClass} ${className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}
