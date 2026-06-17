import type { AppRole } from "@/lib/permissions";
import { useAuth } from "./use-auth";

export function useRoles() {
  const { roles, loading } = useAuth();
  return { roles, loading };
}
