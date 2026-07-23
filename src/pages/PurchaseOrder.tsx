import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ShoppingCart, ArrowLeft, Loader2, CheckCircle2, Send,
  Building2, Calendar, FileText, AlertCircle, Download, Copy,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { BOQItem, Tender, TenderAnalysis } from '@/lib/database.types';
import ProgressBar from '@/components/ProgressBar';
import toast from 'react-hot-toast';

export default function PurchaseOrder() {
  const { tenderId } = useParams<{ tenderId: string }>();
  const navigate = useNavigate();
  const [tender, setTender] = useState<Tender | null>(null);
  const [analysis, setAnalysis] = useState<TenderAnalysis | null>(null);
  const [items, setItems] = useState<BOQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [includeGST, setIncludeGST] = useState(false);

  const [po, setPO] = useState({
    poNumber: `PO-${Date.now().toString().slice(-6)}`,
    vendorName: '',
    vendorEmail: '',
    deliveryDate: '',
    notes: '',
  });

  useEffect(() => {
    async function load() {
      if (!tenderId) return;
      const [tRes, aRes, iRes] = await Promise.all([
        supabase.from('tenders').select('*').eq('id', tenderId).maybeSingle(),
        supabase.from('tender_analysis').select('*').eq('tender_id', tenderId).maybeSingle(),
        supabase.from('boq_items').select('*').eq('tender_id', tenderId).order('position', { ascending: true }),
      ]);

      setTender(tRes.data);
      if (aRes.data) {
        setAnalysis({
          ...aRes.data,
          materials_required: Array.isArray(aRes.data.materials_required) ? aRes.data.materials_required : [],
          deadlines_milestones: Array.isArray(aRes.data.deadlines_milestones) ? aRes.data.deadlines_milestones : [],
          risks_penalties: Array.isArray(aRes.data.risks_penalties) ? aRes.data.risks_penalties : [],
        });
      }
      setItems((iRes.data as BOQItem[]) ?? []);
      setLoading(false);
    }
    load();
  }, [tenderId]);

  const grandTotal = items.reduce((sum, i) => sum + Number(i.total_amount), 0);
  const totalWithGST = includeGST ? grandTotal * 1.18 : grandTotal;

  async function handleSubmit() {
    if (!tenderId) return;
    setSubmitting(true);
    await supabase.from('tenders').update({ status: 'submitted' }).eq('id', tenderId);
    setTender(t => t ? { ...t, status: 'submitted' } : t);
    setSubmitting(false);
    setSubmitted(true);
    toast.success('PO submitted successfully!');
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success('PO link copied!');
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-[#525252]" />
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

  // 🔥 SUBMITTED PAGE – with printable content
  if (submitted) {
    return (
      <div className="p-8 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div id="printable-po" className="w-full">
          {/* Print Styles for submitted page */}
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              #printable-po, #printable-po * { visibility: visible !important; }
              #printable-po { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; color: black !important; padding: 40px !important; }
              .no-print { display: none !important; }
            }
          `}</style>

          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={32} className="text-green-400" />
            </div>
            <h1 className="text-xl font-bold text-[#f5f5f5] mb-2">Purchase Order Submitted</h1>
            <p className="text-sm text-[#a3a3a3] text-center mb-1">
              PO <span className="font-mono text-[#f97316]">{po.poNumber}</span> has been generated and marked as submitted.
            </p>
            <p className="text-xs text-[#525252] mb-6">
              Total value: {totalWithGST.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
            </p>
          </div>

          {/* BOQ Summary Table */}
          {items.length > 0 && (
            <div className="mt-6 border-t border-[#1c1c1c] pt-4">
              <h3 className="text-sm font-semibold text-[#f5f5f5] mb-3">BOQ Summary</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1c1c1c]">
                    <th className="text-left py-2 text-[#525252]">Item</th>
                    <th className="text-right py-2 text-[#525252]">Qty</th>
                    <th className="text-right py-2 text-[#525252]">Rate</th>
                    <th className="text-right py-2 text-[#525252]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 5).map((item) => (
                    <tr key={item.id} className="border-b border-[#1c1c1c] last:border-0">
                      <td className="py-2 text-[#d4d4d4]">{item.description}</td>
                      <td className="py-2 text-right text-[#d4d4d4]">{item.quantity}</td>
                      <td className="py-2 text-right text-[#d4d4d4]">₹{Number(item.unit_rate).toLocaleString()}</td>
                      <td className="py-2 text-right text-[#d4d4d4]">₹{Number(item.total_amount).toLocaleString()}</td>
                    </tr>
                  ))}
                  {items.length > 5 && (
                    <tr>
                      <td colSpan={4} className="py-2 text-center text-[#525252] text-xs">+ {items.length - 5} more items</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#1c1c1c] font-bold">
                    <td colSpan={3} className="py-2 text-right text-[#f5f5f5]">Grand Total</td>
                    <td className="py-2 text-right text-[#f97316]">₹{totalWithGST.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Buttons – Hidden in print */}
        <div className="flex flex-wrap gap-3 mt-6 no-print">
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-xl bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-medium transition-colors"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => window.print()}
            className="px-5 py-2.5 rounded-xl border border-[#242424] hover:border-[#f97316]/30 text-[#a3a3a3] hover:text-[#f97316] text-sm transition-colors flex items-center gap-2"
          >
            <Download size={16} /> Download PDF
          </button>
          <button
            onClick={copyLink}
            className="px-5 py-2.5 rounded-xl border border-[#242424] hover:border-[#f97316]/30 text-[#a3a3a3] hover:text-[#f97316] text-sm transition-colors flex items-center gap-2"
          >
            <Copy size={16} /> Copy Link
          </button>
        </div>
      </div>
    );
  }

  // 🔥 MAIN PO PAGE (before submit)
  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable-po, #printable-po * { visibility: visible !important; }
          #printable-po { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; color: black !important; padding: 20px !important; }
          #printable-po .bg-\\[\\#111111\\] { background: white !important; border-color: #ddd !important; }
          #printable-po .bg-\\[\\#0d0d0d\\] { background: #f5f5f5 !important; border-color: #ddd !important; }
          #printable-po .text-\\[\\#f5f5f5\\] { color: black !important; }
          #printable-po .text-\\[\\#a3a3a3\\] { color: #555 !important; }
          #printable-po .text-\\[\\#525252\\] { color: #666 !important; }
          #printable-po .text-\\[\\#d4d4d4\\] { color: #222 !important; }
          #printable-po .border-\\[\\#1c1c1c\\] { border-color: #ddd !important; }
          #printable-po .border-\\[\\#242424\\] { border-color: #ddd !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <ProgressBar step={3} />

      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart size={14} className="text-[#f97316]" />
            <p className="text-xs font-semibold tracking-widest uppercase text-[#f97316]">Step 4 of 5</p>
          </div>
          <h1 className="text-2xl font-bold text-[#f5f5f5]">Create Purchase Order</h1>
          <p className="text-sm text-[#a3a3a3] mt-1">{tender.title}</p>
        </div>
        <button
          onClick={() => navigate(`/boq/${tender.id}`)}
          className="flex items-center gap-1.5 text-xs text-[#525252] hover:text-[#f5f5f5] transition-colors no-print"
        >
          <ArrowLeft size={14} /> Edit BOQ
        </button>
      </div>

      <div id="printable-po">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: PO Form */}
          <div className="lg:col-span-1 space-y-4 no-print">
            <div className="rounded-xl border border-[#1c1c1c] bg-[#111111] p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#f5f5f5] mb-4">PO Details</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1.5">PO Number</label>
                  <input
                    value={po.poNumber}
                    onChange={(e) => setPO({ ...po, poNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#242424] text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1.5">Vendor Name</label>
                  <input
                    value={po.vendorName}
                    onChange={(e) => setPO({ ...po, vendorName: e.target.value })}
                    placeholder="Supplier / Vendor"
                    className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#242424] text-sm text-[#f5f5f5] placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1.5">Vendor Email</label>
                  <input
                    type="email"
                    value={po.vendorEmail}
                    onChange={(e) => setPO({ ...po, vendorEmail: e.target.value })}
                    placeholder="vendor@example.com"
                    className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#242424] text-sm text-[#f5f5f5] placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1.5">Delivery Date</label>
                  <input
                    type="date"
                    value={po.deliveryDate}
                    onChange={(e) => setPO({ ...po, deliveryDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#242424] text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1.5">Notes</label>
                  <textarea
                    value={po.notes}
                    onChange={(e) => setPO({ ...po, notes: e.target.value })}
                    placeholder="Special instructions…"
                    className="w-full h-20 px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#242424] text-sm text-[#f5f5f5] placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50 resize-none"
                  />
                </div>
              </div>
            </div>
            {analysis && (
              <div className="rounded-xl border border-[#1c1c1c] bg-[#111111] p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#f5f5f5] mb-3">Tender Summary</p>
                <SummaryRow icon={<Building2 size={12} />} label="Client" value={analysis.client_name} />
                <SummaryRow icon={<FileText size={12} />} label="Project" value={analysis.project_name} />
                <SummaryRow icon={<Calendar size={12} />} label="Location" value={analysis.project_location} />
              </div>
            )}
          </div>

          {/* Right: PO Preview */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-[#1c1c1c] bg-[#111111] overflow-hidden">
              <div className="p-5 border-b border-[#1c1c1c] bg-[#0d0d0d]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#f97316]">Purchase Order</p>
                    <p className="text-lg font-bold text-[#f5f5f5] mt-1 font-mono">{po.poNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#525252]">Issued</p>
                    <p className="text-sm text-[#f5f5f5]">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
                {po.vendorName && (
                  <div className="mt-3 pt-3 border-t border-[#1c1c1c]">
                    <p className="text-xs text-[#525252]">Vendor</p>
                    <p className="text-sm text-[#f5f5f5]">{po.vendorName}</p>
                  </div>
                )}
              </div>

              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1c1c1c]">
                    {['#', 'Code', 'Description', 'Qty', 'Unit', 'Rate', 'Amount'].map((h, i) => (
                      <th key={i} className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#525252] ${i >= 3 ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center">
                        <AlertCircle size={20} className="text-[#2a2a2a] mx-auto mb-2" />
                        <p className="text-xs text-[#525252]">No BOQ items found. Go back and add items first.</p>
                      </td>
                    </tr>
                  ) : (
                    items.map((item, i) => (
                      <tr key={item.id} className="border-b border-[#1c1c1c] last:border-0">
                        <td className="px-3 py-2.5 text-xs text-[#525252]">{i + 1}</td>
                        <td className="px-3 py-2.5 text-xs text-[#a3a3a3] font-mono">{item.item_code || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-[#d4d4d4]">{item.description}</td>
                        <td className="px-3 py-2.5 text-xs text-[#d4d4d4] text-right">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-xs text-[#a3a3a3] text-right">{item.unit}</td>
                        <td className="px-3 py-2.5 text-xs text-[#d4d4d4] text-right">
                          {Number(item.unit_rate).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-medium text-[#f5f5f5] text-right">
                          {Number(item.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {items.length > 0 && (
                <div className="p-5 border-t border-[#1c1c1c] bg-[#0d0d0d]">
                  <div className="flex justify-end items-center gap-8">
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1">Sub Total</p>
                      <p className="text-lg font-bold text-[#f5f5f5]">
                        {grandTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 no-print">
                      <input
                        type="checkbox"
                        id="gst-toggle"
                        checked={includeGST}
                        onChange={(e) => setIncludeGST(e.target.checked)}
                        className="w-4 h-4 rounded border-[#242424] bg-[#111111] text-[#f97316] focus:ring-[#f97316]/20"
                      />
                      <label htmlFor="gst-toggle" className="text-xs text-[#a3a3a3]">Include GST (18%)</label>
                    </div>
                    {includeGST && (
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] mb-1">Total with GST</p>
                        <p className="text-2xl font-bold text-[#f97316]">
                          {totalWithGST.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-4 no-print">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#242424] hover:border-[#f97316]/30 text-[#a3a3a3] hover:text-[#f97316] text-sm font-medium transition-colors"
                >
                  <Download size={16} /> Download PDF
                </button>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#242424] hover:border-[#f97316]/30 text-[#a3a3a3] hover:text-[#f97316] text-sm font-medium transition-colors"
                >
                  <Copy size={16} /> Copy Link
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !po.vendorName.trim()}
                  className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-[#f97316] hover:bg-[#ea6c0a] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {submitting ? 'Submitting…' : !po.vendorName.trim() ? 'Enter vendor name' : 'Submit Purchase Order'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#525252]">{icon}</span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#525252] w-16">{label}</span>
      <span className="text-xs text-[#d4d4d4] truncate">{value || '—'}</span>
    </div>
  );
}