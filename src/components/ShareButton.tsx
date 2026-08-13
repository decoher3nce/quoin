import { useEffect, useRef, useState } from 'react';

/**
 * Copies a shareable URL (built lazily on click, so it reflects current state)
 * to the clipboard, with a manual-copy popover fallback when the clipboard API
 * is unavailable (e.g. an insecure context or a sandboxed iframe).
 */
export function ShareButton({ getUrl }: { getUrl: () => string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onShare = async () => {
    const u = getUrl();
    setUrl(u);
    let ok = false;
    try {
      await navigator.clipboard.writeText(u);
      ok = true;
    } catch {
      ok = false;
    }
    setCopied(ok);
    // Focus/select the fallback field so a manual ⌘C works immediately.
    requestAnimationFrame(() => inputRef.current?.select());
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setUrl(null), ok ? 2200 : 8000);
  };

  return (
    <div className="relative">
      <button
        onClick={onShare}
        className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
        title="Copy a link that restores this scenario"
      >
        Share
      </button>
      {url && (
        <div className="absolute right-0 z-10 mt-1 w-80 rounded-md border border-stone-200 bg-white p-2 shadow-lg">
          <div className="mb-1 flex items-center justify-between">
            <span className={`text-xs font-medium ${copied ? 'text-emerald-600' : 'text-stone-500'}`}>
              {copied ? 'Link copied to clipboard' : 'Copy this link (⌘/Ctrl-C)'}
            </span>
            <button onClick={() => setUrl(null)} className="text-xs text-stone-400 hover:text-stone-600">
              ✕
            </button>
          </div>
          <input
            ref={inputRef}
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded border border-stone-300 bg-stone-50 px-2 py-1 text-xs text-stone-600"
          />
        </div>
      )}
    </div>
  );
}
