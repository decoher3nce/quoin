import { useEffect, useState } from 'react';
import { MODULES, getModule } from './modules';
import { TabNav, type Selection } from './components/TabNav';
import { MenuBar, type MenuItem } from './components/MenuBar';
import { ModuleView } from './components/ModuleView';
import { ComparisonView } from './components/ComparisonView';
import { GlossaryView } from './components/GlossaryView';
import { SavedView } from './components/SavedView';
import { AboutView } from './components/AboutView';
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
      if (s.kind === 'compare' || s.kind === 'glossary' || s.kind === 'saved' || s.kind === 'about') return s;
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
  const [lastModuleId, setLastModuleId] = useState<string>(() =>
    selection.kind === 'module' ? selection.id : MODULES[0]!.id,
  );
  const [loadNonce, setLoadNonce] = useState(0);
  const { tax, setEnabled: setTaxEnabled, setField: setTaxField } = useTaxSettings();
  const { scenarios, save, rename, remove } = useSavedScenarios();

  useEffect(() => {
    try {
      localStorage.setItem(SELECTION_KEY, JSON.stringify(selection));
    } catch {
      /* ignore */
    }
    if (selection.kind === 'module') setLastModuleId(selection.id);
  }, [selection]);

  // Top-level menu: "Model" returns to the last-viewed module; the rest are their own views.
  const onMenu = (item: MenuItem) => {
    switch (item) {
      case 'model':
        setSelection({ kind: 'module', id: lastModuleId });
        break;
      case 'compare':
        setSelection({ kind: 'compare' });
        break;
      case 'saved':
        setSelection({ kind: 'saved' });
        break;
      case 'glossary':
        setSelection({ kind: 'glossary' });
        break;
      case 'about':
        setSelection({ kind: 'about' });
        break;
    }
  };
  const activeMenu: MenuItem = selection.kind === 'module' ? 'model' : selection.kind;

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

  const showAssumptions = selection.kind === 'module' || selection.kind === 'compare';

  return (
    <div className="flex h-full flex-col">
      <header className="no-print flex items-center justify-between gap-4 border-b border-stone-200 bg-white px-5 py-2.5">
        <div className="flex items-center gap-5">
          <span className="text-xl font-bold tracking-tight text-accent-700">Quoin</span>
          <MenuBar active={activeMenu} onSelect={onMenu} savedCount={scenarios.length} />
        </div>
        <span className="hidden rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-500 sm:inline">
          v2 · {MODULES.length} modules
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {selection.kind === 'module' && (
          <aside className="no-print w-64 shrink-0 border-r border-stone-200 bg-stone-100">
            <TabNav selection={selection} onSelect={setSelection} />
          </aside>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-4 p-5">
            {showAssumptions && <AssumptionsPanel />}
            {selection.kind === 'compare' ? (
              <ComparisonView tax={tax} setTaxEnabled={setTaxEnabled} />
            ) : selection.kind === 'glossary' ? (
              <GlossaryView />
            ) : selection.kind === 'saved' ? (
              <SavedView scenarios={scenarios} onLoad={loadScenario} onRename={rename} onRemove={remove} />
            ) : selection.kind === 'about' ? (
              <AboutView />
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
