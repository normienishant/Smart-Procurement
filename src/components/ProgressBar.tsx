export default function ProgressBar({ step, total = 5 }: { step: number; total?: number }) {
  const steps = ['Upload', 'Analysis', 'BOQ', 'PO', 'Submit'];
  return (
    <div className="w-full mb-6">
      <div className="flex items-center justify-between gap-1">
        {steps.map((label, i) => (
          <div key={i} className="flex-1 flex items-center">
            <div className={`flex-1 h-1 rounded-full transition-all ${i < step ? 'bg-[#f97316]' : 'bg-[#2a2a2a]'}`} />
            <span className={`text-[10px] font-medium ${i < step ? 'text-[#f97316]' : 'text-[#525252]'} ml-1`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}