import type { Narrative } from '../core/types';
import { InlineText } from './ui';
import { DataHooks } from './DataHooks';

function List({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'risk' | 'opp';
}) {
  const dot = tone === 'risk' ? 'text-red-400' : 'text-emerald-500';
  return (
    <div>
      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
        {title}
      </h4>
      <ul className="space-y-1.5 text-sm text-stone-600">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className={`mt-0.5 ${dot}`}>
              {tone === 'risk' ? '▾' : '▴'}
            </span>
            <span>
              <InlineText text={it} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NarrativePane({ narrative }: { narrative: Narrative }) {
  const paragraphs = narrative.strategy.split('\n').filter((p) => p.trim().length > 0);
  return (
    <div className="space-y-5">
      <div>
        <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          Strategy
        </h4>
        <div className="space-y-2 text-sm leading-relaxed text-stone-600">
          {paragraphs.map((p, i) => (
            <p key={i}>
              <InlineText text={p} />
            </p>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <List title="Risks" items={narrative.risks} tone="risk" />
        <List title="Opportunities" items={narrative.opportunities} tone="opp" />
      </div>

      {narrative.regulatory && (
        <div className="rounded-lg border border-accent-500/30 bg-accent-500/5 p-3">
          <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-accent-600">
            Regulatory
          </h4>
          <p className="text-sm text-stone-600">
            <InlineText text={narrative.regulatory} />
          </p>
        </div>
      )}

      <DataHooks hooks={narrative.dataHooks} />
    </div>
  );
}
