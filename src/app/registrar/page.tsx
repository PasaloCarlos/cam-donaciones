import { AdminNav } from "@/components/admin/admin-nav";
import { ManualEntryForm } from "@/components/registrar/manual-entry-form";
import { QuickCashEntry } from "@/components/registrar/quick-cash-entry";

export const metadata = { title: "Registrar — CAM Donaciones", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function RegistrarPage() {
  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <AdminNav />
        <header className="mb-8">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Datos</p>
          <h1 className="mt-1 font-display text-4xl font-black uppercase sm:text-5xl">Registrar</h1>
        </header>
        <p className="mb-6 text-muted-foreground">
          Registra efectivo rápido con la sección de abajo, o usa &quot;Entrada detallada&quot; para
          donativos recurrentes, especiales y otros.
        </p>

        {/* Quick cash — primary section */}
        <QuickCashEntry />

        {/* Detailed manual form — collapsible */}
        <details className="mt-6 rounded-2xl border border-border">
          <summary className="cursor-pointer select-none rounded-2xl px-6 py-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
            Entrada detallada (recurrentes, especiales, otros)
          </summary>
          <div className="px-0 pb-0 pt-0">
            <ManualEntryForm />
          </div>
        </details>
      </div>
    </main>
  );
}
