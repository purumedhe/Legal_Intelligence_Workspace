import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  Scale, LogOut, Plus, MessageSquare, Send, Loader2, Trash2, Pencil, Check, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-case`;

interface CaseItem {
  id: string;
  title: string;
  updated_at: string;
}

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

const UserDashboard = () => {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [cases, setCases] = useState<CaseItem[]>([]);
  const [activeCase, setActiveCase] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [showSubDialog, setShowSubDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading]);

  // Check access
  useEffect(() => {
    if (profile && !profile.access_enabled) setShowBlockedDialog(true);
  }, [profile]);

  // Load cases
  useEffect(() => {
    if (user) loadCases();
  }, [user]);

  // Load messages when case changes
  useEffect(() => {
    if (activeCase) loadMessages(activeCase);
    else setMessages([]);
  }, [activeCase]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const loadCases = async () => {
    const { data } = await supabase
      .from("cases")
      .select("id, title, updated_at")
      .eq("user_id", user!.id)
      .order("updated_at", { ascending: false });
    if (data) setCases(data);
  };

  const loadMessages = async (caseId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
  };

  const createCase = async () => {
    const { data, error } = await supabase
      .from("cases")
      .insert({ user_id: user!.id, title: "New Case" })
      .select("id, title, updated_at")
      .single();
    if (data) {
      setCases((prev) => [data, ...prev]);
      setActiveCase(data.id);
    }
  };

  const deleteCase = async (id: string) => {
    await supabase.from("cases").delete().eq("id", id);
    setCases((prev) => prev.filter((c) => c.id !== id));
    if (activeCase === id) {
      setActiveCase(null);
      setMessages([]);
    }
  };

  const renameCase = async (id: string) => {
    if (!editTitle.trim()) return;
    await supabase.from("cases").update({ title: editTitle.trim() }).eq("id", id);
    setCases((prev) => prev.map((c) => c.id === id ? { ...c, title: editTitle.trim() } : c));
    setEditingCaseId(null);
  };

  const handleSend = async () => {
    if (!input.trim() || isSending || !activeCase) return;

    // Check subscription
    await refreshProfile();
    if (profile && !profile.subscription_active) {
      setShowSubDialog(true);
      return;
    }
    if (profile && !profile.access_enabled) {
      setShowBlockedDialog(true);
      return;
    }

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const allMsgs = [...messages, userMsg];
    setMessages(allMsgs);
    setInput("");
    setIsSending(true);

    // Save user message
    await supabase.from("messages").insert({ case_id: activeCase, role: "user", content: userMsg.content });

    let assistantContent = "";

    try {
      const resp = await fetch(FUNC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          type: "chat",
          messages: allMsgs.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Chat failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Save assistant message
      if (assistantContent) {
        await supabase.from("messages").insert({ case_id: activeCase, role: "assistant", content: assistantContent });
      }

      // Update case timestamp
      await supabase.from("cases").update({ updated_at: new Date().toISOString() }).eq("id", activeCase);
      loadCases();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to get AI response", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Loading...</div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Scale className="w-6 h-6 text-primary" />
          <h1 className="text-lg font-serif font-bold text-foreground">Legal Intelligence Workspace</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {profile?.name || "User"}
          </span>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="border-border text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4 mr-1" /> Sign Out
          </Button>
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 border-r border-border bg-card flex flex-col shrink-0">
          <div className="p-4 border-b border-border">
            <Button onClick={createCase} className="w-full bg-primary text-primary-foreground hover:bg-gold-bright font-semibold">
              <Plus className="w-4 h-4 mr-2" /> New Case
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {cases.length === 0 && (
              <p className="text-center text-muted-foreground text-xs py-8">No cases yet. Create one!</p>
            )}
            {cases.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                  activeCase === c.id
                    ? "bg-secondary border border-primary/30 gold-border-glow"
                    : "hover:bg-secondary/50"
                }`}
                onClick={() => { setActiveCase(c.id); setEditingCaseId(null); }}
              >
                <MessageSquare className="w-4 h-4 text-primary shrink-0" />
                {editingCaseId === c.id ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && renameCase(c.id)}
                      className="h-6 text-xs bg-input border-border"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button onClick={(e) => { e.stopPropagation(); renameCase(c.id); }} className="text-primary"><Check className="w-3 h-3" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setEditingCaseId(null); }} className="text-muted-foreground"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-foreground truncate flex-1">{c.title}</span>
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingCaseId(c.id); setEditTitle(c.title); }}
                        className="text-muted-foreground hover:text-primary"
                      ><Pencil className="w-3 h-3" /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteCase(c.id); }}
                        className="text-muted-foreground hover:text-destructive"
                      ><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!activeCase ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <Scale className="w-12 h-12 text-primary/30 mx-auto" />
                <p className="text-muted-foreground text-sm">Select a case or create a new one to begin</p>
              </div>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-16">
                    Start your legal consultation. Describe your case...
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-lg px-4 py-3 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm prose-invert max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}
                {isSending && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex justify-start">
                    <div className="bg-secondary rounded-lg px-4 py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-border p-4 flex gap-2 shrink-0">
                <Input
                  placeholder="Describe your case or ask a legal question..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isSending}
                  size="icon"
                  className="bg-primary text-primary-foreground hover:bg-gold-bright shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Access Blocked Dialog */}
      <Dialog open={showBlockedDialog} onOpenChange={() => {}}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-destructive font-serif">Access Disabled</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Your access has been disabled by admin. Please contact your administrator for assistance.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleSignOut} className="bg-primary text-primary-foreground hover:bg-gold-bright">
              Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription Expired Dialog */}
      <Dialog open={showSubDialog} onOpenChange={setShowSubDialog}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-primary font-serif">Subscription Expired</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Your subscription has expired. Please renew to continue using AI features. You can still view your existing cases and chat history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowSubDialog(false)} variant="outline" className="border-border">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserDashboard;
