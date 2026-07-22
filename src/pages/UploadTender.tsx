import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, X, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type UploadState = 'idle' | 'reading' | 'extracting' | 'saving' | 'done' | 'error';

const ACCEPTED = ['.pdf', '.txt', '.doc', '.docx'];
const MAX_SIZE_MB = 10;

// Helper to convert File → base64 (for backend processing)
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1]; // remove data:...;base64,
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UploadTender() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [tenderType, setTenderType] = useState('RFP');
  const [state, setState] = useState<UploadState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);

  function validateFile(f: File): string | null {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED.includes(ext)) return `File type not supported. Accepted: ${ACCEPTED.join(', ')}`;
    if (f.size > MAX_SIZE_MB * 1024 * 1024) return `File exceeds ${MAX_SIZE_MB}MB limit.`;
    return null;
  }

  function selectFile(f: File) {
    const err = validateFile(f);
    if (err) { setErrorMsg(err); return; }
    setErrorMsg('');
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  }

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) selectFile(f);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setState('reading');
    setErrorMsg('');

    try {
      let extractedText = '';
      const fileType = file.type || 'application/octet-stream';
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();

      // 1. TXT – read directly
      if (fileType === 'text/plain' || ext === '.txt') {
        const reader = new FileReader();
        const text = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsText(file);
        });
        extractedText = text.replace(/\u0000/g, '').trim();
      } 
      // 2. PDF / DOCX / others → send to backend for extraction (with OCR fallback)
      else {
        setState('extracting');
        const base64 = await readFileAsBase64(file);
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-tender-text`;
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            fileBase64: base64,
            fileType: fileType,
            fileName: file.name,
          }),
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          throw new Error(`Extraction failed (${res.status}): ${errBody.slice(0, 200)}`);
        }
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        extractedText = data.text || '';
      }

      // If still empty, throw
      if (!extractedText.trim()) {
        throw new Error('No text could be extracted. The file may be empty or unsupported.');
      }

      setState('saving');

      // Save to Supabase
      const { data, error } = await supabase
        .from('tenders')
        .insert({
          title: title.trim(),
          file_name: file.name,
          file_text: extractedText,
          status: 'uploaded',
          tender_type: tenderType,
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error('Failed to save tender. Please try again.');
      }

      setState('done');
      setTimeout(() => navigate(`/analysis/${data.id}`), 800);

    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error.');
      setState('error');
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Upload size={14} className="text-[#f97316]" />
          <p className="text-xs font-semibold tracking-widest uppercase text-[#f97316]">Step 1 of 5</p>
        </div>
        <h1 className="text-2xl font-bold text-[#f5f5f5]">Upload Tender Document</h1>
        <p className="text-sm text-[#a3a3a3] mt-1">
          Upload the raw RFQ, tender document, or email thread for AI extraction.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !file && document.getElementById('file-input')?.click()}
          className={`relative rounded-xl border-2 border-dashed p-10 text-center transition-all duration-200 ${
            dragOver
              ? 'border-[#f97316] bg-[#f97316]/5'
              : file
              ? 'border-[#f97316]/40 bg-[#f97316]/5 cursor-default'
              : 'border-[#2a2a2a] hover:border-[#f97316]/30 hover:bg-[#ffffff04] cursor-pointer'
          }`}
        >
          <input
            id="file-input"
            type="file"
            accept={ACCEPTED.join(',')}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && selectFile(e.target.files[0])}
          />

          {file ? (
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#f97316]/10 flex items-center justify-center">
                <FileText size={24} className="text-[#f97316]" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-[#f5f5f5]">{file.name}</p>
                <p className="text-xs text-[#a3a3a3] mt-0.5">
                  {(file.size / 1024).toFixed(0)} KB · {file.type || 'Document'}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null); setTitle(''); setState('idle'); }}
                className="ml-auto p-1.5 rounded-md hover:bg-[#ffffff10] text-[#525252] hover:text-[#f5f5f5] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] flex items-center justify-center mx-auto mb-4">
                <Upload size={22} className="text-[#525252]" />
              </div>
              <p className="text-sm font-medium text-[#f5f5f5] mb-1">
                Drag & drop or click to browse
              </p>
              <p className="text-xs text-[#525252]">
                Supports PDF, Word (.doc/.docx), plain text — up to {MAX_SIZE_MB}MB
                <br />
                <span className="text-[#3a3a3a]">(Scanned PDFs will be OCR-processed)</span>
              </p>
            </>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-[#a3a3a3] mb-2">
            Document Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. RFQ — Mumbai Water Pipeline Phase 2"
            className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-[#242424] text-[#f5f5f5] text-sm placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50 focus:bg-[#f97316]/5 transition-all"
          />
        </div>

        {/* Tender Type */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-[#a3a3a3] mb-2">
            Tender Type
          </label>
          <select
            value={tenderType}
            onChange={(e) => setTenderType(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-[#242424] text-[#f5f5f5] text-sm focus:outline-none focus:border-[#f97316]/50 focus:bg-[#f97316]/5 transition-all"
          >
            <option value="RFP">RFP</option>
            <option value="RFQ">RFQ</option>
            <option value="GeM Bid">GeM Bid</option>
            <option value="CPPP Tender">CPPP Tender</option>
            <option value="NIT">NIT</option>
            <option value="BOQ">BOQ</option>
          </select>
        </div>

        {/* Info box */}
        <div className="rounded-xl bg-[#111111] border border-[#1c1c1c] p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#525252] mb-2">What happens next</p>
          <ol className="space-y-1.5">
            {[
              'Document text is securely extracted (OCR for scanned PDFs)',
              'Groq AI (Llama 3.3) analyzes the full contract',
              'Structured data surfaces for your review',
              'You validate and approve before any ERP action',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#a3a3a3]">
                <span className="w-4 h-4 rounded-sm bg-[#1a1a1a] text-[#525252] text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
            <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">{errorMsg}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!file || !title.trim() || state === 'reading' || state === 'extracting' || state === 'saving' || state === 'done'}
          className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-[#f97316] hover:bg-[#ea6c0a] text-white"
        >
          {state === 'reading' && <><Loader2 size={15} className="animate-spin" /> Reading file…</>}
          {state === 'extracting' && <><Loader2 size={15} className="animate-spin" /> Extracting text (OCR if needed)…</>}
          {state === 'saving' && <><Loader2 size={15} className="animate-spin" /> Saving to database…</>}
          {state === 'done' && <><CheckCircle2 size={15} /> Saved! Launching AI Analysis…</>}
          {(state === 'idle' || state === 'error') && <><Upload size={15} /> Upload & Analyze with AI</>}
        </button>
      </form>
    </div>
  );
} 