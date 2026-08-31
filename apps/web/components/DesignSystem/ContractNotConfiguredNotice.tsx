export function ContractNotConfiguredNotice({ action = 'this action' }: { action?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-status-warning/20 bg-status-warning/5 p-4">
      <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 flex-shrink-0 text-black" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M9.4 2.7a1.5 1.5 0 0 1 1.2 0c.28.12.5.33.65.55l8.02 13.87c.13.24.2.5.2.78a1.5 1.5 0 0 1-1.5 1.5H2.03a1.5 1.5 0 0 1-1.5-1.5c0-.28.07-.54.2-.78L8.75 3.25c.15-.22.37-.43.65-.55ZM10 7.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 7.5Zm0 6.5a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z"
          clipRule="evenodd"
        />
      </svg>
      <div>
        <p className="text-body-md font-medium text-black">Contract not yet configured</p>
        <p className="mt-1 text-body-sm text-black">
          The NexusKey Intelligent Contract hasn&apos;t been deployed to StudioNet yet, so {action} isn&apos;t
          available. This is a deliberate placeholder, not an error — the project owner deploys the
          contract and provides its address before this goes live.
        </p>
      </div>
    </div>
  );
}
