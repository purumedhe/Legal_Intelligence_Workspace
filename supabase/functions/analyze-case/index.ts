import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const chatSystemPrompt = `You are a senior Indian legal expert AI assistant. You have deep knowledge of Indian Penal Code (IPC), Bharatiya Nyaya Sanhita (BNS), Code of Criminal Procedure (CrPC), Bharatiya Nagarik Suraksha Sanhita (BNSS), Indian Evidence Act, Bharatiya Sakshya Adhiniyam, and all major Indian legal statutes.

RESPONSE FORMAT RULES (CRITICAL):
- Be CONCISE by default. Keep answers short and structured.
- Use bullet points and headings. Avoid long paragraphs.
- Cite specific sections and relevant case law.
- Use legal formatting: bold section numbers, clear hierarchy.
- Maximum 200 words unless the user explicitly asks for more detail.
- If the user says "Explain in Detail" or similar, then provide a comprehensive expanded answer with full legal reasoning, all relevant sections, case precedents, and strategic analysis. In that case, there is no word limit.

Maintain context from the conversation. Be precise, authoritative, and practical.`;

    const analyzeSystemPrompt = `You are a senior Indian legal analysis AI. Given a case description, case category, and offence type, provide a comprehensive structured analysis in the following JSON format:
{
  "legalSections": [{"section": "section name", "description": "brief description"}],
  "punishmentRange": "detailed punishment/sentence range description",
  "presentationStrategy": "detailed court presentation strategy",
  "casePrecedents": [{"name": "case name", "relevance": "how it's relevant"}],
  "courtDocument": "A complete court-ready document brief including: Title, Facts of the Case, Applicable Legal Provisions, Arguments, Prayer/Relief Sought, and Conclusion. Format it professionally."
}
Respond ONLY with valid JSON. Be thorough, cite specific Indian legal sections (IPC/BNS), and reference real landmark Indian case precedents.`;

    const systemPrompt = type === "chat" ? chatSystemPrompt : analyzeSystemPrompt;

    const body: Record<string, unknown> = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    };

    if (type === "chat") {
      body.stream = true;
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const t = await response.text();
        console.error("AI error:", status, t);
        return new Response(JSON.stringify({ error: "AI service error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    } else {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limited." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const t = await response.text();
        console.error("AI error:", status, t);
        return new Response(JSON.stringify({ error: "AI service error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
