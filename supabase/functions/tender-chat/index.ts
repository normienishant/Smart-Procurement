const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// 🔥 Primary model: llama-3.1-8b-instant (fast, low token usage)
// Fallback: gemma2-9b-it
const MODELS = [
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
  "llama-3.3-70b-versatile", // last resort
];

// 🔥 Simple in-memory cache (per function instance)
const cache = new Map<string, { answer: string; timestamp: number }>();
const CACHE_TTL = 3600; // 1 hour

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { tenderText, question } = await req.json();

    if (!tenderText || !question) {
      return new Response(
        JSON.stringify({ error: "Missing tenderText or question." }),
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

    // 🔥 Check cache
    const cacheKey = `${tenderText.slice(0, 100)}:${question}`;
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL * 1000) {
      return new Response(
        JSON.stringify({ answer: cached.answer }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a procurement assistant. Answer the user's question based ONLY on the provided tender document. If the answer is not in the document, say "I couldn't find this information in the document." Provide a concise, accurate answer (max 3 sentences).

Tender Document:
${tenderText.slice(0, 25000)}`;

    const userPrompt = `Question: ${question}`;

    const url = "https://api.groq.com/openai/v1/chat/completions";
    let lastError: any = null;
    let finalAnswer = "I'm currently unable to answer due to high demand. Please try again in a few minutes, or rephrase your question.";

    for (const model of MODELS) {
      try {
        console.log(`🔄 Chat trying model: ${model}`);
        const body = {
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.2, // lower temperature for consistency
          max_tokens: 256, // reduced from 1024 to save tokens
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
          console.warn(`⚠️ Chat model ${model} rate limited: ${errText.slice(0, 200)}`);
          lastError = new Error(`Rate limit for ${model}`);
          continue;
        }

        if (!groqRes.ok) {
          const errText = await groqRes.text().catch(() => "");
          if (groqRes.status === 400 && errText.includes("model")) {
            console.warn(`⚠️ Chat model ${model} not available`);
            lastError = new Error(`Model ${model} unavailable`);
            continue;
          }
          throw new Error(`Groq API error (${groqRes.status}) with ${model}: ${errText.slice(0, 500)}`);
        }

        const groqData = await groqRes.json();
        const answer = groqData?.choices?.[0]?.message?.content ?? "I couldn't generate an answer.";

        finalAnswer = answer;
        // Cache the answer
        cache.set(cacheKey, { answer: finalAnswer, timestamp: Date.now() });
        break; // success

      } catch (err: any) {
        if (err.message && (err.message.includes("Rate limit") || err.message.includes("unavailable") || err.message.includes("decommissioned"))) {
          console.warn(`⚠️ Chat model ${model} failed: ${err.message}`);
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    return new Response(
      JSON.stringify({ answer: finalAnswer }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});