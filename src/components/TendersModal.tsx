import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Tender } from '@/lib/database.types';
import StatusBadge from '@/components/StatusBadge';

interface TendersModalProps {
  isOpen: boolean;
  onClose: () => void;
  filter: 'all' | 'pending' | 'analyzed' | 'submitted';
}

export default function TendersModal({ isOpen, onClose, filter }: TendersModalProps) {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;

    async function load() {
      setLoading(true);
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
      setTenders(data || []);
      setLoading(false);
    }
    load();
  }, [isOpen, filter]);

  const getTitle = () => {
    if (filter === 'pending') return 'Pending Review';
    if (filter === 'analyzed') return 'AI Analyzed';
    if (filter === 'submitted') return 'POs Submitted';
    return 'All Tenders';
  };

  const handleTenderClick = (tender: Tender) => {
    onClose();
    if (tender.status === 'uploaded') navigate('/upload');
    else if (tender.status === 'analyzing' || tender.status === 'analyzed') navigate(`/analysis/${tender.id}`);
    else if (tender.status === 'reviewing') navigate(`/boq/${tender.id}`);
    else if (tender.status === 'submitted') navigate(`/purchase-order/${tender.id}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[80vh] bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c1c] bg-[#111111] rounded-t-2xl flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-[#f5f5f5]">{getTitle()}</h2>
            <p className="text-sm text-[#a3a3a3]">{tenders.length} records</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[#ffffff10] text-[#525252] hover:text-[#f5f5f5] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={24} className="animate-spin text-[#f97316]" />
            </div>
          ) : tenders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[#525252]">
              <FileText size={32} className="mb-2" />
              <p>No tenders in this category.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tenders.map((tender) => (
                <div
                  key={tender.id}
                  onClick={() => handleTenderClick(tender)}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#111111] border border-[#1c1c1c] hover:border-[#f97316]/30 hover:bg-[#ffffff04] cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
                      <FileText size={14} className="text-[#525252]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#f5f5f5] truncate">{tender.title}</p>
                      <p className="text-xs text-[#525252] truncate">{tender.file_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={tender.status} />
                    <ArrowRight size={14} className="text-[#2a2a2a] group-hover:text-[#f97316] transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}