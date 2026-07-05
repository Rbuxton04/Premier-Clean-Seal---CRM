import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, FileText } from "lucide-react";
import { getEnquiry, findMatchingCustomers, listAssigneeOptions } from "@/services/enquiry.service";
import { listProductOptions } from "@/services/property.service";
import { getPendingAnalysisTask } from "@/services/ai.service";
import { isAiConfigured } from "@/lib/ai";
import { isR2Configured } from "@/lib/storage/r2";
import { BrandSwoosh } from "@/components/shell/brand-swoosh";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { workTypeLabels, contactMethodLabels, priorityLabels, enquiryStageLabels } from "@/validators/enquiry";
import { propertyTypeLabels } from "@/validators/customer";
import { MediaLightbox } from "./media-lightbox";
import { EnquiryFieldsForm } from "./enquiry-fields-form";
import { AiAnalysisPanel } from "./ai-analysis-panel";
import type { Findings } from "@/lib/ai/provider";
import { linkToCustomerAction, createCustomerFromEnquiryAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EnquiryDetailPage({ params }: { params: { id: string } }) {
  const enquiry = await getEnquiry(params.id);
  if (!enquiry) notFound();

  const [assignees, matchingCustomers, products, pendingTask] = await Promise.all([
    listAssigneeOptions(),
    enquiry.customerId ? Promise.resolve([]) : findMatchingCustomers(enquiry.email, enquiry.phone),
    listProductOptions(),
    getPendingAnalysisTask(enquiry.id),
  ]);
  const aiConfigured = isAiConfigured();
  const photosAvailable = isR2Configured();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/enquiries" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to enquiries
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{enquiry.name}</h1>
          <Badge variant="secondary">{enquiryStageLabels[enquiry.stage as keyof typeof enquiryStageLabels]}</Badge>
          <Badge variant="outline">{priorityLabels[enquiry.priority as keyof typeof priorityLabels]} priority</Badge>
        </div>
        <BrandSwoosh className="mt-1 h-2 w-40 text-brand-plum" />
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{enquiry.email}</span>
          <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{enquiry.phone}</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{enquiry.addressText}, {enquiry.postcode}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Submission details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Company</p>
                  <p className="text-sm">{enquiry.company || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Property type</p>
                  <p className="text-sm">{propertyTypeLabels[enquiry.propertyType as keyof typeof propertyTypeLabels]}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Preferred contact</p>
                  <p className="text-sm">{contactMethodLabels[enquiry.preferredContact as keyof typeof contactMethodLabels]}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Preferred date</p>
                  <p className="text-sm">{enquiry.preferredDate ? new Date(enquiry.preferredDate).toLocaleDateString("en-GB") : "No preference"}</p>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Type of work</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {enquiry.workTypes.map((w) => (
                    <Badge key={w} variant="secondary">{workTypeLabels[w as keyof typeof workTypeLabels] ?? w}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p>
                <p className="whitespace-pre-wrap text-sm">{enquiry.description}</p>
              </div>

              <Badge variant={enquiry.consentGiven ? "success" : "warning"}>
                {enquiry.consentGiven ? "Consent given" : "Consent not recorded"}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Photos &amp; videos</CardTitle></CardHeader>
            <CardContent>
              <MediaLightbox files={enquiry.files} />
            </CardContent>
          </Card>

          <AiAnalysisPanel
            enquiryId={enquiry.id}
            analysis={
              enquiry.aiAnalysis
                ? {
                    ...enquiry.aiAnalysis,
                    findings: enquiry.aiAnalysis.findings as Findings,
                    suggestedProducts: enquiry.aiAnalysis.suggestedProducts as Array<{ label: string }>,
                  }
                : null
            }
            pendingTask={pendingTask}
            configured={aiConfigured}
            photosAvailable={photosAvailable}
            hasPhotos={enquiry.files.some((f) => f.kind === "PHOTO")}
            products={products}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Manage</CardTitle></CardHeader>
            <CardContent>
              <EnquiryFieldsForm
                enquiryId={enquiry.id}
                stage={enquiry.stage}
                priority={enquiry.priority}
                assignedToId={enquiry.assignedToId}
                estimatedValue={enquiry.estimatedValue}
                assignees={assignees}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {enquiry.customer ? (
                <div>
                  <p className="text-sm">Linked to</p>
                  <Link href={`/customers/${enquiry.customer.id}`} className="font-medium text-primary hover:underline">
                    {enquiry.customer.name}
                  </Link>
                </div>
              ) : (
                <>
                  {matchingCustomers.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Possible existing customer{matchingCustomers.length > 1 ? "s" : ""}:</p>
                      {matchingCustomers.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{c.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{c.email ?? c.phone}</p>
                          </div>
                          <form action={linkToCustomerAction.bind(null, enquiry.id, c.id)}>
                            <Button type="submit" size="sm" variant="outline">Link</Button>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                  <form action={createCustomerFromEnquiryAction.bind(null, enquiry.id)}>
                    <Button type="submit" size="sm" className="w-full">
                      {matchingCustomers.length > 0 ? "Create new customer instead" : "Convert to customer"}
                    </Button>
                  </form>
                </>
              )}
            </CardContent>
          </Card>

          {!enquiry.aiAnalysis && (
            <Card className="opacity-70">
              <CardHeader><CardTitle className="text-base">Quote</CardTitle></CardHeader>
              <CardContent>
                <Button type="button" disabled className="w-full">
                  <FileText className="h-4 w-4" /> Create quote — available in Milestone 4
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
