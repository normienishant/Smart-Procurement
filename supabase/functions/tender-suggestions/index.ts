const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODELS = [
  "llama-3.3-70b-versatile",
  "gemma2-9b-it",
  "llama-3.1-8b-instant",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { tenderText } = await req.json();

    if (!tenderText) {
      return new Response(
        JSON.stringify({ error: "Missing tenderText." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqKey = Deno.env.get("GROQ_API_KEY") ?? "";
    if (!groqKey) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY secret is not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 🔥 Prompt asks for short, concise questions (5-7 words)
    const systemPrompt = `You are a procurement assistant. Based on the following tender document, generate 5 short, concise questions (5-7 words each) that a user might ask to understand the tender better. The questions should cover the most important aspects like scope, deadlines, eligibility, technical specs, clauses, etc. Return ONLY a JSON object with a "suggestions" key that is an array of 5 strings.

Example: {"suggestions": ["What is the scope of work?", "What are the key deadlines?", "What are the eligibility requirements?", "What are the important clauses?", "What is the payment terms?"]}

Tender Document:
${tenderText.slice(0, 15000)}`;

    const url = "https://api.groq.com/openai/v1/chat/completions";
    let lastError: any = null;
    const defaultSuggestions = [
      "What is the scope of work?",
      "What are the key deadlines?",
      "What are the eligibility requirements?",
      "What are the important clauses?",
      "What is the payment terms?",
    ];

    for (const model of MODELS) {
      try {
        console.log(`🔄 Suggestions trying model: ${model}`);
        const body = {
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Generate 5 short questions as a JSON object with key 'suggestions'." }
          ],
          temperature: 0.3,
          max_tokens: 512,
          response_format: { type: "json_object" },
        };

        const groqRes = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${groqKey}`,
          },
          body: JSON.stringify(body),
        });

        if (groqRes.status === 429) {
          const errText = await groqRes.text().catch(() => "");
          console.warn(`⚠️ Suggestions model ${model} rate limited: ${errText.slice(0, 200)}`);
          lastError = new Error(`Rate limit for ${model}`);
          continue;
        }

        if (!groqRes.ok) {
          const errText = await groqRes.text().catch(() => "");
          if (groqRes.status === 400 && errText.includes("model")) {
            console.warn(`⚠️ Suggestions model ${model} not available`);
            lastError = new Error(`Model ${model} unavailable`);
            continue;
          }
          throw new Error(`Groq API error (${groqRes.status}) with ${model}: ${errText.slice(0, 500)}`);
        }

        const groqData = await groqRes.json();
        const rawText = groqData?.choices?.[0]?.message?.content ?? "{}";

        let suggestions: string[];
        try {
          const parsed = JSON.parse(rawText);
          if (parsed.suggestions && Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
            suggestions = parsed.suggestions.slice(0, 5);
          } else {
            suggestions = defaultSuggestions;
          }
        } catch {
          suggestions = defaultSuggestions;
        }

        return new Response(
          JSON.stringify({ suggestions }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      } catch (err: any) {
        if (err.message && (err.message.includes("Rate limit") || err.message.includes("unavailable") || err.message.includes("decommissioned"))) {
          console.warn(`⚠️ Suggestions model ${model} failed: ${err.message}`);
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    // 🔥 Fallback: return default suggestions
    return new Response(
      JSON.stringify({ suggestions: defaultSuggestions }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});