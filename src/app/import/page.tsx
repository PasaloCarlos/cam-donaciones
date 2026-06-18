import { AdminNav } from "@/components/admin/admin-nav";
import { ImportClient } from "@/components/import/import-client";

export const metadata = { title: "Importar — CAM Donaciones", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <AdminNav />
        <header className="mb-8">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Datos</p>
          <h1 className="mt-1 font-display text-5xl font-black uppercase">Importar</h1>
        </header>
        <ImportClient />
      </div>
    </main>
  );
}
