import { BackLink } from "@/components/ui/BackLink";

export function PageHeader({
  title,
  subtitle,
  actions,
  backHref,
  backLabel,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-6">
      {backHref && backLabel ? <BackLink href={backHref} label={backLabel} className="mb-3" /> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
    </div>
  );
}
