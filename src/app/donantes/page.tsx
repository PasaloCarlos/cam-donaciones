import { AdminNav } from "@/components/admin/admin-nav";
import { listDonors, type DonorStatus } from "@/actions/donors";
import { DonorTable } from "@/components/donantes/donor-table";

export const metadata = { title: "Donantes — CAM Donaciones", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const VALID_STATUSES: DonorStatus[] = ["active", "lapsed", "cancelled", "one_time_only"];

export default async function DonantesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  const validStatus = VALID_STATUSES.includes(status as DonorStatus) ? (status as DonorStatus) : undefined;
  const donors = await listDonors(q, validStatus);
  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <AdminNav />
        <header className="mb-8">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Base de datos</p>
          <h1 className="mt-1 font-display text-4xl font-black uppercase sm:text-5xl">Donantes</h1>
        </header>
        <DonorTable donors={donors} initialQuery={q ?? ""} activeStatus={validStatus} />
      </div>
    </main>
  );
}
