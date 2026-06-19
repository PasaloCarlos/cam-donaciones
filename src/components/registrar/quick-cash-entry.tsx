"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { submitCashDonation } from "@/actions/imports";
import { donor } from "@/config/donor.config";
import { formatCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function QuickCashEntry() {
  const [pending, startTransition] = useTransition();
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [customRaw, setCustomRaw] = useState("");
  const [count, setCount] = useState(0);
  const [totalCents, setTotalCents] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);

  function selectPreset(dollars: number) {
    setAmountCents(dollars * 100);
    setCustomRaw("");
  }

  function handleCustomChange(val: string) {
    setCustomRaw(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setAmountCents(Math.round(parsed * 100));
    } else {
      setAmountCents(null);
    }
  }

  // A preset is "active" only when customRaw is empty and the preset matches
  function isPresetActive(dollars: number) {
    return customRaw === "" && amountCents === dollars * 100;
  }

  function handleSave() {
    if (!amountCents || amountCents <= 0) return;
    const captured = { amountCents: amountCents as number, name };

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", captured.name);
        fd.set("gross", String(captured.amountCents / 100));
        // periodMonth omitted → defaults to current month in the action
        await submitCashDonation(fd);
        toast.success(
          `Donativo de ${formatCents(captured.amountCents, donor.currency)} guardado`
        );
        setCount((c) => c + 1);
        setTotalCents((t) => t + captured.amountCents);
        setName("");
        setAmountCents(null);
        setCustomRaw("");
        nameRef.current?.focus();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  const canSave = !pending && amountCents !== null && amountCents > 0;

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-6">
      <h2 className="font-display text-2xl font-black uppercase">
        Donativo rápido (efectivo)
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Para registrar efectivo en el CAM. El nombre es opcional.
      </p>

      {/* Name (optional) */}
      <div className="mt-4">
        <Label htmlFor="qc-name">Nombre (opcional)</Label>
        <Input
          ref={nameRef}
          id="qc-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre (opcional)"
          autoComplete="off"
          className="mt-1"
        />
      </div>

      {/* Preset amount buttons */}
      <div className="mt-4">
        <Label>Monto</Label>
        <div className="mt-1 grid grid-cols-4 gap-2">
          {donor.onsite.presetAmounts.map((dollars) => (
            <button
              key={dollars}
              type="button"
              onClick={() => selectPreset(dollars)}
              className={cn(
                "h-14 rounded-lg border text-base font-bold transition-colors",
                isPresetActive(dollars)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary/40 text-foreground hover:border-primary/60"
              )}
            >
              {formatCents(dollars * 100, donor.currency)}
            </button>
          ))}
        </div>
      </div>

      {/* Custom amount */}
      <div className="mt-3">
        <Label htmlFor="qc-custom">Otro monto</Label>
        <Input
          id="qc-custom"
          name="custom"
          inputMode="decimal"
          placeholder="0.00"
          value={customRaw}
          onChange={(e) => handleCustomChange(e.target.value)}
          className="mt-1"
        />
      </div>

      {/* Save button */}
      <Button
        type="button"
        size="lg"
        className="mt-5 w-full"
        disabled={!canSave}
        onClick={handleSave}
      >
        {pending ? "Guardando…" : "Guardar donativo"}
      </Button>

      {/* Session total */}
      <p className="mt-4 text-sm text-muted-foreground">
        Esta sesión:{" "}
        <span className="font-semibold text-foreground">
          {count} donativo{count !== 1 ? "s" : ""}
        </span>{" "}
        ·{" "}
        <span className="font-semibold text-foreground">
          {formatCents(totalCents, donor.currency)}
        </span>
      </p>
    </section>
  );
}
