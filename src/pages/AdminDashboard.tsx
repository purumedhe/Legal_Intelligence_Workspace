import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Scale, LogOut, Users, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface UserRow {
  user_id: string;
  name: string;
  username: string;
  phone: string | null;
  access_enabled: boolean;
  subscription_active: boolean;
  created_at: string;
}

const AdminDashboard = () => {
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/auth");
    }
  }, [user, isAdmin, loading]);

  useEffect(() => {
    if (user && isAdmin) fetchUsers();
  }, [user, isAdmin]);

  const fetchUsers = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, name, username, phone, access_enabled, subscription_active, created_at")
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Filter out admin users from the list
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      const adminIds = new Set(adminRoles?.map((r: any) => r.user_id) ?? []);
      setUsers(data.filter((u: any) => !adminIds.has(u.user_id)));
    }
    setFetching(false);
  };

  const toggleField = async (userId: string, field: "access_enabled" | "subscription_active", current: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: !current })
      .eq("user_id", userId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, [field]: !current } : u));
      toast({ title: "Updated", description: `${field === "access_enabled" ? "Access" : "Subscription"} toggled` });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Scale className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-serif font-bold text-foreground">Admin Dashboard</h1>
          <span className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground font-medium flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Admin
          </span>
        </div>
        <Button variant="outline" onClick={handleSignOut} className="border-border text-muted-foreground hover:text-foreground">
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-serif font-bold text-foreground">User Management</h2>
            <span className="text-xs text-muted-foreground ml-auto">{users.length} users</span>
          </div>

          {fetching ? (
            <div className="text-center py-12 text-muted-foreground">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No registered users yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Subscription</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium text-foreground">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground">{u.username}</TableCell>
                      <TableCell className="text-muted-foreground">{u.phone || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={u.access_enabled}
                            onCheckedChange={() => toggleField(u.user_id, "access_enabled", u.access_enabled)}
                          />
                          <span className={`text-xs font-medium ${u.access_enabled ? "text-green-400" : "text-destructive"}`}>
                            {u.access_enabled ? "ON" : "OFF"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={u.subscription_active}
                            onCheckedChange={() => toggleField(u.user_id, "subscription_active", u.subscription_active)}
                          />
                          <span className={`text-xs font-medium ${u.subscription_active ? "text-green-400" : "text-destructive"}`}>
                            {u.subscription_active ? "Active" : "Expired"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
