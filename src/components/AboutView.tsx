import { MODULES } from '../modules';
import { Card } from './ui';

export function AboutView() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-stone-800">About Quoin</h2>
        <p className="text-sm text-stone-500">What the name means, and what this page does.</p>
      </div>

      <Card title="The name">
        <p className="text-sm leading-relaxed text-stone-600">
          A <strong className="font-semibold text-stone-700">quoin</strong> (pronounced{' '}
          <em>“coin”</em>) is the dressed cornerstone that squares and strengthens the corner of a
          wall — the load-bearing block the rest of the structure is built around and trusts. This
          tool aims to be that for an investment decision: <strong className="font-semibold text-stone-700">honest,
          tested math you can lean on</strong> when you're about to commit real capital.
        </p>
      </Card>

      <Card title="What it does">
        <p className="text-sm leading-relaxed text-stone-600">
          Quoin lets you model many <em>kinds</em> of real-estate deals — not just rental houses — on
          the same footing. Pick an investment type, tune its parameters, and read output metrics that
          let you evaluate and compare deals side by side. Each type also carries written{' '}
          <strong className="font-semibold text-stone-700">strategy, risks, and opportunities</strong>,
          plus a regulatory callout where it matters. It runs entirely in your browser — nothing you
          enter leaves your machine.
        </p>
      </Card>

      <Card title="The menu">
        <dl className="space-y-2.5 text-sm text-stone-600">
          <Item term="Model" desc="Analyze one deal at a time — choose a type from the left, tune the inputs, and read its metrics, multi-year projection, and narrative." />
          <Item term="Compare" desc="Put 2–4 deals side by side on the shared core metric set, with the best value in each row highlighted." />
          <Item term="Saved" desc="Your library of deals under consideration — save a tuned deal under a name, then load, rename, or delete it later." />
          <Item term="Glossary" desc="Every acronym and term (NOI, DSCR, IRR, cap rate, ADR, recapture…) defined the way the app uses it." />
        </dl>
      </Card>

      <Card title="Under the hood">
        <ul className="space-y-1.5 text-sm text-stone-600">
          <Bullet>
            <strong className="font-semibold text-stone-700">{MODULES.length} investment types</strong> across
            eight categories — land, residential, commercial, hospitality, paper &amp; passive,
            value-add, infrastructure, and novel remote-sensing theses.
          </Bullet>
          <Bullet>A shared, unit-tested finance engine — amortization, IRR, NPV, cap rate, cash-on-cash, DSCR.</Bullet>
          <Bullet>An optional <strong className="font-semibold text-stone-700">after-tax</strong> layer (depreciation, recapture, and capital-gains at sale).</Bullet>
          <Bullet><strong className="font-semibold text-stone-700">Sensitivity analysis</strong> — a tornado chart and a two-way grid showing what moves each result.</Bullet>
          <Bullet>Export to <strong className="font-semibold text-stone-700">.xlsx</strong> and <strong className="font-semibold text-stone-700">.pdf</strong>, and shareable scenario links.</Bullet>
        </ul>
      </Card>

      <Card title="Honest by design">
        <p className="text-sm leading-relaxed text-stone-600">
          Numbers are <strong className="font-semibold text-stone-700">pre-tax by default</strong> and
          assumption-driven — <em>not forecasts</em>. Defaults are deliberately realistic rather than
          flattering, so many deals show thin or negative pre-tax cash flow: that's the truth the tool
          is meant to surface, not a bug. Inputs marked <span className="rounded bg-amber-100 px-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">verify</span>{' '}
          move results the most and are not authoritative here — confirm them against a primary source.
          Quoin is an analysis aid, <strong className="font-semibold text-stone-700">not financial or tax advice</strong>.
        </p>
      </Card>
    </div>
  );
}

function Item({ term, desc }: { term: string; desc: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-24 shrink-0 font-semibold text-stone-700">{term}</dt>
      <dd className="flex-1">{desc}</dd>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="mt-1 text-accent-500">
        ▪
      </span>
      <span>{children}</span>
    </li>
  );
}
