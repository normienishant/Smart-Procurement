import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ClipboardList, ArrowLeft, ArrowRight, Plus, Trash2, Loader2,
  Sparkles, Send, AlertCircle, Save, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { BOQItem, Tender } from '@/lib/database.types';

interface DraftItem {
  id?: string;
  item_code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_rate: number;
  notes: string;
  position: number;
}

const emptyItem = (): DraftItem => ({
  item_code: '',
  description: '',
  quantity: 1,
  unit: 'NOS',
  unit_rate: 0,
  notes: '',
  position: 0,
});

export default function BOQEditor() {
  const { tenderId } = useParams<{ tenderId: string }>();
  const navigate = useNavigate();
  const [tender, setTender] = useState<Tender | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState('');
  const [copilotSuggestion, setCopilotSuggestion] = useState<DraftItem[] | null>(null);

  useEffect(() => {
    async function load() {
      if (!tenderId) return;
      const { data: t } = await supabase.from('tenders').select('*').eq('id', tenderId).maybeSingle();
      setTender(t);
      if (t) {
        const { data: rows } = await supabase
          .from('boq_items')
          .select('*')
          .eq('tender_id', t.id)
          .order('position', { ascending: true });
        if (rows && rows.length > 0) {
          setItems(rows.map((r: BOQItem) => ({
            id: r.id, item_code: r.item_code, description: r.description,
            quantity: Number(r.quantity), unit: r.unit, unit_rate: Number(r.unit_rate),
            notes: r.notes, position: r.position,
          })));
        } else {
          setItems([{ ...emptyItem(), position: 0 }]);
        }
      }
      setLoading(false);
    }
    load();
  }, [tenderId]);

  const grandTotal = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity * i.unit_rate, 0),
    [items],
  );

  function updateItem(index: number, field: keyof DraftItem, value: string | number) {
    setItems(prev => prev.map((it, i) =>
      i === index ? { ...it, [field]: field === 'quantity' || field === 'unit_rate' ? Number(value) || 0 : value } : it
    ));
  }

  function addRow() {
    setItems(prev => [...prev, { ...emptyItem(), position: prev.length }]);
  }

  function removeRow(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, position: i })));
  }

  async function handleSave() {
    if (!tenderId) return;
    setSaving(true);
    const validItems = items.filter(i => i.description.trim());

    await supabase.from('boq_items').delete().eq('tender_id', tenderId);

    if (validItems.length > 0) {
      const inserts = validItems.map((it, i) => ({
        tender_id: tenderId,
        item_code: it.item_code,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_rate: it.unit_rate,
        notes: it.notes,
        position: i,
      }));
      await supabase.from('boq_items').insert(inserts);
    }

    await supabase.from('tenders').update({ status: 'reviewing' }).eq('id', tenderId);
    setSaving(false);
    navigate(`/purchase-order/${tenderId}`);
  }

  async function callCopilot() {
    if (!tender || !copilotPrompt.trim()) return;
    setCopilotLoading(true);
    setCopilotError('');
    setCopilotSuggestion(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          tenderId: tender.id,
          tenderText: tender.file_text,
          prompt: copilotPrompt,
          currentItems: items,
        }),
      });

      if (!res.ok) throw new Error(`Copilot failed (${res.status})`);
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      if (!result.items || !Array.isArray(result.items)) throw new Error('No items returned.');

      setCopilotSuggestion(result.items);
    } catch (err) {
      setCopilotError(err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setCopilotLoading(false);
    }
  }

  function acceptSuggestion() {
    if (!copilotSuggestion) return;
    setItems(prev => [...prev, ...copilotSuggestion.map((s, i) => ({ ...s, position: prev.length + i }))]);
    setCopilotSuggestion(null);
    setCopilotPrompt('');
    setCopilotOpen(false);
  }

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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList size={14} className="text-[#f97316]" />
            <p className="text-xs font-semibold tracking-widest uppercase text-[#f97316]">Step 3 of 5</p>
          </div>
          <h1 className="text-2xl font-bold text-[#f5f5f5]">Bill of Quantities</h1>
          <p className="text-sm text-[#a3a3a3] mt-1">{tender.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/analysis/${tender.id}`)}
            className="flex items-center gap-1.5 text-xs text-[#525252] hover:text-[#f5f5f5] transition-colors"
          >
            <ArrowLeft size={14} /> Analysis
          </button>
        </div>
      </div>

      {/* AI Copilot Button */}
      <button
        onClick={() => setCopilotOpen(true)}
        className="mb-4 w-full rounded-xl border border-dashed border-[#f97316]/30 hover:border-[#f97316]/50 hover:bg-[#f97316]/5 transition-all p-4 flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#f97316]/10 flex items-center justify-center">
            <Sparkles size={16} className="text-[#f97316]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-[#f5f5f5]">AI Copilot — Generate BOQ Items</p>
            <p className="text-xs text-[#525252] mt-0.5">Ask Gemini to extract or suggest line items from the tender</p>
          </div>
        </div>
        <ArrowRight size={14} className="text-[#f97316]" />
      </button>

      {/* Table */}
      <div className="rounded-xl border border-[#1c1c1c] overflow-hidden mb-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1c1c1c] bg-[#0d0d0d]">
              {['#', 'Item Code', 'Description', 'Qty', 'Unit', 'Rate', 'Total', 'Notes', ''].map((h, i) => (
                <th key={i} className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#525252]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-[#1c1c1c] last:border-0 bg-[#111111] hover:bg-[#ffffff04] transition-colors">
                <td className="px-3 py-2 text-xs text-[#525252] w-8">{i + 1}</td>
                <td className="px-3 py-2 w-28">
                  <input
                    value={item.item_code}
                    onChange={(e) => updateItem(i, 'item_code', e.target.value)}
                    className="w-full bg-transparent text-xs text-[#d4d4d4] focus:outline-none focus:text-[#f97316] placeholder-[#3a3a3a]"
                    placeholder="—"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(i, 'description', e.target.value)}
                    className="w-full bg-transparent text-xs text-[#d4d4d4] focus:outline-none focus:text-[#f97316] placeholder-[#3a3a3a]"
                    placeholder="Item description"
                  />
                </td>
                <td className="px-3 py-2 w-20">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                    className="w-full bg-transparent text-xs text-[#d4d4d4] focus:outline-none focus:text-[#f97316] text-right"
                  />
                </td>
                <td className="px-3 py-2 w-20">
                  <input
                    value={item.unit}
                    onChange={(e) => updateItem(i, 'unit', e.target.value)}
                    className="w-full bg-transparent text-xs text-[#d4d4d4] focus:outline-none focus:text-[#f97316] placeholder-[#3a3a3a]"
                  />
                </td>
                <td className="px-3 py-2 w-28">
                  <input
                    type="number"
                    value={item.unit_rate}
                    onChange={(e) => updateItem(i, 'unit_rate', e.target.value)}
                    className="w-full bg-transparent text-xs text-[#d4d4d4] focus:outline-none focus:text-[#f97316] text-right"
                  />
                </td>
                <td className="px-3 py-2 w-28 text-right text-xs font-medium text-[#f5f5f5]">
                  {(item.quantity * item.unit_rate).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                </td>
                <td className="px-3 py-2 w-32">
                  <input
                    value={item.notes}
                    onChange={(e) => updateItem(i, 'notes', e.target.value)}
                    className="w-full bg-transparent text-xs text-[#525252] focus:outline-none focus:text-[#f97316] placeholder-[#3a3a3a]"
                    placeholder="—"
                  />
                </td>
                <td className="px-3 py-2 w-10">
                  <button
                    onClick={() => items.length > 1 && removeRow(i)}
                    disabled={items.length <= 1}
                    className="p-1 rounded text-[#3a3a3a] hover:text-red-400 disabled:opacity-30 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add row + Total */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={addRow}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#242424] hover:border-[#f97316]/30 hover:bg-[#f97316]/5 text-xs text-[#a3a3a3] hover:text-[#f97316] transition-all"
        >
          <Plus size={14} /> Add Row
        </button>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#525252]">Grand Total</p>
            <p className="text-xl font-bold text-[#f97316]">
              {grandTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>

      {/* Save & Continue */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm bg-[#f97316] hover:bg-[#ea6c0a] text-white transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        {saving ? 'Saving…' : 'Save & Create Purchase Order'}
      </button>

      {/* Copilot Drawer */}
      {copilotOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCopilotOpen(false)} />
          <div className="relative w-full max-w-md bg-[#0d0d0d] border-l border-[#1c1c1c] h-full overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-[#f97316]" />
                <h2 className="text-base font-semibold text-[#f5f5f5]">AI Copilot</h2>
              </div>
              <button onClick={() => setCopilotOpen(false)} className="p-1.5 rounded-md hover:bg-[#ffffff10] text-[#525252]">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-[#a3a3a3] mb-4">
              Describe what you need. The AI will generate BOQ line items based on the tender document.
            </p>

            <textarea
              value={copilotPrompt}
              onChange={(e) => setCopilotPrompt(e.target.value)}
              placeholder="e.g. Extract all materials and quantities from the tender for the CIPP lining section"
              className="w-full h-28 px-4 py-3 rounded-xl bg-[#111111] border border-[#242424] text-sm text-[#f5f5f5] placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50 resize-none"
            />

            <button
              onClick={callCopilot}
              disabled={!copilotPrompt.trim() || copilotLoading}
              className="w-full mt-3 py-2.5 rounded-xl bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              {copilotLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {copilotLoading ? 'Generating…' : 'Generate Items'}
            </button>

            {copilotError && (
              <div className="flex items-start gap-2 mt-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">{copilotError}</p>
              </div>
            )}

            {copilotSuggestion && copilotSuggestion.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#525252] mb-2">
                  Suggested Items ({copilotSuggestion.length})
                </p>
                {copilotSuggestion.map((s, i) => (
                  <div key={i} className="rounded-lg bg-[#111111] border border-[#1c1c1c] p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[#f97316]">{s.item_code || '—'}</span>
                      <span className="text-xs text-[#a3a3a3]">
                        {s.quantity} {s.unit} · ₹{s.unit_rate}
                      </span>
                    </div>
                    <p className="text-xs text-[#d4d4d4]">{s.description}</p>
                  </div>
                ))}
                <button
                  onClick={acceptSuggestion}
                  className="w-full mt-2 py-2.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 text-sm font-medium transition-colors"
                >
                  Add All to BOQ
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
