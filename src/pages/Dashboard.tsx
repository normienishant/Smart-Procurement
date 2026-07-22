import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Upload,
  ArrowRight,
  TrendingUp,
  Layers,
  Activity,
  DollarSign,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Tender } from '@/lib/database.types';
import StatusBadge from '@/components/StatusBadge';

interface Stats {
  total: number;
  pending: number;
  analyzed: number;
  submitted: number;
  totalEstimatedValue: number;
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 flex items-start justify-between ${
        accent
          ? 'bg-[#f97316]/5 border-[#f97316]/20'
          : 'bg-[#111111] border-[#1c1c1c]'
      }`}
    >
      <div>
        <p className="text-xs text-[#a3a3a3] uppercase tracking-widest mb-1.5">{label}</p>
        <p className={`text-2xl font-bold ${accent ? 'text-[#f97316]' : 'text-[#f5f5f5]'}`}>{value}</p>
      </div>
      <div className={`p-2.5 rounded-lg ${accent ? 'bg-[#f97316]/15 text-[#f97316]' : 'bg-[#1a1a1a] text-[#525252]'}`}>
        {icon}
      </div>
    </div>
  );
}

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
  });

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('tenders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      const rows = data ?? [];
      setTenders(rows);
      const totalEst = rows.reduce((sum, r) => sum + (Number(r.estimated_value) || 0), 0);
      setStats({
        total: rows.length,
        pending: rows.filter((r) => ['uploaded', 'analyzing'].includes(r.status)).length,
        analyzed: rows.filter((r) => ['analyzed', 'reviewing'].includes(r.status)).length,
        submitted: rows.filter((r) => r.status === 'submitted').length,
        totalEstimatedValue: totalEst,
      });
      setLoading(false);
    }
    load();
  }, []);

  function handleTenderClick(tender: Tender) {
    if (tender.status === 'uploaded') {
      navigate('/upload');
    } else if (tender.status === 'analyzing' || tender.status === 'analyzed') {
      navigate(`/analysis/${tender.id}`);
    } else if (tender.status === 'reviewing') {
      navigate(`/boq/${tender.id}`);
    } else if (tender.status === 'submitted') {
      navigate(`/purchase-order/${tender.id}`);
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={14} className="text-[#f97316]" />
          <p className="text-xs font-semibold tracking-widest uppercase text-[#f97316]">Command Center</p>
        </div>
        <h1 className="text-2xl font-bold text-[#f5f5f5]">Procurement Dashboard</h1>
        <p className="text-sm text-[#a3a3a3] mt-1">
          Trenchless Engineering Services Pvt Ltd. — AI-Powered Workflow
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Tenders" value={stats.total} icon={<Layers size={18} />} accent />
        <StatCard label="Pending Review" value={stats.pending} icon={<Clock size={18} />} />
        <StatCard label="AI Analyzed" value={stats.analyzed} icon={<CheckCircle2 size={18} />} />
        <StatCard label="POs Submitted" value={stats.submitted} icon={<AlertTriangle size={18} />} />
        <StatCard label="Total Est. Value" value={`₹${(stats.totalEstimatedValue / 10000000).toFixed(1)}Cr`} icon={<DollarSign size={18} />} />
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-[#111111] border border-[#1c1c1c] rounded-xl p-5 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-[#f97316]" />
          <h2 className="text-sm font-semibold text-[#f5f5f5] uppercase tracking-widest">Recent Activity</h2>
        </div>
        {tenders.length === 0 ? (
          <p className="text-xs text-[#525252]">No activity yet. Upload your first tender.</p>
        ) : (
          <div className="space-y-2">
            {tenders.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b border-[#1c1c1c] pb-2 last:border-0">
                <div className="flex items-center gap-3">
                  <FileText size={14} className="text-[#525252]" />
                  <span className="text-sm text-[#d4d4d4]">{t.title}</span>
                </div>
                <StatusBadge status={t.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div
        onClick={() => navigate('/upload')}
        className="mb-8 rounded-xl border border-dashed border-[#2a2a2a] hover:border-[#f97316]/40 hover:bg-[#f97316]/5 transition-all duration-200 cursor-pointer p-6 flex items-center justify-between group"
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

      {/* Recent Tenders */}
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
                    onClick={() => handleTenderClick(tender)}
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
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
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
    </div>
  );
}