import { useCallback, useEffect, useState } from 'react';
import { SAVED_KEY } from './keys';
import {
  addScenario,
  deleteScenario,
  renameScenario,
  updateScenario,
  type SavedScenario,
} from '../core/scenarios';

function load(): SavedScenario[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedScenario[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore malformed storage */
  }
  return [];
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

export type NewScenario = Omit<SavedScenario, 'id' | 'savedAt'>;

/** The saved-scenarios library, persisted to localStorage. */
export function useSavedScenarios() {
  const [scenarios, setScenarios] = useState<SavedScenario[]>(() => load());

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(scenarios));
    } catch {
      /* non-fatal */
    }
  }, [scenarios]);

  const save = useCallback((s: NewScenario): SavedScenario => {
    const full: SavedScenario = { ...s, id: newId(), savedAt: new Date().toISOString() };
    setScenarios((prev) => addScenario(prev, full));
    return full;
  }, []);

  const rename = useCallback(
    (id: string, name: string) => setScenarios((prev) => renameScenario(prev, id, name)),
    [],
  );

  const remove = useCallback((id: string) => setScenarios((prev) => deleteScenario(prev, id)), []);

  const overwrite = useCallback(
    (id: string, inputs: Record<string, number>, tax?: SavedScenario['tax']) =>
      setScenarios((prev) =>
        updateScenario(prev, id, { inputs, tax: tax ?? null, savedAt: new Date().toISOString() }),
      ),
    [],
  );

  return { scenarios, save, rename, remove, overwrite };
}
