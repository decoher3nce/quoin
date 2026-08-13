import type { InvestmentModule, ComputeResult } from '../core/types';
import { type AfterTaxResult, type TaxSettings } from '../core/tax';
import { formatMetric } from '../core/units';
import type { StoredTax } from '../state/useTaxSettings';
import { Card, HelpBadge, Toggle } from './ui';

const SIMPLIFICATIONS =
  'Straight-line depreciation (27.5-yr residential / 39-yr commercial), a flat marginal rate, and the assumption that rental losses are usable in the year they arise (passive-activity-loss limits are ignored). Basis is the purchase price only — no closing costs, capital improvements beyond those noted, 1031 exchange, NIIT, AMT, or state tax unless folded into the rates. A planning estimate, not tax advice.';

function RateInput({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  help?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm text-stone-600">
      <span>
        {label}
        <HelpBadge text={help} />
      </span>
      <span className="inline-flex items-center">
        <input
          type="number"
          className="tnum w-16 rounded-md border border-stone-300 bg-stone-50 px-2 py-1 text-right text-sm focus:border-accent-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-accent-500"
          value={Math.round(value * 1000) / 10}
          min={0}
          max={100}
          step={0.5}
          onChange={(e) => onChange((Number(e.target.value) || 0) / 100)}
        />
        <span className="ml-1 text-xs text-stone-400">%</span>
      </span>
    </label>
  );
}

function AfterTaxTile({
  label,
  after,
  before,
  unit,
  help,
}: {
  label: string;
  after: number;
  before: number;
  unit: '$/yr' | '$/mo' | '%';
  help?: string;
}) {
  const negative = Number.isFinite(after) && after < 0;
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
        {label}
        <HelpBadge text={help} />
      </div>
      <div className={`tnum mt-1 text-xl font-semibold tracking-tight ${negative ? 'text-red-600' : 'text-stone-800'}`}>
        {formatMetric(after, unit)}
      </div>
      <div className="tnum mt-0.5 text-[11px] text-stone-400">
        pre-tax {formatMetric(before, unit)}
      </div>
    </div>
  );
}

export function TaxPanel({
  module,
  result,
  tax,
  afterTax,
  setEnabled,
  setField,
}: {
  module: InvestmentModule;
  result: ComputeResult;
  tax: StoredTax;
  afterTax: AfterTaxResult | null;
  setEnabled: (b: boolean) => void;
  setField: (key: keyof TaxSettings, value: number) => void;
}) {
  const applicable = !!module.taxProfile;

  if (!applicable) {
    return (
      <Card title="After-tax">
        <p className="text-sm text-stone-500">
          After-tax modeling doesn&apos;t apply to this asset type.
          <HelpBadge text="Depreciation + recapture + capital-gains modeling fits held, depreciable real property. It is intentionally omitted for raw land and land leases (no depreciation), flips (ordinary income), notes / REITs / LP interests (different tax regimes), and personal-use property." />{' '}
          The metrics above are pre-tax.
        </p>
      </Card>
    );
  }

  const pre = result.metrics;

  return (
    <Card
      title="After-tax modeling"
      right={
        <div className="flex items-center gap-2 text-sm text-stone-600">
          <span>{tax.enabled ? 'On' : 'Off'}</span>
          <Toggle checked={tax.enabled} onChange={setEnabled} label="Toggle after-tax modeling" />
        </div>
      }
    >
      {!tax.enabled && (
        <p className="text-sm text-stone-500">
          Turn this on to layer straight-line depreciation, a marginal-rate income tax, and
          depreciation-recapture plus capital-gains tax at sale on top of the pre-tax numbers above.
          Depreciation often flips a thin pre-tax deal to after-tax positive.
        </p>
      )}

      {tax.enabled && afterTax && (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <RateInput label="Marginal rate" value={tax.marginalRate} onChange={(v) => setField('marginalRate', v)} help="Your ordinary-income tax rate applied to rental income and losses." />
            <RateInput label="Capital gains" value={tax.capGainsRate} onChange={(v) => setField('capGainsRate', v)} help="Long-term capital-gains rate at sale (0/15/20% federal for most)." />
            <RateInput label="Recapture cap" value={tax.recaptureRate} onChange={(v) => setField('recaptureRate', v)} help="§1250 unrecaptured-gain rate — capped at 25%." />
            <RateInput label="Land fraction" value={tax.landFraction} onChange={(v) => setField('landFraction', v)} help="Share of basis that is non-depreciable land. Raise it for land-heavy assets." />
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <AfterTaxTile label="Annual cash flow" after={afterTax.metrics.afterTaxAnnualCashFlow} before={pre.annualCashFlow ?? NaN} unit="$/yr" help="Year-1 cash flow after the income-tax effect of depreciation and interest." />
            <AfterTaxTile label="Monthly cash flow" after={afterTax.metrics.afterTaxMonthlyCashFlow} before={pre.monthlyCashFlow ?? NaN} unit="$/mo" />
            <AfterTaxTile label="Cash-on-cash" after={afterTax.metrics.afterTaxCashOnCash} before={pre.cashOnCash ?? NaN} unit="%" />
            <AfterTaxTile label="5-yr IRR" after={afterTax.metrics.afterTaxIrr} before={pre.irr5yr ?? NaN} unit="%" help="After-tax IRR, including recapture and capital-gains tax on the modeled sale." />
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Tax detail
            </h4>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
              <Row label="Depreciation / yr" value={formatMetric(afterTax.annualDepreciation, '$')} />
              <Row label="Year-1 taxable income" value={formatMetric(afterTax.years[0]?.taxableIncome ?? NaN, '$')} />
              <Row label="Year-1 income tax" value={formatMetric(afterTax.years[0]?.incomeTax ?? NaN, '$')} />
              <Row label="Total income tax (hold)" value={formatMetric(afterTax.totalIncomeTaxOverHold, '$')} />
              <Row label="Accumulated depreciation" value={formatMetric(afterTax.accumulatedDepreciation, '$')} />
              <Row label="Adjusted basis at sale" value={formatMetric(afterTax.adjustedBasis, '$')} />
              <Row label="Depreciation recapture tax" value={formatMetric(afterTax.recaptureTax, '$')} />
              <Row label="Capital-gains tax" value={formatMetric(afterTax.capitalGainsTax, '$')} />
              <Row label="After-tax sale proceeds" value={formatMetric(afterTax.afterTaxSaleProceeds, '$')} sub={`pre-tax ${formatMetric(afterTax.preTaxSaleProceeds, '$')}`} />
            </dl>
          </div>

          <p className="text-xs leading-relaxed text-stone-400">
            <span className="font-medium text-stone-500">Assumptions:</span> {SIMPLIFICATIONS}
          </p>
        </div>
      )}
    </Card>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-stone-500">{label}</dt>
      <dd className="tnum text-right font-medium text-stone-700">
        {value}
        {sub && <span className="ml-1 block text-[11px] font-normal text-stone-400">{sub}</span>}
      </dd>
    </div>
  );
}
