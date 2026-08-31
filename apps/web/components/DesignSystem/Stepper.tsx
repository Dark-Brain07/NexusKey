export interface Step {
  label: string;
}

export function Stepper({ steps, currentIndex }: { steps: Step[]; currentIndex: number }) {
  return (
    <div className="flex items-center justify-between px-4" role="list" aria-label="Progress">
      {steps.map((step, i) => (
        <div key={step.label} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-2" role="listitem">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border font-mono-data text-mono-data ${
                i < currentIndex
                  ? 'border-surface-tint bg-surface-tint/10 text-black'
                  : i === currentIndex
                    ? 'border-surface-tint bg-surface-tint/10 text-black'
                    : 'border-outline-variant text-black opacity-40'
              }`}
              aria-current={i === currentIndex ? 'step' : undefined}
            >
              {String(i + 1).padStart(2, '0')}
            </div>
            <span
              className={`text-label-caps font-label-caps ${
                i <= currentIndex ? 'text-black' : 'text-black opacity-40'
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`-mt-6 mx-4 h-px flex-1 ${i < currentIndex ? 'bg-surface-tint' : 'bg-border-subtle'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
