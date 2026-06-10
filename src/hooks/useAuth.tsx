import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "super_admin" | "admin_staff" | "broker" | "partner";

type ActionPerms = { view: boolean; create: boolean; edit: boolean; delete: boolean };
type StaffPermissions = Record<string, ActionPerms>;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  profile: { id: string; full_name: string; email: string | null; phone: string | null; avatar_url: string | null; agency_id: string | null; account_type: string } | null;
  subscription: {
    id: string;
    plan_id: string;
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    effective_owner: string | null;
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
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [subscription, setSubscription] = useState<AuthContextType["subscription"]>(null);
  const [staffPermissions, setStaffPermissions] = useState<StaffPermissions | null>(null);

  const fetchUserData = async (userId: string) => {
    const [rolesRes, profileRes, effSubRes, staffRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.rpc("get_effective_subscription", { _user_id: userId }),
      supabase.from("staff_permissions").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    setRoles(rolesRes.data ? rolesRes.data.map((r: any) => r.role as AppRole) : []);
    setProfile(profileRes.data ? profileRes.data as any : null);

    const effSub = Array.isArray(effSubRes.data) ? effSubRes.data[0] : null;
    if (effSub) {
      // Buscar dados do plano
      const { data: planData } = await supabase
        .from("plans")
        .select("name, modules, max_properties, max_brokers, is_free")
        .eq("id", (effSub as any).plan_id)
        .maybeSingle();

      setSubscription({
        id: (effSub as any).id,
        plan_id: (effSub as any).plan_id,
        status: (effSub as any).status,
        trial_ends_at: (effSub as any).trial_ends_at,
        current_period_end: (effSub as any).current_period_end,
        effective_owner: (effSub as any).effective_owner,
        plan: planData ? {
          name: (planData as any).name,
          modules: Array.isArray((planData as any).modules) ? (planData as any).modules : [],
          max_properties: (planData as any).max_properties,
          max_brokers: (planData as any).max_brokers,
          is_free: (planData as any).is_free,
        } : undefined,
      });
    } else {
      setSubscription(null);
    }
    setStaffPermissions(staffRes.data ? (staffRes.data as any).permissions || null : null);
  };

  const refreshUserData = async () => {
    const currentUserId = user?.id || session?.user?.id;
    if (currentUserId) {
      await fetchUserData(currentUserId);
    }
  };

  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setLoading(true);
          setTimeout(async () => {
            await fetchUserData(session.user.id);
            setLoading(false);
          }, 0);
        } else {
          setRoles([]);
          setProfile(null);
          setSubscription(null);
          setStaffPermissions(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => authSub.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isSuperAdmin = roles.includes("super_admin");
  const isAdminStaff = roles.includes("admin_staff");
  const isBroker = roles.includes("broker");
  const isPartner = roles.includes("partner");
  const isBlocked = subscription?.status === "blocked";

  const hasModuleAccess = (moduleKey: string, action: keyof ActionPerms = "view"): boolean => {
    if (isSuperAdmin) return true;
    if (!isAdminStaff || !staffPermissions) return false;
    const mod = staffPermissions[moduleKey];
    return mod ? mod[action] : false;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, roles, profile, subscription, staffPermissions, refreshUserData, signOut, isSuperAdmin, isAdminStaff, isBroker, isPartner, isBlocked, hasModuleAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
