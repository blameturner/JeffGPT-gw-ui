import { HomeTab as OverviewLegacy } from '../legacy/HomeTabLegacy';

export function OverviewSection() {
  return (
    <section className="border-b border-border p-6">
      <h2 className="mb-3 font-display text-lg tracking-tightest">Overview</h2>
      <OverviewLegacy />
    </section>
  );
}

