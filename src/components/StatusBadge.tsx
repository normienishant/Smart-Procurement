import type { TenderStatus } from '@/lib/database.types';

const config: Record<TenderStatus, { label: string; className: string }> = {
  uploaded:       { label: 'Uploaded',        className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  analyzing:      { label: 'Analyzing…',      className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  analyzed:       { label: 'Analyzed',        className: 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20' },
  reviewing:      { label: 'Under Review',    className: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  submitted:      { label: 'PO Submitted',    className: 'bg-green-500/10 text-green-400 border-green-500/20' },
  rejected:       { label: 'Rejected',        className: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

export default function StatusBadge({ status }: { status: TenderStatus }) {
  const { label, className } = config[status] ?? config.uploaded;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${className}`}>
      {label}
    </span>
  );
}
