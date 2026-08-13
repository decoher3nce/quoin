import { useMemo } from 'react';
import type { InvestmentModule } from '../core/types';
import { InputsPane } from './InputsPane';
import { MetricsPane } from './MetricsPane';
import { NarrativePane } from './NarrativePane';
import { ProjectionTable } from './ProjectionTable';
import { ProjectionChart } from './ProjectionChart';
import { TaxPanel } from './TaxPanel';
import { SensitivityPanel } from './SensitivityPanel';
import { ShareButton } from './ShareButton';
import { SaveButton } from './SaveButton';
import { buildModuleShareUrl } from '../state/scenario';
import { Card } from './ui';
import { exportModuleXlsx } from '../export/xlsx';
import { exportPdf } from '../export/pdf';
import { computeAfterTax, type TaxSettings } from '../core/tax';
import type { StoredTax } from '../state/useTaxSettings';

export function ModuleView({
  module,
  inputs,
  setParam,
  reset,
  tax,
  setTaxEnabled,
  setTaxField,
  onSave,
}: {
  module: InvestmentModule;
  inputs: Record<string, number>;
  setParam: (key: string, value: number) => void;
  reset: () => void;
  tax: StoredTax;
  setTaxEnabled: (b: boolean) => void;
  setTaxField: (key: keyof TaxSettings, value: number) => void;
  onSave: (name: string) => void;
}) {
  const result = useMemo(() => module.compute(inputs), [module, inputs]);
  const afterTax = useMemo(
    () => (module.taxProfile && tax.enabled ? computeAfterTax(module, inputs, result, tax) : null),
    [module, inputs, result, tax],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-stone-800">{module.name}</h2>
          <p className="text-sm text-stone-500">{module.blurb}</p>
        </div>
        <div className="no-print flex gap-2">
          <button
            onClick={reset}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
          >
            Reset defaults
          </button>
          <SaveButton defaultName={module.name} onSave={onSave} />
          <ShareButton getUrl={() => buildModuleShareUrl(module, inputs, tax)} />
          <button
            onClick={() => exportModuleXlsx(module, inputs, result, afterTax)}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
          >
            Export .xlsx
          </button>
          <button
            onClick={() => exportPdf({ kind: 'module', module, inputs, result, afterTax })}
            className="rounded-md bg-accent-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-600"
          >
            Export .pdf
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,380px)_1fr]">
        <Card title="Inputs" className="min-w-0">
          <InputsPane module={module} inputs={inputs} setParam={setParam} />
        </Card>

        <div className="min-w-0 space-y-4">
          <Card title="Metrics">
            <MetricsPane module={module} result={result} />
          </Card>

          {result.projection && result.projection.length > 0 && (
            <Card title={`Projection — ${result.projection.length}-year hold`}>
              <ProjectionChart rows={result.projection} />
              <div className="mt-3">
                <ProjectionTable rows={result.projection} />
              </div>
            </Card>
          )}
        </div>
      </div>

      <TaxPanel
        module={module}
        result={result}
        tax={tax}
        afterTax={afterTax}
        setEnabled={setTaxEnabled}
        setField={setTaxField}
      />

      <SensitivityPanel module={module} inputs={inputs} />

      <Card title="Strategy · risks · opportunities">
        <NarrativePane narrative={module.narrative} />
      </Card>
    </div>
  );
}
