export function GlassPanel({
  children,
  className = '',
  as: Component = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return <Component className={`glass-panel rounded-xl ${className}`}>{children}</Component>;
}

export function Card({
  children,
  className = '',
  hover = true,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-border-subtle bg-surface-card p-6 ${
        hover ? 'transition-colors hover:border-surface-tint/40' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
