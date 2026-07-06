export function ChartEmptyState({ message = "Not enough data yet." }: { message?: string }) {
  return <div className="flex h-56 items-center justify-center text-center text-sm text-muted-foreground">{message}</div>;
}
