import type { ReactNode } from "react";

// Stub layout: the page renders directly inside the existing _authenticated layout.
export function AppLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
