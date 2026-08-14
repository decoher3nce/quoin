import type { InvestmentModule, ParamSpec } from './types';

// Sensitivity analysis. Because every module's compute() is pure, this is just
// "recompute with perturbed inputs" — a tornado (rank inputs by how much they
// move one output metric) and a two-way grid (a metric across two inputs). No
// module changes needed; it composes the existing engine.

function clampToSpec(v: number, spec: ParamSpec): number {
  let out = v;
  if (spec.type === 'integer') out = Math.round(out);
  if (spec.min != null) out = Math.max(out, spec.min);
  if (spec.max != null) out = Math.min(out, spec.max);
  return out;
}

function metricOf(
  module: InvestmentModule,
  inputs: Record<string, number>,
  metricKey: string,
): number {
  const v = module.compute(inputs).metrics[metricKey];
  return v ?? NaN;
}

// ── Tornado ─────────────────────────────────────────────────────────────────

export interface TornadoBar {
  key: string;
  label: string;
  base: number;
  low: number; // metric when the input is at −pct
  high: number; // metric when the input is at +pct
  lowInput: number;
  highInput: number;
  swing: number; // |high − low|, NaN if either endpoint is non-finite
}

export interface TornadoResult {
  metricKey: string;
  base: number;
  bars: TornadoBar[]; // sorted by swing, largest first
}

/**
 * Vary each numeric input by ±`pct` (relative, clamped to the param's min/max)
 * and measure the swing in `metricKey`. Inputs whose base value is 0 (no relative
 * signal) or that clamp to a single value are skipped.
 */
export function tornado(
  module: InvestmentModule,
  inputs: Record<string, number>,
  metricKey: string,
  pct = 0.1,
): TornadoResult {
  const base = metricOf(module, inputs, metricKey);
  const bars: TornadoBar[] = [];
  for (const spec of module.params) {
    const bv = inputs[spec.key] ?? spec.default;
    if (bv === 0) continue;
    const lo = clampToSpec(bv * (1 - pct), spec);
    const hi = clampToSpec(bv * (1 + pct), spec);
    if (lo === hi) continue;
    const low = metricOf(module, { ...inputs, [spec.key]: lo }, metricKey);
    const high = metricOf(module, { ...inputs, [spec.key]: hi }, metricKey);
    const swing = Number.isFinite(low) && Number.isFinite(high) ? Math.abs(high - low) : NaN;
    bars.push({ key: spec.key, label: spec.label, base, low, high, lowInput: lo, highInput: hi, swing });
  }
  bars.sort(
    (a, b) =>
      (Number.isFinite(b.swing) ? b.swing : -Infinity) -
      (Number.isFinite(a.swing) ? a.swing : -Infinity),
  );
  return { metricKey, base, bars };
}

// ── Two-way grid ─────────────────────────────────────────────────────────────

export interface GridResult {
  xKey: string;
  yKey: string;
  metricKey: string;
  xs: number[];
  ys: number[];
  cells: number[][]; // cells[yi][xi]
  base: number;
  xBaseIndex: number; // column holding the current (base) x value; -1 if absent
  yBaseIndex: number; // row holding the current (base) y value; -1 if absent
  min: number;
  max: number;
}

function axisValues(base: number, pct: number, steps: number, spec: ParamSpec): number[] {
  const lo = base * (1 - pct);
  const hi = base * (1 + pct);
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0.5 : i / (steps - 1);
    const v = clampToSpec(lo + t * (hi - lo), spec);
    // De-duplicate: integer params (or a tight clamp) can round adjacent steps to
    // the same value; a grid with repeated identical rows/columns is misleading.
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

/** A metric evaluated across a grid of two inputs, each swept ±`pct`. */
export function grid(
  module: InvestmentModule,
  inputs: Record<string, number>,
  xKey: string,
  yKey: string,
  metricKey: string,
  steps = 5,
  pct = 0.2,
): GridResult {
  const xspec = module.params.find((p) => p.key === xKey)!;
  const yspec = module.params.find((p) => p.key === yKey)!;
  const xbase = inputs[xKey] ?? xspec.default;
  const ybase = inputs[yKey] ?? yspec.default;
  const xs = axisValues(xbase, pct, steps, xspec);
  const ys = axisValues(ybase, pct, steps, yspec);
  const base = metricOf(module, inputs, metricKey);

  let min = Infinity;
  let max = -Infinity;
  const cells = ys.map((yv) =>
    xs.map((xv) => {
      const v = metricOf(module, { ...inputs, [xKey]: xv, [yKey]: yv }, metricKey);
      if (Number.isFinite(v)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
      return v;
    }),
  );

  return {
    xKey,
    yKey,
    metricKey,
    xs,
    ys,
    cells,
    base,
    xBaseIndex: xs.indexOf(clampToSpec(xbase, xspec)),
    yBaseIndex: ys.indexOf(clampToSpec(ybase, yspec)),
    min: Number.isFinite(min) ? min : NaN,
    max: Number.isFinite(max) ? max : NaN,
  };
}

/** Numeric params worth perturbing (non-zero base → relative sweep has signal). */
export function sensitiveParams(
  module: InvestmentModule,
  inputs: Record<string, number>,
): ParamSpec[] {
  return module.params.filter((p) => (inputs[p.key] ?? p.default) !== 0);
}
