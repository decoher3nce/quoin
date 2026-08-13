import { useCallback, useEffect, useMemo, useState } from 'react';
import type { InvestmentModule, InvestmentCategory } from '../core/types';
import { MODULES } from '../modules';

const CATEGORY_ORDER: InvestmentCategory[] = [
  'Land',
  'Residential',
  'Commercial',
  'Hospitality',
  'Paper',
  'ValueAdd',
  'Infrastructure',
  'Novel',
];

const CATEGORY_LABELS: Record<InvestmentCategory, string> = {
  Land: 'Land',
  Residential: 'Residential',
  Commercial: 'Commercial',
  Hospitality: 'Hospitality',
  Paper: 'Paper & passive',
  ValueAdd: 'Value-add',
  Infrastructure: 'Infrastructure',
  Novel: 'Novel',
};

export type Selection =
  | { kind: 'module'; id: string }
  | { kind: 'compare' }
  | { kind: 'glossary' }
  | { kind: 'saved' };

const COLLAPSE_KEY = 'quoin:nav:collapsed';

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

export function TabNav({
  selection,
  onSelect,
  savedCount,
}: {
  selection: Selection;
  onSelect: (s: Selection) => void;
  savedCount: number;
}) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsed());

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...collapsed]));
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const toggleCollapse = useCallback((cat: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const searching = query.trim().length > 0;

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (m: InvestmentModule) =>
      !q || m.name.toLowerCase().includes(q) || m.blurb.toLowerCase().includes(q);
    const byCat = new Map<InvestmentCategory, InvestmentModule[]>();
    for (const m of MODULES) {
      if (!matches(m)) continue;
      if (!byCat.has(m.category)) byCat.set(m.category, []);
      byCat.get(m.category)!.push(m);
    }
    return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => [c, byCat.get(c)!] as const);
  }, [query]);

  const navBtn = (active: boolean) =>
    `mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
      active ? 'bg-accent-500 text-white' : 'text-stone-600 hover:bg-stone-200/60'
    }`;

  return (
    <nav className="flex h-full flex-col">
      <div className="p-3">
        <input
          type="search"
          placeholder="Search modules…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 placeholder:text-stone-400 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <button onClick={() => onSelect({ kind: 'compare' })} className={navBtn(selection.kind === 'compare')}>
          <span aria-hidden>⊞</span> Compare
        </button>
        <button onClick={() => onSelect({ kind: 'saved' })} className={navBtn(selection.kind === 'saved')}>
          <span aria-hidden>★</span> Saved
          {savedCount > 0 && (
            <span
              className={`ml-auto rounded-full px-1.5 text-[10px] ${
                selection.kind === 'saved' ? 'bg-white/25 text-white' : 'bg-stone-300/60 text-stone-600'
              }`}
            >
              {savedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onSelect({ kind: 'glossary' })}
          className={`${navBtn(selection.kind === 'glossary')} mb-3`}
        >
          <span aria-hidden>📖</span> Glossary
        </button>

        {grouped.map(([cat, mods]) => {
          const isCollapsed = !searching && collapsed.has(cat);
          return (
            <div key={cat} className="mb-2">
              <button
                onClick={() => toggleCollapse(cat)}
                disabled={searching}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center justify-between rounded px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400 hover:text-stone-600 disabled:cursor-default disabled:hover:text-stone-400"
              >
                <span>
                  {CATEGORY_LABELS[cat]}
                  <span className="ml-1.5 text-stone-300">{mods.length}</span>
                </span>
                <span
                  aria-hidden
                  className={`text-stone-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                >
                  ›
                </span>
              </button>
              {!isCollapsed && (
                <ul>
                  {mods.map((m) => {
                    const active = selection.kind === 'module' && selection.id === m.id;
                    return (
                      <li key={m.id}>
                        <button
                          onClick={() => onSelect({ kind: 'module', id: m.id })}
                          title={m.blurb}
                          className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition ${
                            active
                              ? 'bg-white font-medium text-accent-700 shadow-sm ring-1 ring-stone-200'
                              : 'text-stone-600 hover:bg-stone-200/60'
                          }`}
                        >
                          {m.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}

        {grouped.length === 0 && (
          <p className="px-3 py-4 text-sm text-stone-400">No modules match “{query}”.</p>
        )}
      </div>
    </nav>
  );
}
