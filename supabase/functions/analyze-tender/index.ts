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

    const systemPrompt = `You are an expert procurement analyst for construction and infrastructure tenders. Extract ALL the following structured information from the tender document. Return a valid JSON object with EVERY key listed below – use empty strings, empty arrays, or false if data is missing.

Important: The JSON must have these exact top-level keys. Do not omit any.

{
  "basicDetails": {
    "tender_name": "",
    "department": "",
    "organization": "",
    "tender_id": "",
    "bid_number": "",
    "estimated_value": 0,
    "emd": 0,
    "tender_fee": 0,
    "performance_security": 0,
    "bid_submission_date": "",
    "opening_date": "",
    "bid_validity": ""
  },
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
  "importantClauses": [],
  "boqItems": [
    { "item_code": "", "description": "", "quantity": 0, "unit": "NOS", "unit_rate": 0, "notes": "" }
  ]
}

Extract:
- basicDetails: all 12 fields from the document.
- client_name, project_name, project_location, scope_of_work.
- materials_required: array of material names.
- deadlines_milestones: array of {milestone, date}.
- risks_penalties: array of {risk, penalty}.
- payment_terms.
- eligibilityRequirements: all 12 boolean/string fields.
- technicalSpecs: array of {spec, value, unit}.
- importantClauses: array of {clause, text}.
- boqItems: array of line items with at least 3-5 items based on the materials and typical quantities/rates from the document. Use realistic Indian rates.

Return ONLY valid JSON.`;

    const url = "https://api.groq.com/openai/v1/chat/completions";
    const body = {
      model: "llama-3.3-70b-versatile",
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

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `Groq API error (${groqRes.status}): ${errText.slice(0, 500)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqRes.json();
    const rawText = groqData?.choices?.[0]?.message?.content ?? "{}";

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return new Response(
          JSON.stringify({ error: "AI did not return valid JSON." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    const basicDetails = parsed.basicDetails ?? {};
    const eligibility = parsed.eligibilityRequirements ?? {};
    const boqItems = parsed.boqItems ?? [];

    const analysisData = {
      client_name: parsed.client_name ?? '',
      project_name: parsed.project_name ?? '',
      project_location: parsed.project_location ?? '',
      scope_of_work: parsed.scope_of_work ?? '',
      materials_required: parsed.materials_required ?? [],
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
        balance_sheet: eligibility.balance_sheet ?? false,
        ca_certificate: eligibility.ca_certificate ?? false,
      },
      technical_specs: parsed.technicalSpecs ?? [],
      important_clauses: parsed.importantClauses ?? [],
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

    // --- Insert BOQ items ---
    if (boqItems.length > 0) {
      // Delete existing boq items for this tender (avoid duplicates)
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
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});