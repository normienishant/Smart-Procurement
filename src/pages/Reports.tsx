import { useEffect, useState } from 'react';
import { FileText, Download, Filter, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Tender } from '@/lib/database.types';
import StatusBadge from '@/components/StatusBadge';
import toast from 'react-hot-toast';

export default function Reports() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [filtered, setFiltered] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('tenders').select('*').order('created_at', { ascending: false });
      setTenders(data || []);
      setFiltered(data || []);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (statusFilter === 'all') setFiltered(tenders);
    else setFiltered(tenders.filter(t => t.status === statusFilter));
  }, [statusFilter, tenders]);

  const exportCSV = () => {
    const headers = ['Title', 'Status', 'Estimated Value', 'Uploaded'];
    const rows = filtered.map(t => [
      t.title,
      t.status,
      t.estimated_value || 0,
      new Date(t.created_at).toLocaleDateString(),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tender_report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported');
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f97316]" /></div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText size={18} className="text-[#f97316]" />
            <p className="text-xs font-semibold tracking-widest uppercase text-[#f97316]">Reports</p>
          </div>
          <h1 className="text-2xl font-bold text-[#f5f5f5]">Tender Reports</h1>
          <p className="text-sm text-[#a3a3a3] mt-1">Export and view tender data</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-medium transition-colors"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <Filter size={16} className="text-[#525252]" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#111111] border border-[#242424] rounded-lg px-3 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
        >
          <option value="all">All Status</option>
          <option value="uploaded">Uploaded</option>
          <option value="analyzing">Analyzing</option>
          <option value="analyzed">Analyzed</option>
          <option value="reviewing">Under Review</option>
          <option value="submitted">PO Submitted</option>
        </select>
        <span className="text-xs text-[#525252]">{filtered.length} records</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#1c1c1c] bg-[#111111] p-12 text-center">
          <FileText size={32} className="text-[#2a2a2a] mx-auto mb-3" />
          <p className="text-sm text-[#525252]">No tenders match the filter.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#1c1c1c] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1c1c1c] bg-[#0d0d0d]">
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#525252]">Title</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#525252]">Status</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#525252]">Est. Value</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#525252]">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-[#1c1c1c] last:border-0 bg-[#111111] hover:bg-[#ffffff04]">
                  <td className="px-5 py-4 text-sm text-[#d4d4d4]">{t.title}</td>
                  <td className="px-5 py-4"><StatusBadge status={t.status} /></td>
                  <td className="px-5 py-4 text-right text-sm text-[#d4d4d4]">
                    ₹{Number(t.estimated_value).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-sm text-[#525252]">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}