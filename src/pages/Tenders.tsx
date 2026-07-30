import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, ArrowLeft, Filter, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Tender } from '@/lib/database.types';
import StatusBadge from '@/components/StatusBadge';

export default function Tenders() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const statusFilter = searchParams.get('status') || 'all';

  useEffect(() => {
    async function load() {
      let query = supabase.from('tenders').select('*').order('created_at', { ascending: false });

      if (statusFilter === 'pending') {
        query = query.in('status', ['uploaded', 'analyzing']);
      } else if (statusFilter === 'analyzed') {
        query = query.in('status', ['analyzed', 'reviewing']);
      } else if (statusFilter === 'submitted') {
        query = query.eq('status', 'submitted');
      }

      const { data } = await query;
      setTenders(data || []);
      setLoading(false);
    }
    load();
  }, [statusFilter]);

  const getFilterLabel = () => {
    if (statusFilter === 'pending') return 'Pending Review';
    if (statusFilter === 'analyzed') return 'AI Analyzed';
    if (statusFilter === 'submitted') return 'POs Submitted';
    return 'All Tenders';
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-lg hover:bg-[#ffffff08] text-[#525252] hover:text-[#f5f5f5] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#f5f5f5]">{getFilterLabel()}</h1>
          <p className="text-sm text-[#a3a3a3] mt-1">{tenders.length} records</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-[#525252]">
          <Filter size={14} />
          <span>Filter: {statusFilter}</span>
        </div>
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
          <p className="text-sm text-[#525252]">No tenders in this category.</p>
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
              {tenders.map((tender) => (
                <tr
                  key={tender.id}
                  onClick={() => {
                    if (tender.status === 'uploaded') navigate('/upload');
                    else if (tender.status === 'analyzing' || tender.status === 'analyzed') navigate(`/analysis/${tender.id}`);
                    else if (tender.status === 'reviewing') navigate(`/boq/${tender.id}`);
                    else if (tender.status === 'submitted') navigate(`/purchase-order/${tender.id}`);
                  }}
                  className="border-b border-[#1c1c1c] last:border-0 hover:bg-[#ffffff04] cursor-pointer transition-colors group bg-[#111111]"
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
  );
}