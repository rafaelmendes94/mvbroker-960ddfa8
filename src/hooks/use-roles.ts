import type { AppRole } from "@/lib/permissions";
import { useAuth } from "./useAuth";

export function useRoles() {
  const { roles, loading } = useAuth();
  return { roles, loading };
}
