import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, X, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// 🔥 Showcase AI style – stable CDN worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

type UploadState = 'idle' | 'reading' | 'extracting' | 'saving' | 'done' | 'error';

const ACCEPTED = ['.pdf', '.txt', '.doc', '.docx'];
const MAX_SIZE_MB = 15;

// 🔥 PDF to Image (for OCR) – same as Showcase AI
async function pdfToImage(file: File, pageNum: number = 1): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/png');
}

// 🔥 Extract text – first pdf.js, then OCR fallback
async function extractPDFText(file: File): Promise<string> {
  console.log('📄 Showcase AI style extraction:', file.name);
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    console.log('📄 PDF text extracted:', fullText.length, 'chars');
    
    if (fullText.trim().length > 50) {
      return fullText;
    }
    
    // 🔥 If no text, OCR – same as Showcase AI
    console.warn('⚠️ No text found, starting OCR...');
    const Tesseract = (await import('tesseract.js')).default;
    const pagesToTry = Math.min(pdf.numPages, 5);
    let ocrText = '';
    for (let i = 1; i <= pagesToTry; i++) {
      try {
        console.log(`📄 OCR page ${i}...`);
        const imageDataUrl = await pdfToImage(file, i);
        const result = await Tesseract.recognize(imageDataUrl, 'eng', {
          logger: (m) => console.log('📄 OCR:', m.status, Math.round(m.progress * 100) + '%'),
        });
        ocrText += result.data.text + '\n';
      } catch (e) {
        console.warn('⚠️ OCR page', i, 'failed:', e);
      }
    }
    return ocrText || fullText;
    
  } catch (error: any) {
    console.error('❌ PDF error:', error.message);
    // Last chance: OCR on first page
    try {
      console.log('📄 Final OCR attempt...');
      const Tesseract = (await import('tesseract.js')).default;
      const imageDataUrl = await pdfToImage(file, 1);
      const result = await Tesseract.recognize(imageDataUrl, 'eng', {
        logger: (m) => console.log('📄 OCR:', m.status),
      });
      return result.data.text || '';
    } catch (ocrErr: any) {
      console.error('❌ OCR failed:', ocrErr.message);
      throw new Error(`Could not extract text from PDF: ${error.message}`);
    }
  }
}

// DOCX extraction – Showcase AI style
async function extractDOCXText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || '';
}

// TXT extraction
async function extractTXTText(file: File): Promise<string> {
  return await file.text();
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
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let extractedText = '';

      if (ext === 'pdf') {
        setState('extracting');
        extractedText = await extractPDFText(file);
      } else if (ext === 'docx' || ext === 'doc') {
        setState('extracting');
        extractedText = await extractDOCXText(file);
      } else if (ext === 'txt') {
        extractedText = await extractTXTText(file);
      } else {
        throw new Error('Unsupported file format');
      }

      extractedText = extractedText
        .replace(/\u0000/g, '')
        .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g, '')
        .trim();

      if (!extractedText) {
        throw new Error('No readable text found in the file.');
      }

      setState('saving');

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
        console.error('Supabase error:', error);
        throw new Error('Failed to save tender.');
      }

      setState('done');
      setTimeout(() => navigate(`/analysis/${data.id}`), 800);

    } catch (err: any) {
      console.error('❌ Upload error:', err);
      setErrorMsg(err.message || 'Unknown error.');
      setState('error');
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
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
                Supports PDF, Word (.doc/.docx), and plain text — up to {MAX_SIZE_MB}MB
                <br />
                <span className="text-[#3a3a3a]">(Scanned PDFs will be OCR-processed)</span>
              </p>
            </>
          )}
        </div>

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

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
            <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">{errorMsg}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!file || !title.trim() || state === 'reading' || state === 'extracting' || state === 'saving' || state === 'done'}
          className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-[#f97316] hover:bg-[#ea6c0a] text-white"
        >
          {state === 'reading' && <><Loader2 size={15} className="animate-spin" /> Reading file…</>}
          {state === 'extracting' && <><Loader2 size={15} className="animate-spin" /> Extracting text (OCR if needed)…</>}
          {state === 'saving' && <><Loader2 size={15} className="animate-spin" /> Saving…</>}
          {state === 'done' && <><CheckCircle2 size={15} /> Saved! Launching AI Analysis…</>}
          {(state === 'idle' || state === 'error') && <><Upload size={15} /> Upload & Analyze with AI</>}
        </button>
      </form>
    </div>
  );
}