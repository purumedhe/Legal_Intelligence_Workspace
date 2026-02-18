import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
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
  const initializedRef = useRef(false);

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
    // Set up auth listener FIRST, then get initial session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);

      if (sess?.user) {
        // Use setTimeout to avoid Supabase deadlock on token refresh
        setTimeout(async () => {
          await fetchProfile(sess.user.id);
          await fetchRole(sess.user.id);
          setLoading(false);
        }, 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      if (!sess) {
        // No session — stop loading immediately
        setLoading(false);
      }
      // If session exists, onAuthStateChange will handle it
    });

    // Safety timeout — never hang more than 5 seconds
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signUp = async (email: string, password: string, name: string, phone: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, username: email, phone },
      },
    });

    if (error) {
      if (error.message?.toLowerCase().includes("already registered")) {
        return "Email already registered. Please sign in instead.";
      }
      return error.message;
    }

    if (data.user) {
      await fetchProfile(data.user.id);
      await fetchRole(data.user.id);
    }

    return null;
  };

  const verifyOtp = async (email: string, token: string, password: string): Promise<{ error: string | null; isAdmin: boolean }> => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) return { error: error.message, isAdmin: false };

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
