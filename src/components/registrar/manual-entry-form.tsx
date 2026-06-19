"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { submitManualEntry } from "@/actions/imports";
import { donor } from "@/config/donor.config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ManualEntryForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-6">
      <h2 className="font-display text-2xl font-black uppercase">Entrada manual</h2>
      <p className="mt-1 text-sm text-muted-foreground">Efectivo en el CAM o donativo especial (un solo pago).</p>
      <form
        action={(fd) => startTransition(async () => {
          try {
            const res = await submitManualEntry(fd);
            toast.success(`Guardado (${res.counts.payments} pago).`);
            (document.getElementById("manual-form") as HTMLFormElement)?.reset();
            router.refresh();
          } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
        })}
        id="manual-form"
        className="mt-4 grid gap-4 sm:grid-cols-2"
      >
        <div><Label htmlFor="m-name">Nombre *</Label><Input id="m-name" name="name" required /></div>
        <div><Label htmlFor="m-email">Email</Label><Input id="m-email" name="email" type="email" /></div>
        <div>
          <Label htmlFor="m-source">Fuente</Label>
          <select id="m-source" name="source" className="flex h-11 w-full rounded-lg border border-input bg-secondary/40 px-3.5 text-base">
            <option value="cam_cash">{donor.sources.cam_cash}</option>
            <option value="special">{donor.sources.special}</option>
            <option value="other">{donor.sources.other}</option>
          </select>
        </div>
        <div>
          <Label htmlFor="m-kind">Tipo</Label>
          <select id="m-kind" name="kind" className="flex h-11 w-full rounded-lg border border-input bg-secondary/40 px-3.5 text-base">
            <option value="recurring">Mensual (recurrente)</option>
            <option value="one_time">Único</option>
          </select>
        </div>
        <div>
          <Label htmlFor="m-goal">Objetivo</Label>
          <select id="m-goal" name="goal" className="flex h-11 w-full rounded-lg border border-input bg-secondary/40 px-3.5 text-base">
            <option value="">—</option>
            <option value="operacion_general">{donor.goals.operacion_general}</option>
            <option value="compras_solidarias">{donor.goals.compras_solidarias}</option>
          </select>
        </div>
        <div>
          <Label htmlFor="m-month">Mes *</Label>
          <input id="m-month" name="periodMonth" type="month" required className="flex h-11 w-full rounded-lg border border-input bg-secondary/40 px-3.5 text-base" />
        </div>
        <div><Label htmlFor="m-gross">Monto bruto ($) *</Label><Input id="m-gross" name="gross" required inputMode="decimal" /></div>
        <div><Label htmlFor="m-fee">Comisión ($)</Label><Input id="m-fee" name="fee" defaultValue="0" inputMode="decimal" /></div>
        <div className="sm:col-span-2"><Button type="submit" disabled={pending} className="w-full sm:w-auto">Guardar donativo</Button></div>
      </form>
    </section>
  );
}
