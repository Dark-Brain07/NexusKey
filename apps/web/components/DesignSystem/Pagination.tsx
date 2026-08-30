import { Button } from './Button';

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="mt-8 flex items-center justify-center gap-4">
      <Button
        variant="secondary"
        className="text-body-sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        ← Previous
      </Button>
      <span className="text-body-sm text-on-surface-variant">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="secondary"
        className="text-body-sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next →
      </Button>
    </div>
  );
}
