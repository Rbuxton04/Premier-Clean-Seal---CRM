import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { isAiConfigured } from "@/lib/ai";
import { listTags } from "@/services/tag.service";
import { listTechnicians } from "@/services/job.service";
import { SearchApp } from "./search-app";

export const dynamic = "force-dynamic";

async function loadOptions() {
  try {
    const [tags, technicians] = await Promise.all([listTags(), listTechnicians()]);
    return { tags, technicians, dbOnline: true };
  } catch {
    return { tags: [] as Awaited<ReturnType<typeof listTags>>, technicians: [] as Awaited<ReturnType<typeof listTechnicians>>, dbOnline: false };
  }
}

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const { tags, technicians, dbOnline } = await loadOptions();
  const aiConfigured = isAiConfigured();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Search</h1>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
      </div>

      {!dbOnline && (
        <Badge variant="warning">
          Database not connected — set DATABASE_URL, then run: npx prisma migrate dev &amp;&amp; npm run db:seed
        </Badge>
      )}

      {dbOnline && (
        <SearchApp
          aiConfigured={aiConfigured}
          tags={tags.map((t) => t.name)}
          technicians={technicians.map((t) => t.name)}
          initialQuery={searchParams.q}
        />
      )}
    </div>
  );
}
