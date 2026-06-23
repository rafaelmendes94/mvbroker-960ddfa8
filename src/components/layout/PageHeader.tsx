import type { ReactNode } from "react";

export function PageHeader({
  title, description, actions,
}: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-end gap-4 mb-8 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground truncate">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-3xl leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="shrink-0 flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>}
    </div>
  );
}
