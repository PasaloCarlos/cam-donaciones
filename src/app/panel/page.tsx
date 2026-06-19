import { AdminNav } from "@/components/admin/admin-nav";
import { getDonorDashboard, getTrends } from "@/actions/metrics";
import { Dashboard } from "@/components/panel/dashboard";
import { PanelCharts } from "@/components/panel/panel-charts";

export const metadata = { title: "Panel — CAM Donaciones", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const [stats, trends] = await Promise.all([getDonorDashboard(), getTrends()]);
  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <AdminNav />
        <header className="mb-8">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Plan de Apoyo Mensual</p>
          <h1 className="mt-1 font-display text-4xl font-black uppercase sm:text-5xl">Panel</h1>
        </header>
        <Dashboard stats={stats} />
        <section className="mt-10">
          <h2 className="mb-4 font-display text-2xl font-black uppercase">Gráficas</h2>
          <PanelCharts trends={trends} bySource={stats.bySource} byGoal={stats.byGoal} />
        </section>
      </div>
    </main>
  );
}
