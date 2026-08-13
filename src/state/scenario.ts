import type { InvestmentModule } from '../core/types';
import { defaultsOf } from '../core/types';
import { getModule } from '../modules';
import { encodeScenario, decodeScenario, type ModuleScenario, type CompareScenario } from '../core/share';
import { inputsKey, SELECTION_KEY, TAX_KEY, COMPARE_KEY } from './keys';
import type { StoredTax } from './useTaxSettings';

const HASH_PREFIX = '#s=';

/** Inputs that differ from the module's defaults (keeps share links short). */
function deltas(module: InvestmentModule, inputs: Record<string, number>): Record<string, number> {
  const def = defaultsOf(module);
  const d: Record<string, number> = {};
  for (const p of module.params) {
    const v = inputs[p.key];
    if (v !== undefined && v !== def[p.key]) d[p.key] = v;
  }
  return d;
}

function shareUrl(encoded: string): string {
  return `${window.location.origin}${window.location.pathname}${HASH_PREFIX}${encoded}`;
}

/** A shareable link that restores this module with its tuned inputs (and after-tax view). */
export function buildModuleShareUrl(
  module: InvestmentModule,
  inputs: Record<string, number>,
  tax: StoredTax,
): string {
  const s: ModuleScenario = { k: 'm', id: module.id, d: deltas(module, inputs) };
  if (tax.enabled) s.t = { m: tax.marginalRate, c: tax.capGainsRate, r: tax.recaptureRate, l: tax.landFraction };
  return shareUrl(encodeScenario(s));
}

/** A shareable link that restores a comparison of these tuned modules. */
export function buildCompareShareUrl(pairs: { module: InvestmentModule; inputs: Record<string, number> }[]): string {
  const di: Record<string, Record<string, number>> = {};
  for (const { module, inputs } of pairs) di[module.id] = deltas(module, inputs);
  const s: CompareScenario = { k: 'c', ids: pairs.map((p) => p.module.id), di };
  return shareUrl(encodeScenario(s));
}

function clearHash(): void {
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    /* ignore */
  }
}

/**
 * Called once at startup. If the URL carries a scenario hash, write it into
 * localStorage (so the normal state hooks pick it up) and clear the hash. Opening
 * a shared link adopts that deal into the workspace. Returns true if applied.
 */
export function applyIncomingScenario(): boolean {
  const hash = window.location.hash;
  if (!hash.startsWith(HASH_PREFIX)) return false;
  const scenario = decodeScenario(hash.slice(HASH_PREFIX.length));
  if (!scenario) {
    clearHash();
    return false;
  }
  try {
    if (scenario.k === 'm') {
      const module = getModule(scenario.id);
      if (!module) return false;
      localStorage.setItem(inputsKey(module.id), JSON.stringify({ ...defaultsOf(module), ...scenario.d }));
      localStorage.setItem(SELECTION_KEY, JSON.stringify({ kind: 'module', id: module.id }));
      if (scenario.t) {
        const tax: StoredTax = {
          enabled: true,
          marginalRate: scenario.t.m,
          capGainsRate: scenario.t.c,
          recaptureRate: scenario.t.r,
          landFraction: scenario.t.l,
        };
        localStorage.setItem(TAX_KEY, JSON.stringify(tax));
      }
    } else {
      const ids = scenario.ids.filter((id) => getModule(id));
      if (ids.length === 0) return false;
      for (const id of ids) {
        const module = getModule(id)!;
        localStorage.setItem(inputsKey(id), JSON.stringify({ ...defaultsOf(module), ...(scenario.di[id] ?? {}) }));
      }
      localStorage.setItem(COMPARE_KEY, JSON.stringify(ids));
      localStorage.setItem(SELECTION_KEY, JSON.stringify({ kind: 'compare' }));
    }
  } catch {
    /* ignore storage failure — fall through and clear the hash */
  }
  clearHash();
  return true;
}
