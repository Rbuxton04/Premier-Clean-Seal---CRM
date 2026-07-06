import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { getAlbum } from "@/services/media.service";
import { AlbumGallery } from "./album-gallery";

export const dynamic = "force-dynamic";

export default async function AlbumPage({ params }: { params: { jobId: string } }) {
  const album = await getAlbum(params.jobId);
  if (!album) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/gallery" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to gallery
        </Link>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{album.jobNumber}</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        <p className="mt-2 text-sm text-muted-foreground">
          <Link href={`/customers/${album.customer.id}`} className="text-primary hover:underline">
            {album.customer.name}
          </Link>
          {album.property ? ` — ${album.property.addressLine1}, ${album.property.postcode}` : ""}
          {album.completedAt ? ` · Completed ${new Date(album.completedAt).toLocaleDateString("en-GB")}` : ""}
        </p>
      </div>

      {album.photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos for this job yet.</p>
      ) : (
        <AlbumGallery jobId={album.jobId} photos={album.photos} />
      )}
    </div>
  );
}
