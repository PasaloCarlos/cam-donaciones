"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DonorListItem, DonorStatus } from "@/actions/donors";

const STATUS: Record<DonorStatus, { label: string; variant: "confirmed" | "pending" | "cancelled" | "paid" }> = {
  active: { label: "Activo", variant: "confirmed" },
  lapsed: { label: "Inactivo", variant: "pending" },
  cancelled: { label: "Cancelado", variant: "cancelled" },
  one_time_only: { label: "Único", variant: "paid" },
};

export function DonorTable({ donors, initialQuery }: { donors: DonorListItem[]; initialQuery: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  return (
    <div className="space-y-5">
      <form onSubmit={(e) => { e.preventDefault(); router.push(`/donantes?q=${encodeURIComponent(q)}`); }} className="flex gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o email" />
        <Button type="submit">Buscar</Button>
      </form>
      {donors.length === 0 ? (
        <p className="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">No hay donantes en esta vista.</p>
      ) : (
        <>
          {/* Mobile: stacked tap-friendly cards */}
          <div className="space-y-2 sm:hidden">
            {donors.map((d) => (
              <Link
                key={d.id}
                href={`/donantes/${d.id}`}
                className="flex min-h-[4rem] items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{d.display_name}</p>
                  {d.email_normalized && (
                    <p className="truncate text-xs text-muted-foreground">{d.email_normalized}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={STATUS[d.status].variant}>{STATUS[d.status].label}</Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">{d.subscriptionCount} suscripciones</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border sm:block">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-left font-display text-xs uppercase tracking-widest text-muted-foreground">
                <tr><th className="px-4 py-3">Donante</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3 text-right">Suscripciones</th></tr>
              </thead>
              <tbody>
                {donors.map((d) => (
                  <tr key={d.id} className="border-t border-border hover:bg-secondary/20">
                    <td className="px-4 py-3">
                      <Link href={`/donantes/${d.id}`} className="font-medium text-foreground hover:text-primary">{d.display_name}</Link>
                      {d.email_normalized && <span className="block text-xs text-muted-foreground">{d.email_normalized}</span>}
                    </td>
                    <td className="px-3 py-3"><Badge variant={STATUS[d.status].variant}>{STATUS[d.status].label}</Badge></td>
                    <td className="px-3 py-3 text-right tabular-nums">{d.subscriptionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
