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
    const { tenderText, prompt, currentItems } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Missing prompt." }),
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

    const systemPrompt = `You are a procurement BOQ assistant. Based on the user's request and the tender document, generate Bill of Quantities line items.

Return ONLY a valid JSON array of objects with these exact keys:
[
  {
    "item_code": "string — short material/item code",
    "description": "string — full item description",
    "quantity": "number",
    "unit": "string — unit of measure (NOS, MTR, SET, KG, LTR, etc.)",
    "unit_rate": "number — unit price in INR",
    "notes": "string — any notes or empty string"
  }
]

Rules:
- Generate realistic items relevant to trenchless engineering (CIPP lining, HDD drilling, pipe bursting, manholes, etc.)
- Use realistic Indian market rates in INR
- Return at least 1 and at most 15 items
- Do NOT return markdown, explanations, or any text outside the JSON array`;

    const context = `--- TENDER DOCUMENT (excerpt) ---
${(tenderText ?? "").slice(0, 15000)}

--- CURRENT BOQ ITEMS ---
${JSON.stringify(currentItems ?? [], null, 2)}

--- USER REQUEST ---
${prompt}`;

    const url = "https://api.groq.com/openai/v1/chat/completions";
    const model = "llama-3.1-8b-instant";

    const body = {
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: context }
      ],
      temperature: 0.4,
      max_tokens: 2048,
      // 🔥 No response_format – this model returns JSON reliably without it
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
    const rawText = groqData?.choices?.[0]?.message?.content ?? "[]";

    let items: any[];
    try {
      // Try to extract JSON array
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        items = JSON.parse(jsonMatch[0]);
      } else {
        items = JSON.parse(rawText);
      }
    } catch (e) {
      throw new Error(`Failed to parse AI response: ${rawText.slice(0, 200)}`);
    }

    if (!Array.isArray(items)) {
      throw new Error("AI response was not an array.");
    }

    const sanitized = items.map((item, i) => ({
      item_code: String(item.item_code ?? `ITEM-${i + 1}`),
      description: String(item.description ?? ""),
      quantity: Number(item.quantity) || 1,
      unit: String(item.unit ?? "NOS"),
      unit_rate: Number(item.unit_rate) || 0,
      notes: String(item.notes ?? ""),
    }));

    return new Response(
      JSON.stringify({ items: sanitized }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Copilot error:", err);
    return new Response(
      JSON.stringify({ 
        error: err instanceof Error ? err.message : "Unknown error",
        stack: err instanceof Error ? err.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});