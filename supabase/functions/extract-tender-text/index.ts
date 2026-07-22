import { createClient } from "npm:@supabase/supabase-js@2.57.4";
// Use npm specifiers for Deno
import pdfParse from "npm:pdf-parse";
import mammoth from "npm:mammoth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// OCR.space API call
async function ocrSpace(fileBuffer: ArrayBuffer, apiKey: string): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });
  formData.append('file', blob, 'document.pdf');
  formData.append('apikey', apiKey);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();
  if (!result.IsErroredOnProcessing) {
    return result.ParsedResults?.[0]?.ParsedText || '';
  }
  throw new Error(`OCR failed: ${result.ErrorMessage || 'Unknown error'}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { fileBase64, fileType, fileName } = await req.json();

    if (!fileBase64) {
      return new Response(
        JSON.stringify({ error: "Missing fileBase64" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode base64 to ArrayBuffer
    const binaryString = atob(fileBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const fileBuffer = bytes.buffer;

    let extractedText = '';

    // Handle based on file type
    if (fileType === 'application/pdf' || fileName?.endsWith('.pdf')) {
      // 1. Try pdf-parse first
      try {
        const pdfData = await pdfParse(Buffer.from(fileBuffer));
        extractedText = pdfData.text || '';
      } catch (pdfErr) {
        console.error('pdf-parse error:', pdfErr);
        extractedText = '';
      }

      // 2. If text too short, fallback to OCR.space
      if (extractedText.trim().length < 100) {
        const ocrApiKey = Deno.env.get("OCR_SPACE_API_KEY") ?? "";
        if (!ocrApiKey) {
          console.warn("OCR_SPACE_API_KEY not set, skipping OCR fallback.");
        } else {
          try {
            extractedText = await ocrSpace(fileBuffer, ocrApiKey);
          } catch (ocrErr) {
            console.error('OCR error:', ocrErr);
            // Keep whatever we got from pdf-parse
          }
        }
      }
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName?.endsWith('.docx')) {
      // DOCX via mammoth
      try {
        const result = await mammoth.extractRawText({ buffer: Buffer.from(fileBuffer) });
        extractedText = result.value || '';
      } catch (docxErr) {
        console.error('DOCX extraction error:', docxErr);
        extractedText = '';
      }
    } else if (fileType === 'text/plain' || fileName?.endsWith('.txt')) {
      // TXT – decode base64 as text
      extractedText = new TextDecoder().decode(fileBuffer);
    } else {
      // Unsupported – try reading as text anyway
      extractedText = new TextDecoder().decode(fileBuffer);
    }

    // Clean up: remove null characters and weird unicode
    extractedText = extractedText
      .replace(/\u0000/g, '')
      .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g, '')
      .trim();

    return new Response(
      JSON.stringify({ text: extractedText }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error('Extraction error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
