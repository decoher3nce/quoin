import { useCallback, useEffect, useState } from 'react';
import type { InvestmentModule } from '../core/types';
import { defaultsOf } from '../core/types';
import { inputsKey } from './keys';

function loadInputs(module: InvestmentModule): Record<string, number> {
  const base = defaultsOf(module);
  try {
    const raw = localStorage.getItem(inputsKey(module.id));
    if (raw) {
      const saved = JSON.parse(raw) as Record<string, number>;
      // Merge over defaults so newly-added params still get a value.
      return { ...base, ...saved };
    }
  } catch {
    /* ignore malformed storage */
  }
  return base;
}

/** Read a module's current inputs (persisted over defaults) without a hook.
 *  Used by the comparison view so it reflects each module's last-tuned state. */
export function readPersistedInputs(module: InvestmentModule): Record<string, number> {
  return loadInputs(module);
}

/** Per-module input state, persisted to localStorage, with reset-to-defaults. */
export function useModuleInputs(module: InvestmentModule) {
  const [inputs, setInputs] = useState<Record<string, number>>(() => loadInputs(module));

  useEffect(() => {
    setInputs(loadInputs(module));
  }, [module]);

  useEffect(() => {
    try {
      localStorage.setItem(inputsKey(module.id), JSON.stringify(inputs));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [module.id, inputs]);

  const setParam = useCallback((key: string, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setInputs(defaultsOf(module));
  }, [module]);

  return { inputs, setParam, reset };
}

/** A dismissible flag persisted to localStorage (used by the assumptions panel). */
export function usePersistentDismiss(key: string) {
  const storageKey = `quoin:dismiss:${key}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });
  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* non-fatal */
    }
  }, [storageKey]);
  const restore = useCallback(() => {
    setDismissed(false);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* non-fatal */
    }
  }, [storageKey]);
  return { dismissed, dismiss, restore };
}
