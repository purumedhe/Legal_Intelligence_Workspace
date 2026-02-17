import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  name: string;
  username: string;
  phone: string | null;
  access_enabled: boolean;
  subscription_active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signUp: (email: string, password: string, name: string, phone: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<{ error: string | null; isAdmin: boolean }>;
  verifyOtp: (email: string, token: string, password: string) => Promise<{ error: string | null; isAdmin: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("name, username, phone, access_enabled, subscription_active")
      .eq("user_id", userId)
      .maybeSingle();
    setProfile(data);
  };

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const admin = data?.some((r: any) => r.role === "admin") ?? false;
    setIsAdmin(admin);
    return admin;
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
      await fetchRole(user.id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        await fetchProfile(sess.user.id);
        await fetchRole(sess.user.id);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        fetchProfile(sess.user.id);
        fetchRole(sess.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string, phone: string): Promise<string | null> => {
    // Check if email already registered
    const { data: existing } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", email)
      .maybeSingle();

    if (existing) return "Email already registered. Please sign in instead.";

    // Send OTP via magic link (creates user if not exists)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: { name, username: email, phone },
      },
    });

    if (error) return error.message;
    return null;
  };

  const verifyOtp = async (email: string, token: string, password: string): Promise<{ error: string | null; isAdmin: boolean }> => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) return { error: error.message, isAdmin: false };

    // Set password for future logins
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      console.error("Failed to set password:", updateError.message);
    }

    if (data.user) {
      const adminStatus = await fetchRole(data.user.id);
      await fetchProfile(data.user.id);
      return { error: null, isAdmin: adminStatus };
    }
    return { error: "Verification failed", isAdmin: false };
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null; isAdmin: boolean }> => {
    // Support admin usernames (no @ = append internal domain)
    const loginEmail = email.includes("@") ? email : `${email}@legalworkspace.local`;
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (error) return { error: error.message, isAdmin: false };

    const adminStatus = await fetchRole(data.user.id);
    await fetchProfile(data.user.id);
    return { error: null, isAdmin: adminStatus };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isAdmin, loading, signUp, signIn, verifyOtp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
