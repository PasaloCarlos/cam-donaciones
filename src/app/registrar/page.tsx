import { AdminNav } from "@/components/admin/admin-nav";
import { ManualEntryForm } from "@/components/registrar/manual-entry-form";

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
        <p className="mb-6 text-muted-foreground">Registra un donativo en efectivo (CAM) o un donativo especial.</p>
        <ManualEntryForm />
      </div>
    </main>
  );
}
