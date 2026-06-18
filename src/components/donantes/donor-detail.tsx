import Link from "next/link";
import { donor as cfg } from "@/config/donor.config";
import { formatCents } from "@/lib/money";
import type { DonorDetail as Detail } from "@/actions/donors";
import { consolidateSubscriptions, type SubscriptionGroup } from "@/lib/subscriptions";

const SRC = cfg.sources as Record<string, string>;
const GOAL = cfg.goals as Record<string, string>;

export function DonorDetail({ detail }: { detail: Detail }) {
  const { donor, pledges, timeline } = detail;
  return (
    <div className="space-y-8">
      <Link href="/donantes" className="text-sm text-muted-foreground hover:text-foreground">← Donantes</Link>
      <header>
        <h1 className="font-display text-4xl font-black uppercase">{donor.display_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {donor.email_normalized ?? "sin email"}{donor.phone_normalized ? ` · ${donor.phone_normalized}` : ""}
          {donor.address ? ` · ${donor.address}` : ""}
        </p>
      </header>

      {/* ── Suscripciones ─────────────────────────────────────── */}
      {(() => {
        const groups: SubscriptionGroup[] = consolidateSubscriptions(pledges);
        if (groups.length === 0) return null;
        const STATUS_ES: Record<string, string> = { active: "Activa", cancelled: "Cancelada", paused: "Pausada" };
        const yearSpan = (g: SubscriptionGroup) => {
          if (g.firstYear == null) return null;
          return g.firstYear === g.lastYear ? String(g.firstYear) : `${g.firstYear}–${g.lastYear}`;
        };
        return (
          <section>
            <h2 className="mb-3 font-display text-xs uppercase tracking-widest text-muted-foreground">
              Suscripciones ({groups.length})
            </h2>
            <div className="space-y-2">
              {groups.map((g) => (
                <div key={g.source} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm">
                  <span className="font-medium text-foreground">{SRC[g.source] ?? g.source}</span>
                  <span className="text-muted-foreground">
                    {yearSpan(g) ? `${yearSpan(g)} · ` : ""}{STATUS_ES[g.status] ?? g.status}
                    {g.goal ? ` · ${GOAL[g.goal] ?? g.goal}` : ""}
                  </span>
                  <span className="tabular-nums text-foreground">
                    {g.monthlyNetCents != null ? `${formatCents(g.monthlyNetCents, cfg.currency)}/mes` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* ── Donativos especiales ────────────────────────────────── */}
      {(() => {
        const oneTime = pledges.filter((p) => p.kind === "one_time");
        if (oneTime.length === 0) return null;
        return (
          <section>
            <h2 className="mb-3 font-display text-xs uppercase tracking-widest text-muted-foreground">
              Donativos especiales ({oneTime.length})
            </h2>
            <div className="space-y-2">
              {oneTime.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm">
                  <span className="font-medium text-foreground">{SRC[p.source] ?? p.source}</span>
                  <span className="text-muted-foreground">{p.goal ? (GOAL[p.goal] ?? p.goal) : "sin objetivo"}</span>
                  <span className="tabular-nums text-foreground">
                    {p.monthly_net_cents != null ? `${formatCents(p.monthly_net_cents, cfg.currency)}` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      <section>
        <h2 className="mb-3 font-display text-xs uppercase tracking-widest text-muted-foreground">Historial de pagos ({timeline.length})</h2>
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left font-display text-xs uppercase tracking-widest text-muted-foreground">
              <tr><th className="px-4 py-3">Mes</th><th className="px-3 py-3">Fuente</th><th className="px-3 py-3">Objetivo</th><th className="px-3 py-3 text-right">Neto</th></tr>
            </thead>
            <tbody>
              {timeline.map((e, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-3 tabular-nums">{e.periodMonth.slice(0, 7)}</td>
                  <td className="px-3 py-3">{SRC[e.source] ?? e.source}</td>
                  <td className="px-3 py-3 text-muted-foreground">{e.goal ? (GOAL[e.goal] ?? e.goal) : "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatCents(e.netCents, cfg.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>
    </div>
  );
}
