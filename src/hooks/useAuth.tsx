import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "super_admin" | "secretaria" | "imobiliaria" | "corretor_autonomo";
type ActionPerms = { view: boolean; create: boolean; edit: boolean; delete: boolean };
type StaffPermissions = Record<string, ActionPerms>;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  profile: any | null;
  subscription: {
    id: string;
    plan_id: string;
    status: string;
    plan?: { name: string; modules: string[]; max_properties: number; max_brokers: number; is_free: boolean };
  } | null;
  staffPermissions: StaffPermissions | null;
  refreshUserData: () => Promise<void>;
  signOut: () => Promise<void>;
  isSuperAdmin: boolean;
  isAdminStaff: boolean;
  isBroker: boolean;
  isPartner: boolean;
  isBlocked: boolean;
  hasModuleAccess: (moduleKey: string, action?: keyof ActionPerms) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<any>(null);

  const fetchUserData = async (userId: string) => {
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    ]);
    setRoles(rolesRes.data ? rolesRes.data.map((r: any) => r.role as AppRole) : []);
    setProfile(profileRes.data || null);
  };

  const refreshUserData = async () => {
    const id = user?.id || session?.user?.id;
    if (id) await fetchUserData(id);
  };

  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setLoading(true);
        setTimeout(async () => { await fetchUserData(s.user!.id); setLoading(false); }, 0);
      } else {
        setRoles([]); setProfile(null); setLoading(false);
      }
    });
    return () => authSub.unsubscribe();
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };

  const isSuperAdmin = roles.includes("super_admin");
  const isAdminStaff = roles.includes("secretaria");
  const isBroker = roles.includes("corretor_autonomo");
  const isPartner = false;

  return (
    <AuthContext.Provider value={{
      user, session, loading, roles, profile,
      subscription: null,
      staffPermissions: null,
      refreshUserData, signOut,
      isSuperAdmin, isAdminStaff, isBroker, isPartner,
      isBlocked: false,
      hasModuleAccess: () => true,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Allow use outside provider (fallback) so copied components don't crash
    return {
      user: null, session: null, loading: false, roles: [], profile: null,
      subscription: null, staffPermissions: null,
      refreshUserData: async () => {}, signOut: async () => {},
      isSuperAdmin: false, isAdminStaff: false, isBroker: false, isPartner: false,
      isBlocked: false, hasModuleAccess: () => true,
    } as AuthContextType;
  }
  return ctx;
}
