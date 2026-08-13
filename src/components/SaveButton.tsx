import { useEffect, useRef, useState } from 'react';

/** Saves the current scenario under a user-given name (defaulting to `defaultName`). */
export function SaveButton({ defaultName, onSave }: { defaultName: string; onSave: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [savedMsg, setSavedMsg] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const openForm = () => {
    setName(defaultName);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const commit = () => {
    onSave(name.trim() || defaultName);
    setOpen(false);
    setSavedMsg(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSavedMsg(false), 1800);
  };

  return (
    <div className="relative">
      <button
        onClick={() => (open ? setOpen(false) : openForm())}
        className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
        title="Save this tuned deal to your library"
      >
        {savedMsg ? 'Saved ✓' : 'Save'}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-72 rounded-md border border-stone-200 bg-white p-2 shadow-lg">
          <label className="mb-1 block text-xs font-medium text-stone-500">Name this scenario</label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setOpen(false);
              }}
              className="min-w-0 flex-1 rounded border border-stone-300 bg-stone-50 px-2 py-1 text-sm text-stone-700 focus:border-accent-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-accent-500"
            />
            <button
              onClick={commit}
              className="shrink-0 rounded-md bg-accent-500 px-3 py-1 text-sm font-medium text-white hover:bg-accent-600"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
