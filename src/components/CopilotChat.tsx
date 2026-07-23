import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, X, Minimize2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface CopilotChatProps {
  tenderId: string;
  tenderText: string;
}

const DEFAULT_SUGGESTIONS = [
  "What is the scope of work?",
  "What are the key deadlines?",
  "What are the eligibility requirements?",
  "What are the important clauses?",
  "What is the payment terms?",
];

export default function CopilotChat({ tenderId, tenderText }: CopilotChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I\'ve read the tender document. Ask me anything about it – scope, deadlines, eligibility, clauses, or any specific requirement.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && tenderText && suggestions === DEFAULT_SUGGESTIONS) {
      fetchSuggestions();
    }
  }, [isOpen, tenderText]);

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tender-suggestions`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ tenderText }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setSuggestions(data.suggestions.slice(0, 5));
        }
      }
    } catch (e) {
      console.warn('Failed to fetch dynamic suggestions, using defaults.', e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (messageContent?: string) => {
    const content = messageContent ?? input.trim();
    if (!content || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tender-chat`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          tenderId,
          tenderText,
          question: content,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Failed to get answer (${res.status}): ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const answerText = data.answer || 'No answer received.';

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: answerText,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get response. Please try again.';
      toast.error(errorMsg);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ ${errorMsg}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (question: string) => {
    sendMessage(question);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 p-3.5 rounded-full bg-[#f97316] hover:bg-[#ea6c0a] shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-200 group"
        aria-label="Open AI Assistant"
      >
        <div className="relative">
          <Sparkles size={22} className="text-white group-hover:scale-110 transition-transform" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0d0d0d] animate-pulse"></span>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-full max-w-[420px] h-[560px] max-h-[80vh] bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl flex flex-col shadow-2xl pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1c1c1c] bg-[#111111] rounded-t-2xl flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-[#f97316]" />
          <span className="text-sm font-semibold text-[#f5f5f5]">AI Assistant</span>
          <span className="text-xs text-[#525252]">• Tender Q&A</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 rounded-md hover:bg-[#ffffff10] text-[#525252] hover:text-[#f5f5f5] transition-colors"
          aria-label="Minimize chat"
        >
          <Minimize2 size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-xl text-sm ${
                msg.role === 'user'
                  ? 'bg-[#f97316] text-white'
                  : 'bg-[#1a1a1a] border border-[#242424] text-[#d4d4d4]'
              }`}
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {msg.content}
              <div className={`text-[9px] mt-1 ${msg.role === 'user' ? 'text-orange-200' : 'text-[#525252]'}`}>
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#1a1a1a] border border-[#242424] rounded-xl px-4 py-3">
              <Loader2 size={18} className="animate-spin text-[#f97316]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 🔥 Suggestions – Natural Wrap, No Scroll */}
      <div className="px-4 pb-2">
        {loadingSuggestions ? (
          <div className="flex items-center gap-2 text-xs text-[#525252]">
            <Loader2 size={12} className="animate-spin" />
            Generating suggestions...
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((question, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(question)}
                disabled={loading}
                className="px-2.5 py-1 text-[10px] bg-[#1a1a1a] border border-[#242424] rounded text-[#a3a3a3] hover:border-[#f97316]/50 hover:text-[#f5f5f5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {question}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[#1c1c1c] bg-[#111111] rounded-b-2xl flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the tender..."
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#0d0d0d] border border-[#242424] text-sm text-[#f5f5f5] placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50 resize-none min-h-[44px] max-h-32"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-xl bg-[#f97316] hover:bg-[#ea6c0a] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        <p className="text-[10px] text-[#525252] mt-1.5 text-center">
          Powered by AI · Answers based on the tender document only
        </p>
      </div>
    </div>
  );
}