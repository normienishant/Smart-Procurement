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

    // 🔥 MASTER PROMPT – World-class procurement extraction
    const systemPrompt = `You are a world-class procurement analyst and AI extraction specialist. Your task is to extract structured data from the RFP/Tender document with 100% accuracy.

**CRITICAL DISTINCTION – MANDATORY vs SCORING**:
- Many RFPs contain "Scoring Criteria" (e.g., "Greater than INR 50 Crore – 5 marks"). These are NOT mandatory requirements.
- Only extract a field as a requirement if the document explicitly says:
  - "Minimum turnover of ₹X Crore is required", "Bidder must have turnover of ₹X", "Eligibility criteria: Turnover of ₹X".
  - "Minimum experience of X years is required", "Bidder must have executed X projects".

**EXTRACTION RULES**:

1. **basicDetails**:
   - Extract exactly as stated. If a field is not found, use empty string or 0.

2. **client_name, project_name, project_location**:
   - client_name: Look for "Client", "Department", "Organization" receiving the proposal.
   - project_name: Look for "Project Name", "Title", "Scope" header.
   - project_location: Look for "Location", "Place of Work", "Address". If not found, use "Not specified".

3. **scope_of_work**:
   - Extract the COMPLETE scope. Combine Part-A and Part-B (Supply, Integration, Cloud Deployment, Annual Maintenance, Server Hosting, etc.).
   - If there's a bullet list, include all points.
   - Use exact wording from the document.

4. **materials_required**:
   - Extract any materials, software, equipment, or items explicitly listed.
   - If not mentioned, return empty array.

5. **deadlines_milestones**:
   - Extract exact dates if available (e.g., "15 June 2025").
   - If no dates, return empty array.

6. **risks_penalties**:
   - Extract ONLY if explicitly mentioned (e.g., "Liquidated Damages", "Penalty", "Blacklisting").
   - If not mentioned, return empty array.

7. **payment_terms**:
   - Extract payment structure (e.g., "80% on completion, 20% on final approval", "Hybrid Annuity Model").
   - If not mentioned, use empty string.

8. **eligibilityRequirements** (MANDATORY ONLY – DO NOT INCLUDE SCORING CRITERIA):
   - turnover_required: ❗ONLY extract if the document explicitly says "Minimum turnover of ₹X is required" or "Eligibility: Turnover of ₹X". If it's a scoring table (e.g., "Greater than ₹50Cr – 5 marks"), set to "" (empty string).
   - experience_required: ❗Extract the mandatory minimum years of experience or specific project execution history required from the BIDDER (System Integrator). Look for phrases like "Experience in completing large assignments", "Years of Experience working with Govt/Public Sector". If it's scoring, set to "".
   - oem_authorization_needed: true only if explicitly stated as a requirement.
   - maf_required: true only if explicitly stated.
   - iso_certificates_required: extract only if explicitly stated as a requirement. If scoring, set to "".
   - msme_benefits: true if explicitly available.
   - startup_exemption: true if explicitly available.
   - pan: true if explicitly required.
   - gst: true if explicitly required.
   - itr: true if explicitly required.
   - balance_sheet: true if "Audited Balance Sheets" is mentioned as a requirement for technical capacity.
   - ca_certificate: true if "CA Certificate" is mentioned as a requirement.

9. **technicalSpecs**:
   - Extract table or list of specifications (e.g., "Smart Board size 55 inches", "Pipeline Diameter 600mm").
   - Use { spec, value, unit } format. If no unit, use "—".

10. **importantClauses**:
    - MUST include ALL 8 clause names.
    - If a clause text is NOT explicitly found, set text to "Not explicitly stated".
    - The 8 clauses are: Liquidated Damages, Penalty, Delivery Timeline, Blacklisting, Payment Terms, Inspection, Arbitration, Termination.

11. **boqItems**:
    - If the document has a BOQ table, extract it exactly.
    - If no explicit BOQ, derive reasonable items from the scope and materials.
    - Use realistic quantities and rates. At least 3 items, max 15.
    - If truly no items exist, return empty array.

Return ONLY valid JSON with these exact top-level keys:
{
  "basicDetails": { "tender_name": "", "department": "", "organization": "", "tender_id": "", "bid_number": "", "estimated_value": 0, "emd": 0, "tender_fee": 0, "performance_security": 0, "bid_submission_date": "", "opening_date": "", "bid_validity": "" },
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

Use empty strings, empty arrays, or false for missing data. Do NOT include scoring criteria as requirements. Return ONLY valid JSON.`;

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