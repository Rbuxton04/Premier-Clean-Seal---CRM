import Link from "next/link";
import { ImageOff, Images } from "lucide-react";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { listAlbums } from "@/services/media.service";
import { isR2Configured } from "@/lib/storage/r2";
import type { AlbumSummary } from "@/services/media.service";

export const dynamic = "force-dynamic";

async function loadAlbums(customerId?: string, query?: string) {
  try {
    return { albums: await listAlbums(customerId, query), dbOnline: true };
  } catch {
    return { albums: [] as AlbumSummary[], dbOnline: false };
  }
}

export default async function GalleryPage({ searchParams }: { searchParams: { q?: string; customerId?: string } }) {
  const { albums, dbOnline } = await loadAlbums(searchParams.customerId, searchParams.q);
  const r2Ready = isR2Configured();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Gallery</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>

      {!dbOnline && (
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed
        </Badge>
      )}

      {dbOnline && (
        <>
          {!r2Ready && (
            <Badge variant="warning">
              Cloudflare storage isn&apos;t connected yet — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
              R2_BUCKET so completion photos are saved and appear here. Sample placeholders are shown below in the
              meantime.
            </Badge>
          )}

          <form className="max-w-sm">
            <Input name="q" defaultValue={searchParams.q} placeholder="Search by job number or customer…" />
          </form>

          {albums.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ImageOff className="h-4 w-4" /> No photo albums yet — these appear once a job is completed with photos.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {albums.map((a) => (
                <Link key={a.jobId} href={`/gallery/${a.jobId}`} className="group overflow-hidden rounded-lg border hover:shadow-md">
                  <div className="aspect-video w-full overflow-hidden bg-muted">
                    {a.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.coverUrl} alt={a.jobNumber} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Images className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 p-3">
                    <p className="text-sm font-medium">
                      {a.jobNumber} — {a.customer.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.property?.postcode ?? ""}
                      {a.completedAt ? ` · ${new Date(a.completedAt).toLocaleDateString("en-GB")}` : ""} · {a.photoCount} photo
                      {a.photoCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
