import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_TAX_SETTINGS, type TaxSettings } from '../core/tax';
import { TAX_KEY as KEY } from './keys';

export interface StoredTax extends TaxSettings {
  enabled: boolean;
}

const DEFAULT_STORED: StoredTax = { ...DEFAULT_TAX_SETTINGS, enabled: false };

function load(): StoredTax {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_STORED, ...(JSON.parse(raw) as Partial<StoredTax>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_STORED;
}

/** Global after-tax settings (enabled flag + rates), persisted to localStorage. */
export function useTaxSettings() {
  const [tax, setTax] = useState<StoredTax>(() => load());

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(tax));
    } catch {
      /* ignore */
    }
  }, [tax]);

  const setEnabled = useCallback((enabled: boolean) => setTax((t) => ({ ...t, enabled })), []);
  const setField = useCallback(
    (key: keyof TaxSettings, value: number) => setTax((t) => ({ ...t, [key]: value })),
    [],
  );

  return { tax, setEnabled, setField };
}
