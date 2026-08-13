// Shareable-scenario codec. A scenario is encoded to a compact base64url string
// that rides in the URL hash. Keys are short to keep links small, and module
// inputs are stored as DELTAS from defaults (only what was tuned).

export interface ModuleScenario {
  k: 'm';
  id: string;
  d: Record<string, number>; // input deltas from module defaults
  t?: { m: number; c: number; r: number; l: number }; // after-tax rates (present ⇒ enabled)
}

export interface CompareScenario {
  k: 'c';
  ids: string[];
  di: Record<string, Record<string, number>>; // deltas by module id
}

export type Scenario = ModuleScenario | CompareScenario;

function toB64url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeScenario(s: Scenario): string {
  return toB64url(JSON.stringify(s));
}

/** Decode a scenario, returning null on anything malformed or unrecognized. */
export function decodeScenario(encoded: string): Scenario | null {
  try {
    const obj = JSON.parse(fromB64url(encoded)) as unknown;
    if (!obj || typeof obj !== 'object') return null;
    const s = obj as Scenario;
    if (s.k === 'm' && typeof s.id === 'string' && s.d && typeof s.d === 'object') return s;
    if (s.k === 'c' && Array.isArray(s.ids) && s.di && typeof s.di === 'object') return s;
    return null;
  } catch {
    return null;
  }
}
