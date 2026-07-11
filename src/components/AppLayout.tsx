import type { ReactNode } from "react";
import { useLocation } from "@/lib/router-shim";
import { BackButton } from "@/components/BackButton";

const HIDE_BACK_ON = new Set([
  "/",
  "/dashboard",
  "/login",
  "/auth",
  "/reset-password",
  "/confianca",
]);

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const pathname = (location as any)?.pathname ?? "/";
  const showBack = !HIDE_BACK_ON.has(pathname);

  return (
    <div className="min-h-screen bg-background">
      {showBack && (
        <div className="px-4 pt-3 sm:px-6">
          <BackButton />
        </div>
      )}
      {children}
    </div>
  );
}
