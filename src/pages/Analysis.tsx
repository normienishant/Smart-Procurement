import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Sparkles, ArrowLeft, ArrowRight, Loader2, AlertCircle,
  Building2, MapPin, FileText, Calendar, AlertTriangle, CreditCard, Package,
  CheckCircle2, X, Send, Users, Award, FileCheck, ClipboardList,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Tender, TenderAnalysis } from '@/lib/database.types';
import ProgressBar from '@/components/ProgressBar';
import toast from 'react-hot-toast';

type Phase = 'idle' | 'calling' | 'saving' | 'done' | 'error';

// 🔥 Helper to safely parse JSON strings
function safeParseJSON<T>(value: any, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value as T;
}

export default function Analysis() {
  const { tenderId } = useParams<{ tenderId: string }>();
  const navigate = useNavigate();
  const [tender, setTender] = useState<Tender | null>(null);
  const [analysis, setAnalysis] = useState<TenderAnalysis | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingTender, setLoadingTender] = useState(true);

  // Eligibility Checker state
  const [eligibilityOpen, setEligibilityOpen] = useState(false);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityResult, setEligibilityResult] = useState<{ score: number; missing_documents: string[]; analysis: string } | null>(null);
  const [eligibilityForm, setEligibilityForm] = useState({
    turnover: '',
    experience: '',
    certifications: '',
    oem: false,
    msme: false,
    financials: '',
  });

  useEffect(() => {
    async function load() {
      if (!tenderId) return;
      const { data: t } = await supabase.from('tenders').select('*').eq('id', tenderId).maybeSingle();
      setTender(t);
      if (t) {
        const { data: a } = await supabase.from('tender_analysis').select('*').eq('tender_id', t.id).maybeSingle();
        if (a) {
          // 🔥 Parse JSON strings to objects/arrays
          const parsedAnalysis = {
            ...a,
            materials_required: safeParseJSON(a.materials_required, []),
            deadlines_milestones: safeParseJSON(a.deadlines_milestones, []),
            risks_penalties: safeParseJSON(a.risks_penalties, []),
            eligibility_requirements: safeParseJSON(a.eligibility_requirements, {}),
            technical_specs: safeParseJSON(a.technical_specs, []),
            important_clauses: safeParseJSON(a.important_clauses, []),
            raw_json: safeParseJSON(a.raw_json, {}),
          };
          setAnalysis(parsedAnalysis);
          if (t.status === 'uploaded') setPhase('idle');
          else setPhase('done');
        }
      }
      setLoadingTender(false);
    }
    load();
  }, [tenderId]);

  async function runAnalysis() {
    if (!tender) return;
    setPhase('calling');
    setErrorMsg('');

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-tender`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ tenderId: tender.id, text: tender.file_text }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`AI analysis failed (${res.status}). ${errBody}`);
      }

      const result = await res.json();
      if (result.error) throw new Error(result.error);
      if (!result.data) throw new Error('AI returned no data.');

      setPhase('saving');

      const a = result.data;
      // Prepare payload for DB (strings)
      const payload = {
        tender_id: tender.id,
        client_name: a.client_name ?? '',
        project_name: a.project_name ?? '',
        project_location: a.project_location ?? '',
        scope_of_work: a.scope_of_work ?? '',
        materials_required: JSON.stringify(a.materials_required ?? []),
        deadlines_milestones: JSON.stringify(a.deadlines_milestones ?? []),
        risks_penalties: JSON.stringify(a.risks_penalties ?? []),
        payment_terms: a.payment_terms ?? '',
        eligibility_requirements: JSON.stringify(a.eligibility_requirements ?? {}),
        technical_specs: JSON.stringify(a.technical_specs ?? []),
        important_clauses: JSON.stringify(a.important_clauses ?? []),
        raw_json: JSON.stringify(a.raw_json ?? a),
      };

      const { data: existing } = await supabase
        .from('tender_analysis').select('id').eq('tender_id', tender.id).maybeSingle();

      let upsertRes;
      if (existing) {
        upsertRes = await supabase.from('tender_analysis').update(payload).eq('id', existing.id).select().single();
      } else {
        upsertRes = await supabase.from('tender_analysis').insert(payload).select().single();
      }

      if (upsertRes.error || !upsertRes.data) throw new Error('Failed to save analysis to database.');

      const saved = upsertRes.data;
      // 🔥 Parse saved data into structured objects/arrays
      const parsedSaved = {
        ...saved,
        materials_required: safeParseJSON(saved.materials_required, []),
        deadlines_milestones: safeParseJSON(saved.deadlines_milestones, []),
        risks_penalties: safeParseJSON(saved.risks_penalties, []),
        eligibility_requirements: safeParseJSON(saved.eligibility_requirements, {}),
        technical_specs: safeParseJSON(saved.technical_specs, []),
        important_clauses: safeParseJSON(saved.important_clauses, []),
        raw_json: safeParseJSON(saved.raw_json, {}),
      };
      setAnalysis(parsedSaved);

      await supabase.from('tenders').update({ status: 'analyzed' }).eq('id', tender.id);
      setTender({ ...tender, status: 'analyzed' });
      setPhase('done');
      toast.success('Analysis complete!');
    } catch (err) {
      console.error('Analysis error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error.');
      setPhase('error');
      toast.error(err instanceof Error ? err.message : 'Unknown error.');
    }
  }

  async function checkEligibility() {
    setEligibilityLoading(true);
    setEligibilityResult(null);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-eligibility`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          tenderId: tender?.id,
          userInputs: eligibilityForm,
        }),
      });
      if (!res.ok) throw new Error(`Eligibility check failed (${res.status})`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEligibilityResult(data);
    } catch (err) {
      setEligibilityResult({ score: 0, missing_documents: [], analysis: 'Error: ' + (err instanceof Error ? err.message : 'Unknown') });
    } finally {
      setEligibilityLoading(false);
    }
  }

  if (loadingTender) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="h-8 w-64 bg-[#2a2a2a] rounded mb-4 animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-[#1a1a1a] rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="mt-6 h-48 bg-[#1a1a1a] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!tender) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-sm text-[#a3a3a3]">Tender not found.</p>
        <button onClick={() => navigate('/')} className="text-xs text-[#f97316] mt-2">← Back to Dashboard</button>
      </div>
    );
  }

  // Helper to safely access raw_json
  const raw = analysis?.raw_json || {};
  const basicDetails = raw.basicDetails || {};
  const eligibilityReqs = analysis?.eligibility_requirements || {};

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <ProgressBar step={1} />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-[#f97316]" />
            <p className="text-xs font-semibold tracking-widest uppercase text-[#f97316]">Step 2 of 5</p>
          </div>
          <h1 className="text-2xl font-bold text-[#f5f5f5]">AI Tender Analysis</h1>
          <p className="text-sm text-[#a3a3a3] mt-1">{tender.title}</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs text-[#525252] hover:text-[#f5f5f5] transition-colors"
        >
          <ArrowLeft size={14} /> Dashboard
        </button>
      </div>

      {/* Idle / Error */}
      {(phase === 'idle' || phase === 'error') && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#1c1c1c] bg-gradient-to-br from-[#111111] to-[#0d0d0d] p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#f97316]/10 flex items-center justify-center mx-auto mb-5">
              <Sparkles size={28} className="text-[#f97316]" />
            </div>
            <h2 className="text-lg font-semibold text-[#f5f5f5] mb-2">Ready for AI Extraction</h2>
            <p className="text-sm text-[#a3a3a3] max-w-md mx-auto mb-6">
              Groq AI (Llama 3.3) will analyze the tender document and extract all details.
            </p>
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 mb-4 max-w-md mx-auto">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400 text-left">{errorMsg}</p>
              </div>
            )}
            <button
              onClick={runAnalysis}
              className="px-6 py-3 rounded-xl font-semibold text-sm bg-[#f97316] hover:bg-[#ea6c0a] text-white transition-colors inline-flex items-center gap-2"
            >
              <Sparkles size={15} /> Run AI Analysis
            </button>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#525252] mb-2">Document Text Preview</p>
            <div className="rounded-xl border border-[#1c1c1c] bg-[#111111] p-4 max-h-48 overflow-y-auto">
              <p className="text-xs text-[#a3a3a3] whitespace-pre-wrap font-mono leading-relaxed">
                {tender.file_text.slice(0, 2000) || '[No extractable text found]'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Calling / Saving */}
      {(phase === 'calling' || phase === 'saving') && (
        <div className="rounded-xl border border-[#1c1c1c] bg-[#111111] p-16 text-center">
          <Loader2 size={32} className="animate-spin text-[#f97316] mx-auto mb-4" />
          <p className="text-sm font-medium text-[#f5f5f5]">
            {phase === 'calling' ? 'AI is analyzing the document…' : 'Saving extracted data…'}
          </p>
        </div>
      )}

      {/* Done: Show results */}
      {phase === 'done' && analysis && (
        <div className="space-y-5">
          {/* Success banner */}
          <div className="flex items-center justify-between rounded-xl bg-green-500/10 border border-green-500/20 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
                <Sparkles size={16} className="text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-400">Analysis Complete</p>
                <p className="text-xs text-[#a3a3a3]">Review all extracted data below, then proceed to BOQ.</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/boq/${tender.id}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-medium transition-colors"
            >
              Proceed to BOQ <ArrowRight size={14} />
            </button>
          </div>

          {/* Existing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard icon={<Building2 size={16} />} label="Client Name" value={analysis.client_name} />
            <InfoCard icon={<FileText size={16} />} label="Project Name" value={analysis.project_name} />
            <InfoCard icon={<MapPin size={16} />} label="Project Location" value={analysis.project_location} />
            <InfoCard icon={<CreditCard size={16} />} label="Payment Terms" value={analysis.payment_terms} />
          </div>

          {/* Scope of Work */}
          <SectionCard icon={<FileText size={16} />} label="Scope of Work">
            <p className="text-sm text-[#d4d4d4] leading-relaxed whitespace-pre-wrap">
              {analysis.scope_of_work || '—'}
            </p>
          </SectionCard>

          {/* Materials */}
          {analysis.materials_required && analysis.materials_required.length > 0 && (
            <SectionCard icon={<Package size={16} />} label="Materials Required">
              <div className="flex flex-wrap gap-2">
                {analysis.materials_required.map((m, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#242424] text-xs text-[#d4d4d4]">
                    {typeof m === 'string' ? m : JSON.stringify(m)}
                  </span>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Deadlines */}
          {analysis.deadlines_milestones && analysis.deadlines_milestones.length > 0 && (
            <SectionCard icon={<Calendar size={16} />} label="Deadlines & Milestones">
              <div className="space-y-2">
                {analysis.deadlines_milestones.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#1c1c1c]">
                    <Calendar size={12} className="text-[#f97316] flex-shrink-0" />
                    <span className="text-sm text-[#d4d4d4]">{d.milestone || d.label || '—'}</span>
                    <span className="text-xs text-[#525252] ml-auto">{d.date || d.deadline || '—'}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Risks */}
          {analysis.risks_penalties && analysis.risks_penalties.length > 0 && (
            <SectionCard icon={<AlertTriangle size={16} />} label="Risks & Penalties">
              <div className="space-y-2">
                {analysis.risks_penalties.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                    <AlertTriangle size={12} className="text-red-400 flex-shrink-0 mt-1" />
                    <div>
                      <p className="text-sm text-[#d4d4d4]">{r.risk || r.description || '—'}</p>
                      {r.penalty && <p className="text-xs text-[#a3a3a3] mt-0.5">Penalty: {r.penalty}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ===== NEW SECTIONS (with Tooltips) ===== */}

          {/* Basic Details (from tender table) */}
          {(tender.department || tender.organization || tender.tender_id) && (
            <SectionCard icon={<ClipboardList size={16} />} label="Basic Details">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {tender.tender_type && <DetailItem label="Tender Type" value={tender.tender_type} />}
                {tender.department && <DetailItem label="Department" value={tender.department} />}
                {tender.organization && <DetailItem label="Organization" value={tender.organization} />}
                {tender.tender_id && <DetailItem label="Tender ID" value={tender.tender_id} />}
                {tender.bid_number && <DetailItem label="Bid Number" value={tender.bid_number} />}
                {tender.estimated_value !== undefined && tender.estimated_value > 0 && (
                  <DetailItem label="Estimated Value" value={`₹${tender.estimated_value.toLocaleString('en-IN')}`} />
                )}
                {tender.emd !== undefined && tender.emd > 0 && (
                  <DetailItem label="EMD" value={`₹${tender.emd.toLocaleString('en-IN')}`} />
                )}
                {tender.tender_fee !== undefined && tender.tender_fee > 0 && (
                  <DetailItem label="Tender Fee" value={`₹${tender.tender_fee.toLocaleString('en-IN')}`} />
                )}
                {tender.performance_security !== undefined && tender.performance_security > 0 && (
                  <DetailItem label="Performance Security" value={`₹${tender.performance_security.toLocaleString('en-IN')}`} />
                )}
                {tender.bid_submission_date && (
                  <DetailItem label="Bid Submission Date" value={new Date(tender.bid_submission_date).toLocaleDateString('en-IN')} />
                )}
                {tender.opening_date && (
                  <DetailItem label="Opening Date" value={new Date(tender.opening_date).toLocaleDateString('en-IN')} />
                )}
                {tender.bid_validity && <DetailItem label="Bid Validity" value={tender.bid_validity} />}
              </div>
            </SectionCard>
          )}

          {/* Eligibility Requirements (with tooltips) */}
          {Object.keys(eligibilityReqs).length > 0 && (
            <SectionCard icon={<Users size={16} />} label="Eligibility Requirements">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailItem label="Turnover Required" value={eligibilityReqs.turnover_required} />
                <DetailItem label="Experience Required" value={eligibilityReqs.experience_required} />
                <DetailItem label="OEM Authorization" value={eligibilityReqs.oem_authorization_needed ? 'Yes' : 'No'} title="OEM Authorization required?" />
                <DetailItem label="MAF Required" value={eligibilityReqs.maf_required ? 'Yes' : 'No'} title="MAF (Mobilisation Advance Fund) required?" />
                <DetailItem label="ISO Certificates" value={eligibilityReqs.iso_certificates_required} />
                <DetailItem label="MSME Benefits" value={eligibilityReqs.msme_benefits ? 'Yes' : 'No'} title="MSME benefits available?" />
                <DetailItem label="Startup Exemption" value={eligibilityReqs.startup_exemption ? 'Yes' : 'No'} title="Startup exemption available?" />
                <DetailItem label="PAN Required" value={eligibilityReqs.pan ? 'Yes' : 'No'} title="PAN required?" />
                <DetailItem label="GST Required" value={eligibilityReqs.gst ? 'Yes' : 'No'} title="GST required?" />
                <DetailItem label="ITR Required" value={eligibilityReqs.itr ? 'Yes' : 'No'} title="ITR required?" />
                <DetailItem label="Balance Sheet" value={eligibilityReqs.balance_sheet ? 'Yes' : 'No'} title="Balance Sheet required?" />
                <DetailItem label="CA Certificate" value={eligibilityReqs.ca_certificate ? 'Yes' : 'No'} title="CA Certificate required?" />
              </div>
            </SectionCard>
          )}

          {/* Technical Specifications */}
          {analysis.technical_specs && analysis.technical_specs.length > 0 && (
            <SectionCard icon={<Award size={16} />} label="Technical Specifications">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[#525252] border-b border-[#1c1c1c]">
                    <th className="pb-2 font-semibold">Specification</th>
                    <th className="pb-2 font-semibold">Value</th>
                    <th className="pb-2 font-semibold">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.technical_specs.map((spec, i) => (
                    <tr key={i} className="border-b border-[#1c1c1c] last:border-0">
                      <td className="py-2 text-[#d4d4d4]">{spec.spec || '—'}</td>
                      <td className="py-2 text-[#d4d4d4]">{spec.value || '—'}</td>
                      <td className="py-2 text-[#d4d4d4]">{spec.unit || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          )}

          {/* Important Clauses (with tooltips) */}
          {analysis.important_clauses && analysis.important_clauses.length > 0 && (
            <SectionCard icon={<FileCheck size={16} />} label="Important Clauses">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analysis.important_clauses.map((clause, i) => (
                  <div key={i} className="p-3 rounded-lg bg-[#1a1a1a] border border-[#242424]" title={clause.text}>
                    <p className="text-xs font-semibold text-[#f97316] uppercase tracking-wider">{clause.clause || '—'}</p>
                    <p className="text-sm text-[#d4d4d4] mt-1">{clause.text || 'Not found'}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Re-run & Eligibility Checker */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#1c1c1c]">
            <button
              onClick={runAnalysis}
              className="text-xs text-[#525252] hover:text-[#f97316] transition-colors flex items-center gap-1.5"
            >
              <Sparkles size={12} /> Re-run Analysis
            </button>
            <button
              onClick={() => setEligibilityOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316]/10 hover:bg-[#f97316]/20 border border-[#f97316]/20 text-[#f97316] text-sm font-medium transition-colors"
            >
              <CheckCircle2 size={14} /> Can I Apply?
            </button>
          </div>

          {/* Proceed to BOQ */}
          <button
            onClick={() => navigate(`/boq/${tender.id}`)}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm bg-[#f97316] hover:bg-[#ea6c0a] text-white transition-colors"
          >
            Proceed to BOQ <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* Eligibility Checker Modal */}
      {eligibilityOpen && (
        <div className="fixed inset-0 z-50 flex justify-center items-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setEligibilityOpen(false); setEligibilityResult(null); }} />
          <div className="relative w-full max-w-lg bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-[#f97316]" />
                <h2 className="text-lg font-semibold text-[#f5f5f5]">Eligibility Checker</h2>
              </div>
              <button onClick={() => { setEligibilityOpen(false); setEligibilityResult(null); }} className="p-1.5 rounded-md hover:bg-[#ffffff10] text-[#525252]">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-[#a3a3a3] mb-4">
              Provide your company details to check eligibility for this tender.
            </p>

            {!eligibilityResult ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-[#525252] mb-1.5">Turnover (₹)</label>
                  <input
                    type="text"
                    value={eligibilityForm.turnover}
                    onChange={(e) => setEligibilityForm({ ...eligibilityForm, turnover: e.target.value })}
                    placeholder="e.g. 10 Crore"
                    className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-[#242424] text-sm text-[#f5f5f5] placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-[#525252] mb-1.5">Experience (years)</label>
                  <input
                    type="number"
                    value={eligibilityForm.experience}
                    onChange={(e) => setEligibilityForm({ ...eligibilityForm, experience: e.target.value })}
                    placeholder="5"
                    className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-[#242424] text-sm text-[#f5f5f5] placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-[#525252] mb-1.5">Certifications</label>
                  <input
                    type="text"
                    value={eligibilityForm.certifications}
                    onChange={(e) => setEligibilityForm({ ...eligibilityForm, certifications: e.target.value })}
                    placeholder="ISO 9001, ISO 14001"
                    className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-[#242424] text-sm text-[#f5f5f5] placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-[#d4d4d4]">
                    <input
                      type="checkbox"
                      checked={eligibilityForm.oem}
                      onChange={(e) => setEligibilityForm({ ...eligibilityForm, oem: e.target.checked })}
                      className="w-4 h-4 rounded border-[#242424] bg-[#111111] text-[#f97316] focus:ring-[#f97316]/20"
                    />
                    OEM Authorization
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[#d4d4d4]">
                    <input
                      type="checkbox"
                      checked={eligibilityForm.msme}
                      onChange={(e) => setEligibilityForm({ ...eligibilityForm, msme: e.target.checked })}
                      className="w-4 h-4 rounded border-[#242424] bg-[#111111] text-[#f97316] focus:ring-[#f97316]/20"
                    />
                    MSME Registered
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-[#525252] mb-1.5">Financials / Other Details</label>
                  <textarea
                    value={eligibilityForm.financials}
                    onChange={(e) => setEligibilityForm({ ...eligibilityForm, financials: e.target.value })}
                    placeholder="Any additional financial info..."
                    className="w-full h-16 px-3 py-2 rounded-lg bg-[#111111] border border-[#242424] text-sm text-[#f5f5f5] placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50 resize-none"
                  />
                </div>
                <button
                  onClick={checkEligibility}
                  disabled={eligibilityLoading}
                  className="w-full py-2.5 rounded-xl bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {eligibilityLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {eligibilityLoading ? 'Checking...' : 'Check Eligibility'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-[#f97316]/10 flex items-center justify-center mx-auto mb-2 border border-[#f97316]/20">
                    <span className="text-3xl font-bold text-[#f97316]">{eligibilityResult.score}%</span>
                  </div>
                  <p className="text-xs text-[#a3a3a3]">Eligibility Score</p>
                </div>
                {eligibilityResult.missing_documents.length > 0 && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                    <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Missing Documents</p>
                    <ul className="list-disc list-inside text-xs text-red-300 mt-1">
                      {eligibilityResult.missing_documents.map((doc, i) => (
                        <li key={i}>{doc}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {eligibilityResult.analysis && (
                  <div className="rounded-lg bg-[#1a1a1a] p-3">
                    <p className="text-xs text-[#a3a3a3]">{eligibilityResult.analysis}</p>
                  </div>
                )}
                <button
                  onClick={() => setEligibilityResult(null)}
                  className="w-full py-2.5 rounded-xl border border-[#242424] hover:border-[#f97316]/30 text-[#a3a3a3] hover:text-[#f97316] text-sm font-medium transition-colors"
                >
                  Check Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components
function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#1c1c1c] bg-[#111111] p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-[#525252]">{icon}</div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#525252]">{label}</p>
      </div>
      <p className="text-sm text-[#f5f5f5]">{value || '—'}</p>
    </div>
  );
}

function SectionCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1c1c1c] bg-[#111111] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[#f97316]">{icon}</div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#f5f5f5]">{label}</p>
      </div>
      {children}
    </div>
  );
}

function DetailItem({ label, value, title }: { label: string; value: string | number; title?: string }) {
  return (
    <div className="flex items-start gap-2" title={title}>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] min-w-[120px]">{label}</span>
      <span className="text-sm text-[#d4d4d4]">{value || '—'}</span>
    </div>
  );
}