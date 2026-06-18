"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { runLegacyImport, submitManualEntry, type ImportPreview } from "@/actions/imports";
import { donor } from "@/config/donor.config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ImportClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  function buildFD(mode: "preview" | "commit") {
    const fd = new FormData();
    if (file) fd.set("file", file);
    fd.set("defaultYear", year);
    fd.set("mode", mode);
    return fd;
  }

  function doPreview() {
    if (!file) { toast.error("Selecciona un archivo .xlsx"); return; }
    startTransition(async () => {
      try {
        const res = await runLegacyImport(buildFD("preview"));
        if ("plan" in res) setPreview(res);
      } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    });
  }
  function doCommit() {
    startTransition(async () => {
      try {
        const res = await runLegacyImport(buildFD("commit"));
        if ("committed" in res) {
          toast.success(`Importado: ${res.counts.payments} pagos, ${res.counts.newDonors} donantes nuevos (${res.counts.skipped} omitidos)`);
          setPreview(null); setFile(null); router.refresh();
        }
      } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    });
  }

  return (
    <div className="space-y-10">
      {/* Subir archivo histórico */}
      <section className="rounded-2xl border border-border bg-card/70 p-6">
        <h2 className="font-display text-2xl font-black uppercase">Subir libro histórico (.xlsx)</h2>
        <p className="mt-1 text-sm text-muted-foreground">Plan de Apoyo Mensual. Las pestañas Pagos CAM / PayPal / STRIPE se importan automáticamente.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <Label htmlFor="file">Archivo</Label>
            <input id="file" type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground" />
          </div>
          <div>
            <Label htmlFor="year">Año (para Pagos CAM)</Label>
            <Input id="year" value={year} onChange={(e) => setYear(e.target.value)} className="w-28" inputMode="numeric" />
          </div>
          <Button onClick={doPreview} disabled={pending || !file}>Previsualizar</Button>
        </div>

        {preview && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Donantes nuevos" value={preview.plan.counts.newDonors} />
              <Tile label="Donantes existentes" value={preview.plan.counts.matchedDonors} />
              <Tile label="Pagos a insertar" value={preview.plan.counts.payments} />
              <Tile label="Pagos omitidos (ya existen)" value={preview.plan.counts.skipped} />
            </div>
            <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm">
              <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">Pestañas</p>
              <ul className="mt-2 space-y-1">
                {preview.tabs.map((t) => (
                  <li key={t.name} className={t.recognized ? "text-foreground" : "text-muted-foreground"}>
                    {t.recognized ? `✓ ${t.name} — ${t.rowsParsed} filas (${t.rowsSkipped} vacías)` : `– ${t.name} — no se importa (entrar a mano)`}
                  </li>
                ))}
              </ul>
            </div>
            {preview.plan.possibleDuplicates.length > 0 && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                <p className="font-display text-xs uppercase tracking-widest text-amber-500">Posibles duplicados ({preview.plan.possibleDuplicates.length})</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {preview.plan.possibleDuplicates.slice(0, 20).map((d, i) => <li key={i}>{d.name} — {d.reason}</li>)}
                </ul>
              </div>
            )}
            <Button onClick={doCommit} disabled={pending} size="lg">Confirmar e importar</Button>
          </div>
        )}
      </section>

      {/* Entrada manual */}
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
          <div><Label htmlFor="m-month">Mes (YYYY-MM) *</Label><Input id="m-month" name="periodMonth" required placeholder="2026-03" /></div>
          <div><Label htmlFor="m-gross">Monto bruto ($) *</Label><Input id="m-gross" name="gross" required inputMode="decimal" /></div>
          <div><Label htmlFor="m-fee">Comisión ($)</Label><Input id="m-fee" name="fee" defaultValue="0" inputMode="decimal" /></div>
          <div className="sm:col-span-2"><Button type="submit" disabled={pending}>Guardar donativo</Button></div>
        </form>
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 px-4 py-3">
      <p className="font-display text-3xl font-black text-primary tabular-nums">{value}</p>
      <p className="font-display text-[0.65rem] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
