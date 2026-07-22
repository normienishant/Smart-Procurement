const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CopilotItem {
  item_code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_rate: number;
  notes: string;
}

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

    const systemPrompt = `You are a procurement BOQ assistant for a trenchless engineering company.
Based on the user's request and the tender document, generate Bill of Quantities line items.

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
    const body = {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: context }
      ],
      temperature: 0.4,
      max_tokens: 2048,
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

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `Groq API error (${groqRes.status}): ${errText.slice(0, 500)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqRes.json();
    const rawText = groqData?.choices?.[0]?.message?.content ?? "[]";

    let items: CopilotItem[];
    try {
      items = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return new Response(
          JSON.stringify({ error: "AI did not return valid JSON." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      items = JSON.parse(jsonMatch[0]);
    }

    if (!Array.isArray(items)) {
      return new Response(
        JSON.stringify({ error: "AI response was not an array." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sanitized: CopilotItem[] = items.map((item, i) => ({
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
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});