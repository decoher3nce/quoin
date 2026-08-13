import { describe, it, expect } from 'vitest';
import { addScenario, renameScenario, deleteScenario, updateScenario, type SavedScenario } from './scenarios';

const mk = (id: string, name: string): SavedScenario => ({
  id,
  name,
  moduleId: 'metro-condo-ltr',
  inputs: { purchasePrice: 420000 },
  savedAt: '2026-01-01T00:00:00.000Z',
});

describe('saved-scenario CRUD', () => {
  it('adds newest-first', () => {
    const list = addScenario(addScenario([], mk('a', 'A')), mk('b', 'B'));
    expect(list.map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('renames by id and trims', () => {
    const list = renameScenario([mk('a', 'A')], 'a', '  New Name  ');
    expect(list[0]!.name).toBe('New Name');
  });

  it('ignores a blank rename', () => {
    const list = renameScenario([mk('a', 'A')], 'a', '   ');
    expect(list[0]!.name).toBe('A');
  });

  it('deletes by id', () => {
    const list = deleteScenario([mk('a', 'A'), mk('b', 'B')], 'a');
    expect(list.map((s) => s.id)).toEqual(['b']);
  });

  it('updates inputs in place without touching others', () => {
    const list = updateScenario([mk('a', 'A'), mk('b', 'B')], 'b', { inputs: { purchasePrice: 999 } });
    expect(list[0]!.inputs.purchasePrice).toBe(420000);
    expect(list[1]!.inputs.purchasePrice).toBe(999);
  });
});
