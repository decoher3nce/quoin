export type MenuItem = 'model' | 'compare' | 'saved' | 'glossary' | 'about';

const ITEMS: { key: MenuItem; label: string }[] = [
  { key: 'model', label: 'Model' },
  { key: 'compare', label: 'Compare' },
  { key: 'saved', label: 'Saved' },
  { key: 'glossary', label: 'Glossary' },
  { key: 'about', label: 'About' },
];

export function MenuBar({
  active,
  onSelect,
  savedCount,
}: {
  active: MenuItem;
  onSelect: (item: MenuItem) => void;
  savedCount: number;
}) {
  return (
    <nav className="flex items-center gap-1">
      {ITEMS.map(({ key, label }) => {
        const on = active === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            aria-current={on ? 'page' : undefined}
            className={`relative rounded-md px-3 py-1.5 text-sm font-medium transition ${
              on ? 'bg-accent-500 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {label}
            {key === 'saved' && savedCount > 0 && (
              <span
                className={`ml-1.5 rounded-full px-1.5 text-[10px] ${
                  on ? 'bg-white/25 text-white' : 'bg-stone-300/70 text-stone-600'
                }`}
              >
                {savedCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
