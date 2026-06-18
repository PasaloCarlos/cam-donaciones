import { AdminNav } from "@/components/admin/admin-nav";
import { getDonorDashboard } from "@/actions/metrics";
import { Dashboard } from "@/components/panel/dashboard";

export const metadata = { title: "Panel — CAM Donaciones", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const stats = await getDonorDashboard();
  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <AdminNav />
        <header className="mb-8">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Plan de Apoyo Mensual</p>
          <h1 className="mt-1 font-display text-5xl font-black uppercase">Panel</h1>
        </header>
        <Dashboard stats={stats} />
      </div>
    </main>
  );
}
