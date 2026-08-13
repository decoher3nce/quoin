import { describe, it, expect } from 'vitest';
import { GLOSSARY } from './glossary';

describe('glossary data', () => {
  const terms = new Set(GLOSSARY.map((e) => e.term));

  it('has unique term headwords', () => {
    expect(terms.size).toBe(GLOSSARY.length);
  });

  it('every entry has a non-empty definition', () => {
    const empty = GLOSSARY.filter((e) => !e.definition.trim());
    expect(empty.map((e) => e.term)).toEqual([]);
  });

  it('every "see also" reference resolves to a real term', () => {
    const dangling: string[] = [];
    for (const e of GLOSSARY) {
      for (const ref of e.seeAlso ?? []) {
        if (!terms.has(ref)) dangling.push(`${e.term} → ${ref}`);
      }
    }
    expect(dangling, `dangling see-also refs: ${dangling.join(', ')}`).toEqual([]);
  });
});
