import type { TaxSettings } from './tax';

// A saved scenario is a named snapshot of a module's tuned inputs (and optional
// after-tax view). The pure CRUD helpers below own the list shape; the hook in
// state/useSavedScenarios wraps them with localStorage + id/timestamp generation.

export interface SavedScenario {
  id: string;
  name: string;
  moduleId: string;
  inputs: Record<string, number>;
  savedAt: string; // ISO timestamp
  tax?: (TaxSettings & { enabled: boolean }) | null;
}

export function addScenario(list: SavedScenario[], s: SavedScenario): SavedScenario[] {
  return [s, ...list]; // newest first
}

export function renameScenario(list: SavedScenario[], id: string, name: string): SavedScenario[] {
  const trimmed = name.trim();
  if (!trimmed) return list;
  return list.map((x) => (x.id === id ? { ...x, name: trimmed } : x));
}

export function deleteScenario(list: SavedScenario[], id: string): SavedScenario[] {
  return list.filter((x) => x.id !== id);
}

/** Overwrite the inputs (and tax) of an existing scenario in place. */
export function updateScenario(
  list: SavedScenario[],
  id: string,
  patch: Partial<Pick<SavedScenario, 'inputs' | 'tax' | 'savedAt'>>,
): SavedScenario[] {
  return list.map((x) => (x.id === id ? { ...x, ...patch } : x));
}
