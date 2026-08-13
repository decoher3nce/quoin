import { useEffect, useState } from 'react';
import { MODULES, getModule } from './modules';
import { TabNav, type Selection } from './components/TabNav';
import { ModuleView } from './components/ModuleView';
import { ComparisonView } from './components/ComparisonView';
import { GlossaryView } from './components/GlossaryView';
import { SavedView } from './components/SavedView';
import { AssumptionsPanel } from './components/AssumptionsPanel';
import { useModuleInputs } from './state/useModuleState';
import { useTaxSettings } from './state/useTaxSettings';
import { useSavedScenarios, type NewScenario } from './state/useSavedScenarios';
import type { SavedScenario } from './core/scenarios';
import type { TaxSettings } from './core/tax';
import type { StoredTax } from './state/useTaxSettings';
import { SELECTION_KEY, inputsKey } from './state/keys';

const TAX_RATE_KEYS = ['marginalRate', 'capGainsRate', 'recaptureRate', 'landFraction'] as const;

function loadSelection(): Selection {
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Selection;
      if (s.kind === 'compare' || s.kind === 'glossary' || s.kind === 'saved') return s;
      if (s.kind === 'module' && getModule(s.id)) return s;
    }
  } catch {
    /* ignore */
  }
  return { kind: 'module', id: MODULES[0]!.id };
}

/** Renders a module tab. Split out so the input hook keys off the module. */
function ModuleTab({
  id,
  tax,
  setTaxEnabled,
  setTaxField,
  onSave,
}: {
  id: string;
  tax: StoredTax;
  setTaxEnabled: (b: boolean) => void;
  setTaxField: (key: keyof TaxSettings, value: number) => void;
  onSave: (s: NewScenario) => void;
}) {
  const module = getModule(id)!;
  const { inputs, setParam, reset } = useModuleInputs(module);
  return (
    <ModuleView
      module={module}
      inputs={inputs}
      setParam={setParam}
      reset={reset}
      tax={tax}
      setTaxEnabled={setTaxEnabled}
      setTaxField={setTaxField}
      onSave={(name) => onSave({ name, moduleId: module.id, inputs, tax: tax.enabled ? tax : null })}
    />
  );
}

export default function App() {
  const [selection, setSelection] = useState<Selection>(() => loadSelection());
  const [loadNonce, setLoadNonce] = useState(0);
  const { tax, setEnabled: setTaxEnabled, setField: setTaxField } = useTaxSettings();
  const { scenarios, save, rename, remove } = useSavedScenarios();

  useEffect(() => {
    try {
      localStorage.setItem(SELECTION_KEY, JSON.stringify(selection));
    } catch {
      /* ignore */
    }
  }, [selection]);

  // Load a saved scenario: seed the module's inputs + tax, then remount the tab.
  const loadScenario = (s: SavedScenario) => {
    if (!getModule(s.moduleId)) return;
    try {
      localStorage.setItem(inputsKey(s.moduleId), JSON.stringify(s.inputs));
    } catch {
      /* ignore */
    }
    if (s.tax) {
      setTaxEnabled(s.tax.enabled);
      for (const k of TAX_RATE_KEYS) setTaxField(k, s.tax[k]);
    }
    setSelection({ kind: 'module', id: s.moduleId });
    setLoadNonce((n) => n + 1); // force a remount even if already on this module
  };

  return (
    <div className="flex h-full flex-col">
      <header className="no-print flex items-center justify-between border-b border-stone-200 bg-white px-5 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-xl font-bold tracking-tight text-accent-700">Quoin</span>
          <span className="hidden text-sm text-stone-400 sm:inline">
            Model &amp; compare real-estate investments on the same footing
          </span>
        </div>
        <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-500">
          v2 · {MODULES.length} modules
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="no-print w-64 shrink-0 border-r border-stone-200 bg-stone-100">
          <TabNav selection={selection} onSelect={setSelection} savedCount={scenarios.length} />
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-4 p-5">
            {selection.kind !== 'glossary' && selection.kind !== 'saved' && <AssumptionsPanel />}
            {selection.kind === 'compare' ? (
              <ComparisonView tax={tax} setTaxEnabled={setTaxEnabled} />
            ) : selection.kind === 'glossary' ? (
              <GlossaryView />
            ) : selection.kind === 'saved' ? (
              <SavedView
                scenarios={scenarios}
                onLoad={loadScenario}
                onRename={rename}
                onRemove={remove}
              />
            ) : (
              <ModuleTab
                key={`${selection.id}:${loadNonce}`}
                id={selection.id}
                tax={tax}
                setTaxEnabled={setTaxEnabled}
                setTaxField={setTaxField}
                onSave={save}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
