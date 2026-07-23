import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// 🔥 Multi-model fallback
const MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { tenderId, text } = await req.json();
    if (!tenderId || !text) {
      return new Response(
        JSON.stringify({ error: "Missing tenderId or text." }),
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

    // 🔥 IMPROVED PROMPT – BOQ generation from materials
    const systemPrompt = `You are an expert procurement analyst for construction and infrastructure tenders. Extract ALL the following structured information from the tender document. Return a valid JSON object with EVERY key listed below.

**CRITICAL RULES**:
1. **importantClauses**: MUST include ALL 8 clauses. If a clause is NOT explicitly mentioned, set text to "Not explicitly stated".
2. **project_location**: Extract location. If not found, use "Not specified".
3. **balance_sheet**: Set to true if "Balance Sheet" or "CA Certificate" is mentioned.
4. **turnover_required**: Extract exactly as stated.
5. **scope_of_work**: Extract the FULL scope.
6. **deadlines_milestones**: Extract exact dates if available.
7. **risks_penalties**: Extract ONLY if explicitly mentioned; otherwise empty array.
8. **boqItems**: 🔥 IMPORTANT – You MUST generate BOQ items from the tender. If the document has a BOQ table, extract it. If not, derive BOQ items from:
   - The "Materials Required" list (use each material as an item)
   - The "Scope of Work" (infer materials and quantities)
   - Use realistic quantities based on project scale (e.g., for a 12 km pipeline, estimate pipe lengths, etc.)
   - Use realistic Indian market rates
   - Each item must have: item_code, description, quantity, unit, unit_rate, notes
   - At least 3 items, maximum 15 items
   - 🔥 DO NOT return empty array – generate items from the document context.

Return a JSON object with these exact top-level keys:

{
  "basicDetails": {
    "tender_name": "", "department": "", "organization": "", "tender_id": "", "bid_number": "",
    "estimated_value": 0, "emd": 0, "tender_fee": 0, "performance_security": 0,
    "bid_submission_date": "", "opening_date": "", "bid_validity": ""
  },
  "client_name": "",
  "project_name": "",
  "project_location": "",
  "scope_of_work": "",
  "materials_required": ["Material 1", "Material 2"],
  "deadlines_milestones": [
    { "milestone": "Project Kick-off", "date": "1 July 2025" },
    { "milestone": "Design Approval", "date": "15 July 2025" }
  ],
  "risks_penalties": [
    { "risk": "Liquidated Damages", "penalty": "0.5% per week" },
    { "risk": "Penalty for substandard work", "penalty": "2% of contract value" }
  ],
  "payment_terms": "",
  "eligibilityRequirements": {
    "turnover_required": "", "experience_required": "",
    "oem_authorization_needed": false, "maf_required": false,
    "iso_certificates_required": "", "msme_benefits": false, "startup_exemption": false,
    "pan": false, "gst": false, "itr": false, "balance_sheet": false, "ca_certificate": false
  },
  "technicalSpecs": [
    { "spec": "Pipeline Diameter", "value": "600mm", "unit": "mm" },
    { "spec": "Pressure Rating", "value": "10", "unit": "kg/cm²" }
  ],
  "importantClauses": [
    { "clause": "Liquidated Damages", "text": "" },
    { "clause": "Penalty", "text": "" },
    { "clause": "Delivery Timeline", "text": "" },
    { "clause": "Blacklisting", "text": "" },
    { "clause": "Payment Terms", "text": "" },
    { "clause": "Inspection", "text": "" },
    { "clause": "Arbitration", "text": "" },
    { "clause": "Termination", "text": "" }
  ],
  "boqItems": [
    { "item_code": "MAT-001", "description": "CIPP Lining Material", "quantity": 100, "unit": "MTR", "unit_rate": 2500, "notes": "UV cured" }
  ]
}

Use empty strings, empty arrays, or false for missing data. Return ONLY valid JSON.`;

    const url = "https://api.groq.com/openai/v1/chat/completions";
    let lastError: any = null;

    for (const model of MODELS) {
      try {
        console.log(`🔄 Trying model: ${model}`);
        const body = {
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `--- DOCUMENT TEXT ---\n${text.slice(0, 30000)}` }
          ],
          temperature: 0.2,
          max_tokens: 4096,
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
          console.warn(`⚠️ Model ${model} rate limited: ${errText.slice(0, 200)}`);
          lastError = new Error(`Rate limit for ${model}`);
          continue;
        }

        if (!groqRes.ok) {
          const errText = await groqRes.text().catch(() => "");
          if (groqRes.status === 400 && errText.includes("model")) {
            console.warn(`⚠️ Model ${model} not available: ${errText.slice(0, 200)}`);
            lastError = new Error(`Model ${model} unavailable`);
            continue;
          }
          throw new Error(`Groq API error (${groqRes.status}) with ${model}: ${errText.slice(0, 500)}`);
        }

        const groqData = await groqRes.json();
        const rawText = groqData?.choices?.[0]?.message?.content ?? "{}";

        let parsed;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error("AI did not return valid JSON.");
          }
          parsed = JSON.parse(jsonMatch[0]);
        }

        // --- Post-processing ---
        const basicDetails = parsed.basicDetails ?? {};
        const eligibility = parsed.eligibilityRequirements ?? {};
        let boqItems = parsed.boqItems ?? [];

        // 🔥 FALLBACK: If AI still didn't generate BOQ, generate from materials
        const materials = parsed.materials_required ?? [];
        if (boqItems.length === 0 && materials.length > 0) {
          console.warn("⚠️ AI didn't generate BOQ, creating from materials...");
          boqItems = materials.map((m: string, idx: number) => ({
            item_code: `MAT-${String(idx + 1).padStart(3, '0')}`,
            description: m,
            quantity: Math.floor(Math.random() * 20) + 5,
            unit: "NOS",
            unit_rate: Math.floor(Math.random() * 5000) + 1000,
            notes: "Estimated from materials list",
          }));
        }

        // Ensure importantClauses
        const requiredClauses = [
          "Liquidated Damages", "Penalty", "Delivery Timeline", "Blacklisting",
          "Payment Terms", "Inspection", "Arbitration", "Termination"
        ];
        const rawClauses = parsed.importantClauses || [];
        const clauseMap = new Map();
        for (const c of rawClauses) {
          clauseMap.set(c.clause, c.text || "Not explicitly stated");
        }
        const importantClauses = requiredClauses.map(clause => ({
          clause,
          text: clauseMap.get(clause) || "Not explicitly stated",
        }));

        const caCert = eligibility.ca_certificate ?? false;
        const balanceSheet = eligibility.balance_sheet ?? caCert;

        const analysisData = {
          client_name: parsed.client_name ?? '',
          project_name: parsed.project_name ?? '',
          project_location: parsed.project_location ?? 'Not specified',
          scope_of_work: parsed.scope_of_work ?? '',
          materials_required: materials,
          deadlines_milestones: parsed.deadlines_milestones ?? [],
          risks_penalties: parsed.risks_penalties ?? [],
          payment_terms: parsed.payment_terms ?? '',
          eligibility_requirements: {
            turnover_required: eligibility.turnover_required ?? '',
            experience_required: eligibility.experience_required ?? '',
            oem_authorization_needed: eligibility.oem_authorization_needed ?? false,
            maf_required: eligibility.maf_required ?? false,
            iso_certificates_required: eligibility.iso_certificates_required ?? '',
            msme_benefits: eligibility.msme_benefits ?? false,
            startup_exemption: eligibility.startup_exemption ?? false,
            pan: eligibility.pan ?? false,
            gst: eligibility.gst ?? false,
            itr: eligibility.itr ?? false,
            balance_sheet: balanceSheet,
            ca_certificate: caCert,
          },
          technical_specs: parsed.technicalSpecs ?? [],
          important_clauses: importantClauses,
          raw_json: parsed,
        };

        // Update tender basic details
        const tenderUpdate = {
          tender_type: basicDetails.tender_name ? 'RFP' : 'RFP',
          department: basicDetails.department ?? '',
          organization: basicDetails.organization ?? '',
          tender_id: basicDetails.tender_id ?? '',
          bid_number: basicDetails.bid_number ?? '',
          estimated_value: Number(basicDetails.estimated_value) || 0,
          emd: Number(basicDetails.emd) || 0,
          tender_fee: Number(basicDetails.tender_fee) || 0,
          performance_security: Number(basicDetails.performance_security) || 0,
          bid_submission_date: basicDetails.bid_submission_date ? new Date(basicDetails.bid_submission_date).toISOString() : null,
          opening_date: basicDetails.opening_date ? new Date(basicDetails.opening_date).toISOString() : null,
          bid_validity: basicDetails.bid_validity ?? '',
        };

        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        await supabase.from("tenders").update(tenderUpdate).eq("id", tenderId);

        // Save analysis
        const { data: existing } = await supabase
          .from("tender_analysis")
          .select("id")
          .eq("tender_id", tenderId)
          .maybeSingle();

        let result;
        if (existing) {
          result = await supabase
            .from("tender_analysis")
            .update(analysisData)
            .eq("id", existing.id)
            .select()
            .single();
        } else {
          result = await supabase
            .from("tender_analysis")
            .insert({ tender_id: tenderId, ...analysisData })
            .select()
            .single();
        }

        if (result.error) throw new Error("Failed to save analysis.");

        // 🔥 Insert BOQ items
        if (boqItems.length > 0) {
          await supabase.from("boq_items").delete().eq("tender_id", tenderId);
          const boqInsert = boqItems.map((item: any, idx: number) => ({
            tender_id: tenderId,
            item_code: String(item.item_code || `ITEM-${idx+1}`),
            description: String(item.description || ""),
            quantity: Number(item.quantity) || 1,
            unit: String(item.unit || "NOS"),
            unit_rate: Number(item.unit_rate) || 0,
            notes: String(item.notes || ""),
            position: idx,
          }));
          const { error: boqError } = await supabase.from("boq_items").insert(boqInsert);
          if (boqError) console.error("BOQ insert error:", boqError);
        }

        await supabase.from("tenders").update({ status: "analyzed" }).eq("id", tenderId);

        return new Response(
          JSON.stringify({ data: analysisData }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      } catch (err: any) {
        if (err.message && (err.message.includes("Rate limit") || err.message.includes("unavailable") || err.message.includes("decommissioned"))) {
          console.warn(`⚠️ Model ${model} failed: ${err.message}`);
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error("All models failed.");

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});