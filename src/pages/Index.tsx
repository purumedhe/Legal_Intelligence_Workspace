import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import CaseNotepad from "@/components/CaseNotepad";
import AnalysisResults, { type AnalysisData } from "@/components/AnalysisResults";
import ChatPanel, { type Message } from "@/components/ChatPanel";
import DocumentModal from "@/components/DocumentModal";
import { Scale } from "lucide-react";

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-case`;

const Index = () => {
  const { toast } = useToast();
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showDocument, setShowDocument] = useState(false);
  const [caseContext, setCaseContext] = useState("");

  const analyzeCase = async (description: string, category: string, offence: string) => {
    setIsAnalyzing(true);
    setAnalysisData(null);
    setChatMessages([]);
    const prompt = `Case Description: ${description}${category ? `\nCase Category: ${category}` : ""}${offence ? `\nOffence Type: ${offence}` : ""}`;
    setCaseContext(prompt);

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
      // Parse JSON from response (may be wrapped in markdown code block)
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed: AnalysisData = JSON.parse(jsonStr);
      setAnalysisData(parsed);
    } catch (e) {
      console.error(e);
      toast({ title: "Analysis Error", description: e instanceof Error ? e.message : "Failed to analyze case", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sendChatMessage = async (input: string) => {
    const userMsg: Message = { role: "user", content: input };
    const allMessages: Message[] = [...chatMessages, userMsg];
    setChatMessages(allMessages);
    setIsChatLoading(true);

    let assistantContent = "";

    try {
      const contextMsg: Message = {
        role: "user",
        content: `Context from case analysis:\n${caseContext}\n\nAnalysis results:\n${JSON.stringify(analysisData, null, 2)}`,
      };

      const resp = await fetch(FUNC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          type: "chat",
          messages: [contextMsg, ...allMessages],
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Chat stream failed");

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
              setChatMessages((prev) => {
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
    } catch (e) {
      console.error(e);
      toast({ title: "Chat Error", description: "Failed to get response", variant: "destructive" });
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Scale className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-serif font-bold text-foreground tracking-tight">
            Legal Intelligence Workspace
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded bg-secondary text-primary font-medium">India</span>
          <span className="text-xs px-2 py-1 rounded bg-secondary text-primary font-medium">Laws</span>
          <span className="text-xs px-2 py-1 rounded bg-secondary text-primary font-medium">AI-Assisted</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <CaseNotepad onAnalyze={analyzeCase} isLoading={isAnalyzing} />

        {isAnalyzing && (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-3 text-primary">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="font-medium">Analyzing case with AI...</span>
            </div>
          </div>
        )}

        {analysisData && (
          <>
            <AnalysisResults data={analysisData} onViewDocument={() => setShowDocument(true)} />
            <ChatPanel messages={chatMessages} onSend={sendChatMessage} isLoading={isChatLoading} />
            <DocumentModal
              open={showDocument}
              onClose={() => setShowDocument(false)}
              document={analysisData.courtDocument}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Prototype • Government Law Sources • Cloud Ready • Built for Lawyers
        </p>
        <p className="text-xs text-muted-foreground mt-1">© Purushottam Medhe</p>
      </footer>
    </div>
  );
};

export default Index;
