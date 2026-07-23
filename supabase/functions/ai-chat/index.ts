const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const systemPrompt = `You are a procurement assistant. Based on the tender document provided, answer the user's question accurately and concisely. If the answer is not found in the document, say "I couldn't find that information in the document." Do not make up information.`;

    const url = "https://api.groq.com/openai/v1/chat/completions";
    const model = "llama-3.1-8b-instant";

    const body = {
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `--- TENDER DOCUMENT ---\n${tenderText.slice(0, 20000)}\n\n--- QUESTION ---\n${question}` }
      ],
      temperature: 0.3,
      max_tokens: 1024,
    };

    const groqRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => "");
      throw new Error(`Groq API error (${groqRes.status}): ${errText.slice(0, 500)}`);
    }

    const groqData = await groqRes.json();
    const answer = groqData?.choices?.[0]?.message?.content ?? "I couldn't process your question.";

    return new Response(
      JSON.stringify({ answer }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});