import { FileText, Home, UserPlus, Wrench, Mail, CheckCircle2, Circle } from "lucide-react";

const iconFor: Record<string, typeof Circle> = {
  CUSTOMER_CREATED: UserPlus,
  PROPERTY_ADDED: Home,
  QUOTE_SENT: FileText,
  QUOTE_APPROVED: CheckCircle2,
  JOB_BOOKED: Wrench,
  WORK_COMPLETED: CheckCircle2,
  REMINDER_SENT: Mail,
};

export function Timeline({ events }: { events: { id: string; type: string; title: string; createdAt: Date }[] }) {
  if (events.length === 0)
    return <p className="text-sm text-muted-foreground">No activity yet. Events appear here as this customer moves through the lifecycle.</p>;

  return (
    <ol className="relative space-y-5 border-l border-border pl-6">
      {events.map((e) => {
        const Icon = iconFor[e.type] ?? Circle;
        return (
          <li key={e.id} className="relative">
            <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full bg-accent text-primary">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm font-medium">{e.title}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(e.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
