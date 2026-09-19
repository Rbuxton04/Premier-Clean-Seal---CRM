import { notFound } from "next/navigation";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { getCertification } from "@/services/certification.service";
import { listUsers } from "@/services/user.service";
import { isSupabaseStorageConfigured } from "@/lib/storage/supabase";
import { CertificationForm } from "../../certification-form";

export const dynamic = "force-dynamic";

export default async function EditCertificationPage({ params }: { params: { id: string } }) {
  const certification = await getCertification(params.id);
  if (!certification) notFound();
  const staff = await listUsers();

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Edit certification</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>
      <CertificationForm certification={certification} staff={staff.map((s) => ({ id: s.id, name: s.name }))} storageReady={isSupabaseStorageConfigured()} />
    </div>
  );
}
