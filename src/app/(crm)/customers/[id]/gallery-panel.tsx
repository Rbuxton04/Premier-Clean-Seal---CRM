import Link from "next/link";
import { Images } from "lucide-react";
import type { AlbumSummary } from "@/services/media.service";

export function CustomerGalleryPanel({ albums }: { albums: AlbumSummary[] }) {
  if (albums.length === 0) {
    return <p className="text-sm text-muted-foreground">No completed job photos yet.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {albums.map((a) => (
        <Link key={a.jobId} href={`/gallery/${a.jobId}`} className="group overflow-hidden rounded-lg border hover:shadow-md">
          <div className="aspect-video w-full overflow-hidden bg-muted">
            {a.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.coverUrl} alt={a.jobNumber} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Images className="h-6 w-6" />
              </div>
            )}
          </div>
          <div className="p-2.5">
            <p className="text-sm font-medium">{a.jobNumber}</p>
            <p className="text-xs text-muted-foreground">
              {a.photoCount} photo{a.photoCount === 1 ? "" : "s"}
              {a.completedAt ? ` · ${new Date(a.completedAt).toLocaleDateString("en-GB")}` : ""}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
