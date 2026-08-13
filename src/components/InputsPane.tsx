import { useMemo } from 'react';
import type { InvestmentModule, ParamSpec } from '../core/types';
import { toEditable, fromEditable } from '../core/units';
import { HelpBadge, VerifyBadge } from './ui';

function groupParams(params: ParamSpec[]): [string, ParamSpec[]][] {
  const order: string[] = [];
  const byGroup = new Map<string, ParamSpec[]>();
  for (const p of params) {
    if (!byGroup.has(p.group)) {
      byGroup.set(p.group, []);
      order.push(p.group);
    }
    byGroup.get(p.group)!.push(p);
  }
  return order.map((g) => [g, byGroup.get(g)!]);
}

function suffixFor(p: ParamSpec): string {
  if (p.type === 'percent') return '%';
  if (p.type === 'currency') return '$';
  if (p.unit === '$/night') return '$/night';
  return '';
}

function ParamField({
  spec,
  value,
  onChange,
}: {
  spec: ParamSpec;
  value: number;
  onChange: (v: number) => void;
}) {
  const editable = toEditable(value, spec.type);
  const suffix = suffixFor(spec);
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex-1 text-sm text-stone-600">
        {spec.label}
        <HelpBadge text={spec.help} />
        {spec.verify && <VerifyBadge />}
      </span>
      <span className="relative inline-flex items-center">
        {suffix === '$' && (
          <span className="pointer-events-none absolute left-2 text-xs text-stone-400">$</span>
        )}
        <input
          type="number"
          className={`tnum w-28 rounded-md border border-stone-300 bg-stone-50 py-1 text-right text-sm text-stone-800 focus:border-accent-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-accent-500 ${
            suffix === '$' ? 'pl-5 pr-2' : 'px-2'
          }`}
          value={Number.isFinite(editable) ? editable : ''}
          min={spec.type === 'percent' && spec.min != null ? spec.min * 100 : spec.min}
          max={spec.type === 'percent' && spec.max != null ? spec.max * 100 : spec.max}
          step={spec.type === 'percent' && spec.step != null ? spec.step * 100 : spec.step}
          onChange={(e) => {
            const raw = e.target.value === '' ? 0 : Number(e.target.value);
            if (Number.isFinite(raw)) onChange(fromEditable(raw, spec.type));
          }}
        />
        {suffix === '%' && <span className="ml-1 w-4 text-xs text-stone-400">%</span>}
        {suffix === '$/night' && (
          <span className="ml-1 text-[10px] text-stone-400">/night</span>
        )}
      </span>
    </label>
  );
}

export function InputsPane({
  module,
  inputs,
  setParam,
}: {
  module: InvestmentModule;
  inputs: Record<string, number>;
  setParam: (key: string, value: number) => void;
}) {
  const groups = useMemo(() => groupParams(module.params), [module]);
  return (
    <div className="space-y-5">
      {groups.map(([group, specs]) => (
        <div key={group}>
          <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            {group}
          </h4>
          <div className="divide-y divide-stone-100">
            {specs.map((spec) => (
              <ParamField
                key={spec.key}
                spec={spec}
                value={inputs[spec.key] ?? spec.default}
                onChange={(v) => setParam(spec.key, v)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
