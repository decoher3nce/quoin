import type { ReactNode } from 'react';

/** Accessible on/off switch. Flex-based so the knob can't drift off the track. */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        checked ? 'bg-accent-500' : 'bg-stone-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/** Minimal inline formatter: renders **bold** spans, leaves the rest as text. */
export function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, idx) => {
        if (p.startsWith('**') && p.endsWith('**')) {
          return (
            <strong key={idx} className="font-semibold text-stone-700">
              {p.slice(2, -2)}
            </strong>
          );
        }
        return <span key={idx}>{p}</span>;
      })}
    </>
  );
}

/** Small help affordance: a hoverable “?” carrying a native tooltip. */
export function HelpBadge({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <span
      title={text}
      className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-stone-300 text-[10px] font-medium text-stone-400 align-middle"
      aria-label={text}
    >
      ?
    </span>
  );
}

/** Marks an input the user must verify against a primary source. */
export function VerifyBadge() {
  return (
    <span
      title="Verify against a primary source — this input moves results and is not authoritative here."
      className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700"
    >
      verify
    </span>
  );
}

export function Card({
  title,
  children,
  right,
  className = '',
}: {
  title?: ReactNode;
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-stone-200 bg-white shadow-sm ${className}`}
    >
      {title && (
        <header className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
          <h3 className="text-sm font-semibold tracking-tight text-stone-700">{title}</h3>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
