import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Clock, CheckCircle2, AlertTriangle, Upload, ArrowRight,
  TrendingUp, Layers, DollarSign, X, Filter,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Tender } from '@/lib/database.types';
import StatusBadge from '@/components/StatusBadge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
} from 'recharts';

interface Stats {
  total: number;
  pending: number;
  analyzed: number;
  submitted: number;
  totalEstimatedValue: number;
  totalActualValue: number;
}

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#ef4444'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    analyzed: 0,
    submitted: 0,
    totalEstimatedValue: 0,
    totalActualValue: 0,
  });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFilter, setModalFilter] = useState<'all' | 'pending' | 'analyzed' | 'submitted'>('all');
  const [modalTenders, setModalTenders] = useState<Tender[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('tenders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      const rows = data ?? [];
      setTenders(rows);

      const totalEst = rows.reduce((sum, r) => sum + (Number(r.estimated_value) || 0), 0);
      const actualValue = totalEst * 0.85; // placeholder

      setStats({
        total: rows.length,
        pending: rows.filter((r) => ['uploaded', 'analyzing'].includes(r.status)).length,
        analyzed: rows.filter((r) => ['analyzed', 'reviewing'].includes(r.status)).length,
        submitted: rows.filter((r) => r.status === 'submitted').length,
        totalEstimatedValue: totalEst,
        totalActualValue: actualValue,
      });
      setLoading(false);
    }
    load();
  }, []);

  // Open modal with filter
  const openModal = async (filter: 'all' | 'pending' | 'analyzed' | 'submitted') => {
    setModalFilter(filter);
    setModalOpen(true);
    setModalLoading(true);

    let query = supabase.from('tenders').select('*').order('created_at', { ascending: false });
    if (filter === 'pending') {
      query = query.in('status', ['uploaded', 'analyzing']);
    } else if (filter === 'analyzed') {
      query = query.in('status', ['analyzed', 'reviewing']);
    } else if (filter === 'submitted') {
      query = query.eq('status', 'submitted');
    }
    // 'all' → no filter

    const { data } = await query;
    setModalTenders(data || []);
    setModalLoading(false);
  };

  const getFilterLabel = () => {
    if (modalFilter === 'pending') return 'Pending Review';
    if (modalFilter === 'analyzed') return 'AI Analyzed';
    if (modalFilter === 'submitted') return 'POs Submitted';
    return 'All Tenders';
  };

  const budgetData = [
    { name: 'Estimated', value: stats.totalEstimatedValue },
    { name: 'Actual', value: stats.totalActualValue },
  ];

  const statusData = [
    { name: 'Pending', value: stats.pending },
    { name: 'Analyzed', value: stats.analyzed },
    { name: 'Submitted', value: stats.submitted },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={14} className="text-[#f97316]" />
          <p className="text-xs font-semibold tracking-widest uppercase text-[#f97316]">Command Center</p>
        </div>
        <h1 className="text-2xl font-bold text-[#f5f5f5]">Procurement Dashboard</h1>
        <p className="text-sm text-[#a3a3a3] mt-1">AI-Powered Workflow</p>
      </div>

      {/* Stats – Clickable Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div onClick={() => openModal('all')} className="cursor-pointer hover:opacity-80 transition-opacity">
          <StatCard label="Total Tenders" value={stats.total} icon={<Layers size={18} />} accent />
        </div>
        <div onClick={() => openModal('pending')} className="cursor-pointer hover:opacity-80 transition-opacity">
          <StatCard label="Pending Review" value={stats.pending} icon={<Clock size={18} />} />
        </div>
        <div onClick={() => openModal('analyzed')} className="cursor-pointer hover:opacity-80 transition-opacity">
          <StatCard label="AI Analyzed" value={stats.analyzed} icon={<CheckCircle2 size={18} />} />
        </div>
        <div onClick={() => openModal('submitted')} className="cursor-pointer hover:opacity-80 transition-opacity">
          <StatCard label="POs Submitted" value={stats.submitted} icon={<AlertTriangle size={18} />} />
        </div>
        <div className="cursor-default">
          <StatCard label="Total Est. Value" value={`₹${(stats.totalEstimatedValue / 10000000).toFixed(1)}Cr`} icon={<DollarSign size={18} />} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-[#111111] border border-[#1c1c1c] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#f5f5f5] mb-4">Budget vs Actual</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetData}>
                <XAxis dataKey="name" stroke="#525252" />
                <YAxis stroke="#525252" />
                <Tooltip contentStyle={{ background: '#1a1a1a', borderColor: '#242424', color: '#f5f5f5' }} />
                <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-[#111111] border border-[#1c1c1c] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#f5f5f5] mb-4">Tender Status Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1a1a', borderColor: '#242424', color: '#f5f5f5' }} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Upload CTA */}
      <div
        onClick={() => navigate('/upload')}
        className="mb-8 rounded-xl border border-dashed border-[#2a2a2a] hover:border-[#f97316]/40 hover:bg-[#f97316]/5 transition-all cursor-pointer p-6 flex items-center justify-between group"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] group-hover:bg-[#f97316]/10 flex items-center justify-center transition-colors">
            <Upload size={18} className="text-[#525252] group-hover:text-[#f97316] transition-colors" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#f5f5f5]">Upload New Tender / RFQ</p>
            <p className="text-xs text-[#525252] mt-0.5">PDF, Word, or plain-text documents</p>
          </div>
        </div>
        <ArrowRight size={16} className="text-[#525252] group-hover:text-[#f97316] transition-colors" />
      </div>

      {/* Recent Tenders Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#f5f5f5] uppercase tracking-widest">Recent Documents</h2>
          <span className="text-xs text-[#525252]">{tenders.length} records</span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-[#111111] border border-[#1c1c1c] animate-pulse" />
            ))}
          </div>
        ) : tenders.length === 0 ? (
          <div className="rounded-xl border border-[#1c1c1c] bg-[#111111] p-12 text-center">
            <FileText size={32} className="text-[#2a2a2a] mx-auto mb-3" />
            <p className="text-sm text-[#525252]">No tenders uploaded yet.</p>
            <p className="text-xs text-[#3a3a3a] mt-1">Upload your first RFQ or tender to get started.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#1c1c1c] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1c1c1c] bg-[#0d0d0d]">
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#525252]">Document</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#525252]">Status</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#525252]">Uploaded</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {tenders.map((tender, i) => (
                  <tr
                    key={tender.id}
                    onClick={() => {
                      if (tender.status === 'uploaded') navigate('/upload');
                      else if (tender.status === 'analyzing' || tender.status === 'analyzed') navigate(`/analysis/${tender.id}`);
                      else if (tender.status === 'reviewing') navigate(`/boq/${tender.id}`);
                      else if (tender.status === 'submitted') navigate(`/purchase-order/${tender.id}`);
                    }}
                    className={`border-b border-[#1c1c1c] last:border-0 hover:bg-[#ffffff04] cursor-pointer transition-colors group ${
                      i % 2 === 0 ? 'bg-[#111111]' : 'bg-[#0f0f0f]'
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
                          <FileText size={14} className="text-[#525252]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#f5f5f5] leading-none">{tender.title}</p>
                          <p className="text-xs text-[#525252] mt-0.5">{tender.file_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={tender.status} />
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-[#525252]">
                        {new Date(tender.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <ArrowRight size={14} className="text-[#2a2a2a] group-hover:text-[#f97316] transition-colors ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========== MODAL ========== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c1c] flex-shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-[#f5f5f5]">{getFilterLabel()}</h2>
                <span className="text-xs text-[#525252] bg-[#1a1a1a] px-2 py-0.5 rounded-full">
                  {modalTenders.length} records
                </span>
                <div className="flex items-center gap-1 text-xs text-[#525252]">
                  <Filter size={12} />
                  <span>{modalFilter}</span>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-md hover:bg-[#ffffff10] text-[#525252] hover:text-[#f5f5f5] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {modalLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-[#1a1a1a] border border-[#1c1c1c] animate-pulse" />
                  ))}
                </div>
              ) : modalTenders.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={32} className="text-[#2a2a2a] mx-auto mb-3" />
                  <p className="text-sm text-[#525252]">No tenders in this category.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-[#1c1c1c] overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#1c1c1c] bg-[#0d0d0d]">
                        <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#525252]">Document</th>
                        <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#525252]">Status</th>
                        <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#525252]">Uploaded</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {modalTenders.map((tender) => (
                        <tr
                          key={tender.id}
                          onClick={() => {
                            setModalOpen(false);
                            if (tender.status === 'uploaded') navigate('/upload');
                            else if (tender.status === 'analyzing' || tender.status === 'analyzed') navigate(`/analysis/${tender.id}`);
                            else if (tender.status === 'reviewing') navigate(`/boq/${tender.id}`);
                            else if (tender.status === 'submitted') navigate(`/purchase-order/${tender.id}`);
                          }}
                          className="border-b border-[#1c1c1c] last:border-0 hover:bg-[#ffffff04] cursor-pointer transition-colors group bg-[#111111]"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-md bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
                                <FileText size={14} className="text-[#525252]" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[#f5f5f5] leading-none">{tender.title}</p>
                                <p className="text-xs text-[#525252] mt-0.5">{tender.file_name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={tender.status} />
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-[#525252]">
                              {new Date(tender.created_at).toLocaleDateString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric',
                              })}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <ArrowRight size={14} className="text-[#2a2a2a] group-hover:text-[#f97316] transition-colors ml-auto" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: string | number; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 flex items-start justify-between ${accent ? 'bg-[#f97316]/5 border-[#f97316]/20' : 'bg-[#111111] border-[#1c1c1c]'}`}>
      <div>
        <p className="text-xs text-[#a3a3a3] uppercase tracking-widest mb-1.5">{label}</p>
        <p className={`text-2xl font-bold ${accent ? 'text-[#f97316]' : 'text-[#f5f5f5]'}`}>{value}</p>
      </div>
      <div className={`p-2.5 rounded-lg ${accent ? 'bg-[#f97316]/15 text-[#f97316]' : 'bg-[#1a1a1a] text-[#525252]'}`}>{icon}</div>
    </div>
  );
}