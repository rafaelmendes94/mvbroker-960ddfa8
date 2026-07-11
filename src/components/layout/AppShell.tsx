import type { ReactNode } from "react";
import { useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";
import { BackButton } from "@/components/BackButton";
import { useLocation } from "@/lib/router-shim";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const HIDE_BACK_ON = new Set([
  "/",
  "/dashboard",
  "/login",
  "/auth",
  "/reset-password",
  "/confianca",
]);

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const pathname = (location as any)?.pathname ?? "/";
  const showBack = !HIDE_BACK_ON.has(pathname);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground sticky top-0 h-screen">
        <AppSidebar />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 bg-sidebar text-sidebar-foreground w-72 border-0">
          <AppSidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
