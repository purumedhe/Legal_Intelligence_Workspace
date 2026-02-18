import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import ReactMarkdown from "react-markdown";
import CaseNotepad from "@/components/CaseNotepad";
import AnalysisResults, { type AnalysisData } from "@/components/AnalysisResults";
import DocumentModal from "@/components/DocumentModal";
import {
  Scale, LogOut, Plus, MessageSquare, Send, Loader2, Trash2, Pencil, Check, X,
  Bot, Save, Menu, Briefcase, BookText,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-case`;

type ViewMode = "empty" | "general-chat" | "new-case" | "case-detail";

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
  const isMobile = useIsMobile();

  // View state
  const [view, setView] = useState<ViewMode>("empty");
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [activeCase, setActiveCase] = useState<string | null>(null);
  const [activeCaseAnalysis, setActiveCaseAnalysis] = useState<AnalysisData | null>(null);

  // Case chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  // General chat
  const [generalMessages, setGeneralMessages] = useState<ChatMessage[]>([]);
  const [generalInput, setGeneralInput] = useState("");
  const [isGeneralSending, setIsGeneralSending] = useState(false);

  // Analysis
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // UI state
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showSaveCaseDialog, setShowSaveCaseDialog] = useState(false);
  const [saveCaseTitle, setSaveCaseTitle] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auth check
  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading]);

  // Access check
  useEffect(() => {
    if (profile && !profile.access_enabled) setShowBlockedDialog(true);
  }, [profile]);

  // Load cases
  useEffect(() => {
    if (user) loadCases();
  }, [user]);

  // Load general messages
  useEffect(() => {
    if (user) loadGeneralMessages();
  }, [user]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, generalMessages]);

  const loadCases = async () => {
    const { data } = await supabase
      .from("cases")
      .select("id, title, updated_at")
      .eq("user_id", user!.id)
      .order("updated_at", { ascending: false });
    if (data) setCases(data);
  };

  const loadGeneralMessages = async () => {
    const { data } = await (supabase as any)
      .from("general_messages")
      .select("id, role, content, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: true });
    if (data) setGeneralMessages(data.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
  };

  const loadMessages = async (caseId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
  };

  const openCase = async (caseId: string) => {
    setActiveCase(caseId);
    setView("case-detail");
    setEditingCaseId(null);
    if (isMobile) setSidebarOpen(false);

    const { data: caseData } = await (supabase as any)
      .from("cases")
      .select("analysis_data")
      .eq("id", caseId)
      .single();

    setActiveCaseAnalysis(caseData?.analysis_data as AnalysisData | null);
    await loadMessages(caseId);
  };

  const handleNewCase = () => {
    setView("new-case");
    setActiveCase(null);
    setActiveCaseAnalysis(null);
    setMessages([]);
    if (isMobile) setSidebarOpen(false);
  };

  const deleteCase = async (id: string) => {
    await supabase.from("cases").delete().eq("id", id);
    setCases((prev) => prev.filter((c) => c.id !== id));
    if (activeCase === id) {
      setActiveCase(null);
      setView("empty");
      setMessages([]);
      setActiveCaseAnalysis(null);
    }
  };

  const renameCase = async (id: string) => {
    if (!editTitle.trim()) return;
    await supabase.from("cases").update({ title: editTitle.trim() }).eq("id", id);
    setCases((prev) => prev.map((c) => c.id === id ? { ...c, title: editTitle.trim() } : c));
    setEditingCaseId(null);
  };

  const analyzeCase = async (description: string, category: string, offence: string) => {
    await refreshProfile();
    if (profile && !profile.subscription_active) { setShowSubDialog(true); return; }
    if (profile && !profile.access_enabled) { setShowBlockedDialog(true); return; }

    setIsAnalyzing(true);
    const prompt = `Case Description: ${description}${category ? `\nCase Category: ${category}` : ""}${offence ? `\nOffence Type: ${offence}` : ""}`;

    try {
      const resp = await fetch(FUNC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          type: "analyze",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Analysis failed");
      }

      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || "";
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed: AnalysisData = JSON.parse(jsonStr);

      const title = `${category || "Case"} - ${offence || "Analysis"}`;
      const { data: newCase } = await (supabase as any)
        .from("cases")
        .insert({ user_id: user!.id, title, analysis_data: parsed })
        .select("id, title, updated_at")
        .single();

      if (newCase) {
        await supabase.from("messages").insert([
          { case_id: newCase.id, role: "user", content: prompt },
          { case_id: newCase.id, role: "assistant", content: `Case analysis completed. You can now ask follow-up questions about this case.` },
        ]);

        setCases((prev) => [newCase, ...prev]);
        setActiveCase(newCase.id);
        setActiveCaseAnalysis(parsed);
        setView("case-detail");
        await loadMessages(newCase.id);
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Analysis Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Stream helper
  const streamChat = async (
    allMsgs: ChatMessage[],
    onDelta: (content: string) => void,
  ): Promise<string> => {
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
    let assistantContent = "";

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
            onDelta(assistantContent);
          }
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }

    return assistantContent;
  };

  // "Explain in Detail" handler
  const handleExplainInDetail = async (
    msgIndex: number,
    chatType: "case" | "general",
  ) => {
    const msgs = chatType === "case" ? messages : generalMessages;
    const setMsgs = chatType === "case" ? setMessages : setGeneralMessages;
    const setSending = chatType === "case" ? setIsSending : setIsGeneralSending;

    const previousAnswer = msgs[msgIndex]?.content;
    if (!previousAnswer) return;

    await refreshProfile();
    if (profile && !profile.subscription_active) { setShowSubDialog(true); return; }
    if (profile && !profile.access_enabled) { setShowBlockedDialog(true); return; }

    const detailMsg: ChatMessage = { role: "user", content: "Explain in Detail" };
    const allMsgs = [...msgs.slice(0, msgIndex + 1), detailMsg];
    setMsgs((prev) => [...prev, detailMsg]);
    setSending(true);

    // Save user message
    if (chatType === "case" && activeCase) {
      await supabase.from("messages").insert({ case_id: activeCase, role: "user", content: detailMsg.content });
    } else if (chatType === "general") {
      await (supabase as any).from("general_messages").insert({ user_id: user!.id, role: "user", content: detailMsg.content });
    }

    try {
      const assistantContent = await streamChat(allMsgs, (content) => {
        setMsgs((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content } : m);
          }
          return [...prev, { role: "assistant", content }];
        });
      });

      if (assistantContent) {
        if (chatType === "case" && activeCase) {
          await supabase.from("messages").insert({ case_id: activeCase, role: "assistant", content: assistantContent });
          await supabase.from("cases").update({ updated_at: new Date().toISOString() }).eq("id", activeCase);
        } else if (chatType === "general") {
          await (supabase as any).from("general_messages").insert({ user_id: user!.id, role: "assistant", content: assistantContent });
        }
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to get detailed response", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Send message in case chat
  const handleCaseSend = async () => {
    if (!input.trim() || isSending || !activeCase) return;

    await refreshProfile();
    if (profile && !profile.subscription_active) { setShowSubDialog(true); return; }
    if (profile && !profile.access_enabled) { setShowBlockedDialog(true); return; }

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const allMsgs = [...messages, userMsg];
    setMessages(allMsgs);
    setInput("");
    setIsSending(true);

    await supabase.from("messages").insert({ case_id: activeCase, role: "user", content: userMsg.content });

    try {
      const assistantContent = await streamChat(allMsgs, (content) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content } : m);
          }
          return [...prev, { role: "assistant", content }];
        });
      });

      if (assistantContent) {
        await supabase.from("messages").insert({ case_id: activeCase, role: "assistant", content: assistantContent });
      }
      await supabase.from("cases").update({ updated_at: new Date().toISOString() }).eq("id", activeCase);
      loadCases();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to get AI response", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  // Send message in general chat
  const handleGeneralSend = async () => {
    if (!generalInput.trim() || isGeneralSending) return;

    await refreshProfile();
    if (profile && !profile.subscription_active) { setShowSubDialog(true); return; }
    if (profile && !profile.access_enabled) { setShowBlockedDialog(true); return; }

    const userMsg: ChatMessage = { role: "user", content: generalInput.trim() };
    const allMsgs = [...generalMessages, userMsg];
    setGeneralMessages(allMsgs);
    setGeneralInput("");
    setIsGeneralSending(true);

    await (supabase as any).from("general_messages").insert({ user_id: user!.id, role: "user", content: userMsg.content });

    try {
      const assistantContent = await streamChat(allMsgs, (content) => {
        setGeneralMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content } : m);
          }
          return [...prev, { role: "assistant", content }];
        });
      });

      if (assistantContent) {
        await (supabase as any).from("general_messages").insert({ user_id: user!.id, role: "assistant", content: assistantContent });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to get AI response", variant: "destructive" });
    } finally {
      setIsGeneralSending(false);
    }
  };

  // Save general chat as case
  const handleSaveAsCase = async () => {
    if (!saveCaseTitle.trim() || generalMessages.length === 0) return;

    const { data: newCase } = await supabase
      .from("cases")
      .insert({ user_id: user!.id, title: saveCaseTitle.trim() })
      .select("id, title, updated_at")
      .single();

    if (newCase) {
      const msgInserts = generalMessages.map((m) => ({
        case_id: newCase.id,
        role: m.role,
        content: m.content,
      }));
      await supabase.from("messages").insert(msgInserts);

      await (supabase as any).from("general_messages").delete().eq("user_id", user!.id);
      setGeneralMessages([]);

      setCases((prev) => [newCase, ...prev]);
      setShowSaveCaseDialog(false);
      setSaveCaseTitle("");

      openCase(newCase.id);
      toast({ title: "Saved", description: "Conversation saved as case" });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Loading...</div>;

  // Chat message renderer with "Explain in Detail" button
  const renderMessages = (msgs: ChatMessage[], sending: boolean, chatType: "case" | "general") => (
    <>
      {msgs.length === 0 && (
        <div className="text-center text-muted-foreground text-sm py-16">
          Start your legal consultation...
        </div>
      )}
      {msgs.map((msg, i) => (
        <div key={i}>
          <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-lg px-4 py-3 text-sm ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : msg.content}
            </div>
          </div>
          {/* Explain in Detail button after assistant messages */}
          {msg.role === "assistant" && msg.content && !sending && msg.content !== "Explain in Detail" && (
            <div className="flex justify-start mt-1 ml-1">
              <button
                onClick={() => handleExplainInDetail(i, chatType)}
                className="text-xs text-primary hover:text-gold-bright font-medium flex items-center gap-1 transition-colors"
                disabled={isSending || isGeneralSending}
              >
                <BookText className="w-3 h-3" />
                Explain in Detail
              </button>
            </div>
          )}
        </div>
      ))}
      {sending && msgs[msgs.length - 1]?.role !== "assistant" && (
        <div className="flex justify-start">
          <div className="bg-secondary rounded-lg px-4 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        </div>
      )}
    </>
  );

  // Sidebar content (shared between mobile overlay and desktop)
  const sidebarContent = (
    <>
      <div className="p-4 space-y-2 border-b border-border">
        <Button onClick={handleNewCase} className="w-full bg-primary text-primary-foreground hover:bg-gold-bright font-semibold">
          <Plus className="w-4 h-4 mr-2" /> New Case
        </Button>
        <Button
          variant={view === "general-chat" ? "secondary" : "outline"}
          onClick={() => { setView("general-chat"); setActiveCase(null); if (isMobile) setSidebarOpen(false); }}
          className="w-full border-border text-muted-foreground hover:text-foreground"
        >
          <Bot className="w-4 h-4 mr-2" /> Legal Assistant
        </Button>
      </div>

      <div className="px-4 py-2 flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cases</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {cases.length === 0 && (
          <p className="text-center text-muted-foreground text-xs py-8">No cases yet</p>
        )}
        {cases.map((c) => (
          <div
            key={c.id}
            className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
              activeCase === c.id && view === "case-detail"
                ? "bg-secondary border border-primary/30 gold-border-glow"
                : "hover:bg-secondary/50"
            }`}
            onClick={() => openCase(c.id)}
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
                  <button onClick={(e) => { e.stopPropagation(); setEditingCaseId(c.id); setEditTitle(c.title); }} className="text-muted-foreground hover:text-primary">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deleteCase(c.id); }} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {isMobile && (
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-muted-foreground hover:text-foreground">
              <Menu className="w-5 h-5" />
            </button>
          )}
          <Scale className="w-6 h-6 text-primary" />
          <h1 className="text-base md:text-lg font-serif font-bold text-foreground">Legal Intelligence Workspace</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">{profile?.name || "User"}</span>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="border-border text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile sidebar overlay */}
        {isMobile && sidebarOpen && (
          <div className="fixed inset-0 z-40 flex" onClick={() => setSidebarOpen(false)}>
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <aside
              className="relative w-72 bg-card border-r border-border flex flex-col z-50 animate-in slide-in-from-left duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {sidebarContent}
            </aside>
          </div>
        )}

        {/* Desktop sidebar */}
        {!isMobile && (
          <aside className="w-72 border-r border-border bg-card flex flex-col shrink-0">
            {sidebarContent}
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Empty state */}
          {view === "empty" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <Scale className="w-12 h-12 text-primary/30 mx-auto" />
                <p className="text-muted-foreground text-sm">Select a case, start a new one, or open Legal Assistant</p>
              </div>
            </div>
          )}

          {/* New Case view */}
          {view === "new-case" && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <CaseNotepad onAnalyze={analyzeCase} isLoading={isAnalyzing} />
              {isAnalyzing && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center gap-3 text-primary">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="font-medium">Analyzing case with AI...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Case detail view */}
          {view === "case-detail" && activeCase && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeCaseAnalysis && (
                <div className="shrink-0 overflow-y-auto max-h-[40vh] p-4 md:p-6 border-b border-border">
                  <AnalysisResults data={activeCaseAnalysis} onViewDocument={() => setShowDocModal(true)} />
                </div>
              )}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {renderMessages(messages, isSending, "case")}
              </div>
              <div className="border-t border-border p-3 md:p-4 flex gap-2 shrink-0">
                <Input
                  placeholder="Continue your legal consultation..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCaseSend()}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                />
                <Button onClick={handleCaseSend} disabled={!input.trim() || isSending} size="icon" className="bg-primary text-primary-foreground hover:bg-gold-bright shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* General chat view */}
          {view === "general-chat" && (
            <>
              <div className="border-b border-border px-4 md:px-6 py-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Legal Assistant</span>
                </div>
                {generalMessages.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowSaveCaseDialog(true); setSaveCaseTitle(""); }}
                    className="border-border text-muted-foreground hover:text-foreground"
                  >
                    <Save className="w-3 h-3 mr-1" /> Save as Case
                  </Button>
                )}
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {renderMessages(generalMessages, isGeneralSending, "general")}
              </div>
              <div className="border-t border-border p-3 md:p-4 flex gap-2 shrink-0">
                <Input
                  placeholder="Ask any legal question..."
                  value={generalInput}
                  onChange={(e) => setGeneralInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGeneralSend()}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                />
                <Button onClick={handleGeneralSend} disabled={!generalInput.trim() || isGeneralSending} size="icon" className="bg-primary text-primary-foreground hover:bg-gold-bright shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Document Modal */}
      {activeCaseAnalysis && (
        <DocumentModal
          open={showDocModal}
          onClose={() => setShowDocModal(false)}
          document={activeCaseAnalysis.courtDocument}
        />
      )}

      {/* Save as Case Dialog */}
      <Dialog open={showSaveCaseDialog} onOpenChange={setShowSaveCaseDialog}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-primary font-serif">Save as Case</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Enter a title for this case to save the conversation.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Case title..."
            value={saveCaseTitle}
            onChange={(e) => setSaveCaseTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveAsCase()}
            className="bg-input border-border text-foreground"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveCaseDialog(false)} className="border-border">Cancel</Button>
            <Button onClick={handleSaveAsCase} disabled={!saveCaseTitle.trim()} className="bg-primary text-primary-foreground hover:bg-gold-bright">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button onClick={handleSignOut} className="bg-primary text-primary-foreground hover:bg-gold-bright">Sign Out</Button>
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
            <Button onClick={() => setShowSubDialog(false)} variant="outline" className="border-border">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserDashboard;
