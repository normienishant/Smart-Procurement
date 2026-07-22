import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
    const { tenderId, userInputs } = await req.json();
    if (!tenderId || !userInputs) {
      return new Response(
        JSON.stringify({ error: "Missing tenderId or userInputs." }),
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: analysis, error } = await supabase
      .from("tender_analysis")
      .select("eligibility_requirements")
      .eq("tender_id", tenderId)
      .single();

    if (error || !analysis) {
      throw new Error("No analysis found for this tender.");
    }

    const requirements = analysis.eligibility_requirements;

    const prompt = `You are an eligibility checker for government tenders. Based on the tender's eligibility requirements:
${JSON.stringify(requirements, null, 2)}

And the user's company details:
- Turnover: ${userInputs.turnover || "Not provided"}
- Experience: ${userInputs.experience || "Not provided"} years
- Certifications: ${userInputs.certifications || "None"}
- OEM Authorization: ${userInputs.oem ? "Yes" : "No"}
- MSME Registered: ${userInputs.msme ? "Yes" : "No"}
- Financials: ${userInputs.financials || "Not provided"}

Evaluate eligibility and return a JSON object:
{
  "score": number (0-100),
  "missing_documents": ["list of missing documents"],
  "analysis": "brief explanation of why the score is what it is"
}

Return ONLY valid JSON.`;

    const url = "https://api.groq.com/openai/v1/chat/completions";
    const body = {
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1024,
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
      throw new Error(`Groq API error (${groqRes.status}): ${errText.slice(0, 500)}`);
    }

    const groqData = await groqRes.json();
    const rawText = groqData?.choices?.[0]?.message?.content ?? "{}";

    let result;
    try {
      result = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Invalid JSON from AI");
      result = JSON.parse(match[0]);
    }

    return new Response(
      JSON.stringify({
        score: result.score ?? 0,
        missing_documents: result.missing_documents ?? [],
        analysis: result.analysis ?? "",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});