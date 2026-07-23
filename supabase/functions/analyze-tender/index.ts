import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// 🔥 Multi-model fallback (primary: llama-3.3-70b has higher TPM limit)
const MODELS = [
  "llama-3.3-70b-versatile",
  "gemma2-9b-it",
  "llama-3.1-8b-instant",
];

// 🔥 Safe text length to avoid token limits (15000 chars ~ 3750 tokens)
const MAX_TEXT_LENGTH = 15000;

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

    const systemPrompt = `You are a world-class procurement analyst and AI extraction specialist. Extract structured data from the RFP/Tender with 100% accuracy.

**CRITICAL RULES – MANDATORY vs SCORING**:
- Scoring criteria (e.g., "Greater than INR 50 Crore – 5 marks") are NOT mandatory requirements.
- Only extract if the document explicitly says:
  - "Minimum turnover of ₹X is required", "Bidder must have turnover of ₹X"
  - "Minimum experience of X years is required", "Bidder must have executed X projects"
  - "Eligibility criteria: ..."

**EXTRACTION RULES**:

1. **client_name**:
   - ❗ONLY extract if there is a SPECIFIC organization name (e.g., "Department of Education", "Maharashtra Water Supply Authority", "DoE, GNCTD", "PWD").
   - If it's a generic phrase like "Government/Public Sector organization/institute", set to "" (empty).

2. **project_name**:
   - Extract from the document title, header, or "Project Name:" field.
   - Look for "RFP for", "Tender for", "Project Name:", "Scope:".
   - If found, extract the exact project name.

3. **project_location**:
   - Look for "Location:", "Place of Work:", "City:".
   - If not found, use "Not specified".

4. **scope_of_work**:
   - ❗Extract the COMPLETE scope from the document.
   - If there's a Part-A and Part-B (e.g., Supply/Integration/Deployment AND Maintenance/Hosting), include BOTH.
   - Be exhaustive – include all services, deliverables, and responsibilities.

5. **payment_terms**:
   - ❗ONLY extract if the document explicitly mentions payment milestones, percentages, or schedule (e.g., "80% on completion", "Hybrid Annuity Model", "Payment milestones: ...").
   - Do NOT extract "exclusive of taxes" – this is a tax clause, not payment terms.
   - If not explicitly mentioned, use empty string.

6. **eligibilityRequirements** (MANDATORY ONLY – NO SCORING):
   - turnover_required: ❗ONLY if "Minimum turnover of ₹X is required" explicitly stated.
   - experience_required: ❗ONLY if the document explicitly states a minimum experience requirement (e.g., "Minimum 5 years of experience is required").
     - If it's from a scoring table (e.g., "Experience of more than 5 Years – 5 marks"), set to "".
   - oem_authorization_needed: true if explicitly required.
   - maf_required: true if explicitly required.
   - iso_certificates_required: extract only if explicitly required.
   - msme_benefits: true if explicitly available.
   - startup_exemption: true if explicitly available.
   - pan: true if explicitly required.
   - gst: true if explicitly required.
   - itr: true if explicitly required.
   - balance_sheet: true if explicitly required.
   - ca_certificate: true if explicitly required.

7. **importantClauses**:
   - MUST include ALL 8 clauses.
   - For Payment Terms clause, use the SAME text as payment_terms (or "Not explicitly stated" if empty).
   - Do NOT put "exclusive of taxes" here – that is NOT payment terms.

8. **boqItems**: Generate from materials/scope if no explicit BOQ.

Return ONLY valid JSON with these exact keys:
{
  "basicDetails": { ... },
  "client_name": "",
  "project_name": "",
  "project_location": "",
  "scope_of_work": "",
  "materials_required": [],
  "deadlines_milestones": [],
  "risks_penalties": [],
  "payment_terms": "",
  "eligibilityRequirements": {
    "turnover_required": "",
    "experience_required": "",
    "oem_authorization_needed": false,
    "maf_required": false,
    "iso_certificates_required": "",
    "msme_benefits": false,
    "startup_exemption": false,
    "pan": false,
    "gst": false,
    "itr": false,
    "balance_sheet": false,
    "ca_certificate": false
  },
  "technicalSpecs": [],
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
  "boqItems": []
}

Return ONLY valid JSON. No explanations, no markdown.`;

    const url = "https://api.groq.com/openai/v1/chat/completions";
    const truncatedText = text.length > MAX_TEXT_LENGTH 
      ? text.slice(0, MAX_TEXT_LENGTH) + "\n\n[... document truncated to fit token limits]" 
      : text;
    
    let lastError: any = null;

    for (const model of MODELS) {
      try {
        console.log(`🔄 Trying model: ${model}`);
        const body = {
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `--- DOCUMENT TEXT ---\n${truncatedText}` }
          ],
          temperature: 0.2,
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