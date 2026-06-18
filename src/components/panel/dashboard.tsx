import { donor } from "@/config/donor.config";
import { formatCents } from "@/lib/money";
import type { DonorDashboard } from "@/lib/donor-dashboard";

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 px-5 py-4">
      <p className="font-display text-4xl font-black text-primary tabular-nums">{value}</p>
      <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

const SRC = donor.sources as Record<string, string>;
const GOAL = donor.goals as Record<string, string>;
const money = (c: number) => formatCents(c, donor.currency);

export function Dashboard({ stats }: { stats: DonorDashboard }) {
  const { mrr, donorCounts, totalRaisedCents, ytdRaisedCents, bySource, byGoal } = stats;
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Recaudo mensual (MRR neto)" value={money(mrr.netCents)} />
        <Tile label="Donantes activos" value={donorCounts.active} />
        <Tile label="Inactivos" value={donorCounts.lapsed} />
        <Tile label="Cancelados" value={donorCounts.cancelled} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Donativos únicos" value={donorCounts.one_time_only} />
        <Tile label="Total donantes" value={donorCounts.total} />
        <Tile label="Recaudado (total)" value={money(totalRaisedCents)} />
        <Tile label="Recaudado (año)" value={money(ytdRaisedCents)} />
      </div>

      <Breakdown title="Por fuente" rows={Object.entries(bySource).map(([k, v]) => ({ label: SRC[k] ?? k, ...v }))} />
      <Breakdown title="Por objetivo" rows={Object.entries(byGoal).map(([k, v]) => ({ label: GOAL[k] ?? (k === "sin_objetivo" ? "Sin objetivo" : k), ...v }))} />
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; grossCents: number; netCents: number; count: number }[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary/40 text-left font-display text-xs uppercase tracking-widest text-muted-foreground">
          <tr><th className="px-4 py-3">{title}</th><th className="px-3 py-3 text-right"># pagos</th><th className="px-3 py-3 text-right">Neto</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Sin datos todavía.</td></tr>
          ) : rows.map((r) => (
            <tr key={r.label} className="border-t border-border">
              <td className="px-4 py-3 text-foreground">{r.label}</td>
              <td className="px-3 py-3 text-right tabular-nums">{r.count}</td>
              <td className="px-3 py-3 text-right tabular-nums">{formatCents(r.netCents, donor.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
