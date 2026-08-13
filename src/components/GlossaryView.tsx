import { useMemo, useState } from 'react';
import { GLOSSARY, type GlossaryCategory, type GlossaryEntry } from '../core/glossary';
import { Card } from './ui';

const CATEGORY_ORDER: GlossaryCategory[] = [
  'Returns & metrics',
  'Financing',
  'Rental & residential',
  'Commercial & industrial',
  'Hospitality & operations',
  'Paper & passive',
  'Land & development',
  'Infrastructure & easements',
  'Remote-sensing signals',
  'Taxes & depreciation',
  'General',
];

function matchEntry(e: GlossaryEntry, q: string): boolean {
  if (!q) return true;
  return (
    e.term.toLowerCase().includes(q) ||
    (e.full?.toLowerCase().includes(q) ?? false) ||
    e.definition.toLowerCase().includes(q)
  );
}

export function GlossaryView() {
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byCat = new Map<GlossaryCategory, GlossaryEntry[]>();
    for (const e of GLOSSARY) {
      if (!matchEntry(e, q)) continue;
      if (!byCat.has(e.category)) byCat.set(e.category, []);
      byCat.get(e.category)!.push(e);
    }
    for (const list of byCat.values()) list.sort((a, b) => a.term.localeCompare(b.term));
    return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => [c, byCat.get(c)!] as const);
  }, [query]);

  const total = grouped.reduce((n, [, list]) => n + list.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-stone-800">Glossary</h2>
          <p className="text-sm text-stone-500">
            Every acronym and term used in Quoin, defined the way the app uses it.
          </p>
        </div>
        <input
          type="search"
          placeholder="Search terms…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-56 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 placeholder:text-stone-400 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
        />
      </div>

      {total === 0 && (
        <Card>
          <p className="text-sm text-stone-400">
            No terms match “{query}”.{' '}
            <button className="text-accent-600 underline" onClick={() => setQuery('')}>
              Clear
            </button>
          </p>
        </Card>
      )}

      {grouped.map(([cat, entries]) => (
        <Card key={cat} title={cat}>
          <dl className="divide-y divide-stone-100">
            {entries.map((e) => (
              <div key={e.term} className="py-3 first:pt-0 last:pb-0">
                <dt className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold text-stone-800">{e.term}</span>
                  {e.full && <span className="text-sm text-stone-400">— {e.full}</span>}
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-stone-600">{e.definition}</dd>
                {e.seeAlso && e.seeAlso.length > 0 && (
                  <dd className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] uppercase tracking-wide text-stone-400">See also</span>
                    {e.seeAlso.map((s) => (
                      <button
                        key={s}
                        onClick={() => setQuery(s)}
                        className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500 hover:bg-accent-500/10 hover:text-accent-700"
                      >
                        {s}
                      </button>
                    ))}
                  </dd>
                )}
              </div>
            ))}
          </dl>
        </Card>
      ))}
    </div>
  );
}
