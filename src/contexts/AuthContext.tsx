import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const ORG_STORAGE_KEY = "buddy_current_org_id";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
  subscription_tier: string;
  subscription_status: string;
}

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  subscription_tier: string;
  posts_quota_monthly: number;
  posts_used_this_month: number;
  userRole: "owner" | "admin" | "member";
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  // Organizations
  currentOrg: Organization | null;
  organizations: Organization[];
  switchOrg: (orgId: string) => void;
  createOrg: (name: string) => Promise<Organization>;
  refreshOrgs: () => Promise<void>;
  leaveOrg: (orgId: string) => Promise<void>;
  // Auth
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, display_name, role, subscription_tier, subscription_status")
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return data as Profile;
}

async function fetchOrganizations(userId: string): Promise<Organization[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select(`
      role,
      accepted_at,
      organizations (
        id, name, owner_id, subscription_tier,
        posts_quota_monthly, posts_used_this_month
      )
    `)
    .eq("user_id", userId)
    .not("accepted_at", "is", null);

  if (error || !data) return [];

  return data
    .filter((m: any) => m.organizations)
    .map((m: any) => ({
      ...(m.organizations as any),
      userRole: m.role as "owner" | "admin" | "member",
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);

  const resolveCurrentOrg = useCallback((orgs: Organization[]) => {
    if (orgs.length === 0) {
      setCurrentOrg(null);
      return;
    }
    const savedId = localStorage.getItem(ORG_STORAGE_KEY);
    const found = savedId ? orgs.find(o => o.id === savedId) : null;
    setCurrentOrg(found ?? orgs[0]);
  }, []);

  const loadUserData = useCallback(async (userId: string) => {
    const [p, orgs] = await Promise.all([
      fetchProfile(userId),
      fetchOrganizations(userId),
    ]);
    setProfile(p);
    setOrganizations(orgs);
    resolveCurrentOrg(orgs);
  }, [resolveCurrentOrg]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Defer to avoid Supabase deadlock on auth state change
        setTimeout(() => loadUserData(session.user.id), 0);
      } else {
        setProfile(null);
        setOrganizations([]);
        setCurrentOrg(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  // ── Organization actions ────────────────────────────────────────────────────

  const switchOrg = useCallback((orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
      localStorage.setItem(ORG_STORAGE_KEY, orgId);
    }
  }, [organizations]);

  const refreshOrgs = useCallback(async () => {
    if (!user) return;
    const orgs = await fetchOrganizations(user.id);
    setOrganizations(orgs);
    resolveCurrentOrg(orgs);
  }, [user, resolveCurrentOrg]);

  const createOrg = useCallback(async (name: string): Promise<Organization> => {
    if (!user) throw new Error("Not authenticated");

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ name: name.trim(), owner_id: user.id })
      .select()
      .single();

    if (orgError || !org) throw orgError ?? new Error("Failed to create organization");

    // Add the creator as owner
    await supabase.from("organization_members").insert({
      org_id: org.id,
      user_id: user.id,
      role: "owner",
      accepted_at: new Date().toISOString(),
    });

    const newOrg: Organization = { ...(org as any), userRole: "owner" };
    setOrganizations(prev => [...prev, newOrg]);
    setCurrentOrg(newOrg);
    localStorage.setItem(ORG_STORAGE_KEY, org.id);
    return newOrg;
  }, [user]);

  const leaveOrg = useCallback(async (orgId: string) => {
    if (!user) return;
    await supabase
      .from("organization_members")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", user.id);

    const updated = organizations.filter(o => o.id !== orgId);
    setOrganizations(updated);
    if (currentOrg?.id === orgId) {
      const next = updated[0] ?? null;
      setCurrentOrg(next);
      if (next) localStorage.setItem(ORG_STORAGE_KEY, next.id);
      else localStorage.removeItem(ORG_STORAGE_KEY);
    }
  }, [user, organizations, currentOrg]);

  // ── Auth methods ────────────────────────────────────────────────────────────

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error: error as Error | null };
  };

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    localStorage.removeItem(ORG_STORAGE_KEY);
    await supabase.auth.signOut();
  };

  const isAdmin = profile?.role === "admin";

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading, isAdmin,
      currentOrg, organizations,
      switchOrg, createOrg, refreshOrgs, leaveOrg,
      signUp, signIn, signInWithGoogle, signInWithMagicLink, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
