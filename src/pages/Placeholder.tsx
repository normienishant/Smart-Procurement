import { Construction } from 'lucide-react';

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <Construction size={64} className="text-[#f97316] mb-6" />
      <h1 className="text-2xl font-bold text-[#f5f5f5] mb-2">{title}</h1>
      <p className="text-sm text-[#a3a3a3] text-center">
        This feature is coming soon. We're building powerful analytics and reporting tools for you.
      </p>
      <div className="mt-6 flex gap-2">
        <span className="px-3 py-1 rounded-full bg-[#1a1a1a] text-xs text-[#525252] border border-[#242424]">
          Phase 2
        </span>
        <span className="px-3 py-1 rounded-full bg-[#1a1a1a] text-xs text-[#525252] border border-[#242424]">
          In development
        </span>
      </div>
    </div>
  );
}