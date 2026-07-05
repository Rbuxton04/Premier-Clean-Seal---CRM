import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listTags } from "@/services/tag.service";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Badge } from "@/components/ui/badge";
import { TagManager } from "./tag-manager";

export const dynamic = "force-dynamic";

export default async function TagsSettingsPage() {
  try {
    const tags = await listTags();
    return (
      <div className="space-y-6">
        <div>
          <Link href="/settings" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to settings
          </Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Client tags</h1>
          <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
          <p className="mt-2 text-sm text-muted-foreground">
            Organise clients into groups like Contractor or Domestic. A client can carry several tags,
            and you can filter the customer list by them.
          </p>
        </div>
        <TagManager tags={tags as any} />
      </div>
    );
  } catch {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Client tags</h1>
        <Badge variant="warning">Database not connected.</Badge>
      </div>
    );
  }
}
