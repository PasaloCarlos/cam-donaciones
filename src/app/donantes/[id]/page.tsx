import { notFound } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { getDonorDetail } from "@/actions/donors";
import { DonorDetail } from "@/components/donantes/donor-detail";

export const metadata = { title: "Donante — CAM Donaciones", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DonorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getDonorDetail(id);
  if (!detail) notFound();
  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <AdminNav />
        <DonorDetail detail={detail} />
      </div>
    </main>
  );
}
