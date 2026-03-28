import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, RefreshCw, MessageSquare, FolderOpen, X } from 'lucide-react';
import { Button, Badge, MarkdownRenderer } from '@/ui';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useStorage } from '@/core/hooks/useStorage';
import type { DirectoryEntry } from '@/core/types/config';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function ChatView(): React.ReactElement {
  const bridge = useAIBridge();
  const storage = useStorage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDirs, setSelectedDirs] = useState<DirectoryEntry[]>([]);
  const [showDirPicker, setShowDirPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const docDirs = storage.getDocDirectories();

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, loading]);

  const loadContextFromDirs = async (): Promise<string> => {
    if (selectedDirs.length === 0) return '';
    const parts: string[] = [];
    for (const dir of selectedDirs) {
      const store = storage.getDirectoryStore(dir.id);
      if (!store) continue;
      try {
        const files = await store.listFiles('.', '.md');
        for (const file of files.slice(0, 5)) {
          try {
            const content = await store.readFile(file);
            parts.push(`--- ${dir.label}/${file} ---\n${content.slice(0, 2000)}`);
          } catch { /* skip unreadable files */ }
        }
      } catch { /* skip */ }
    }
    return parts.length > 0 ? `\n\nContext aus Verzeichnissen:\n${parts.join('\n\n')}` : '';
  };

  const sendMessage = useCallback(async (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg || loading) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);
    try {
      const context = await loadContextFromDirs();
      const fullMessage = context ? `${msg}${context}` : msg;
      const response = await bridge.getActiveTransport().submitMessage(fullMessage);
      setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: response }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, loading, bridge, selectedDirs]);

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const toggleDir = (dir: DirectoryEntry): void => {
    setSelectedDirs(prev => prev.find(d => d.id === dir.id) ? prev.filter(d => d.id !== dir.id) : [...prev, dir]);
  };

  const providerName = bridge.getActiveProviderName();

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare size={40} className="text-[var(--tf-text-tertiary)] mb-4" />
            <p className="text-[var(--tf-text-secondary)]">Wie kann ich helfen?</p>
            <Badge variant="default">via {providerName}</Badge>
          </div>
        )}
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-[var(--tf-radius-lg)] text-[13.5px] ${
                msg.role === 'user' ? 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]' : 'text-[var(--tf-text)]'
              }`}>
                {msg.role === 'assistant' ? <MarkdownRenderer content={msg.content} /> : <p className="whitespace-pre-wrap">{msg.content}</p>}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="px-4 py-3">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 bg-[var(--tf-text-tertiary)] rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-[var(--tf-text-tertiary)] rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="w-1.5 h-1.5 bg-[var(--tf-text-tertiary)] rounded-full animate-bounce [animation-delay:0.2s]" />
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="flex justify-start">
              <div className="bg-[var(--tf-danger-bg)] px-4 py-3 rounded-[var(--tf-radius-lg)] text-[13px]" style={{ border: '0.5px solid var(--tf-danger-border)' }}>
                <p className="text-[var(--tf-danger-text)] mb-2">{error}</p>
                <Button variant="ghost" icon={RefreshCw} size="sm"
                  onClick={() => { const last = messages.filter(m => m.role === 'user').pop(); if (last) sendMessage(last.content); }}>
                  Erneut versuchen
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="p-4" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <div className="max-w-2xl mx-auto">
          {/* Context chips */}
          {selectedDirs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedDirs.map(dir => (
                <span key={dir.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-[var(--tf-info-bg)] text-[var(--tf-info-text)] rounded-full">
                  {dir.label}
                  <button onClick={() => toggleDir(dir)} className="cursor-pointer"><X size={10} /></button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            {docDirs.length > 0 && (
              <div className="relative">
                <button onClick={() => setShowDirPicker(prev => !prev)}
                  className="p-3 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-hover)] rounded-[var(--tf-radius)] cursor-pointer"
                  title="Context hinzufügen">
                  <FolderOpen size={16} />
                </button>
                {showDirPicker && (
                  <div className="absolute bottom-full left-0 mb-1 bg-[var(--tf-bg)] rounded-[var(--tf-radius)] py-1 min-w-[180px] z-10"
                    style={{ border: '0.5px solid var(--tf-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                    <p className="px-3 py-1 text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">Context</p>
                    {docDirs.map(dir => (
                      <button key={dir.id} onClick={() => { toggleDir(dir); setShowDirPicker(false); }}
                        className={`w-full text-left px-3 py-1.5 text-[13px] cursor-pointer ${
                          selectedDirs.find(d => d.id === dir.id) ? 'text-[var(--tf-primary)]' : 'text-[var(--tf-text)] hover:bg-[var(--tf-hover)]'
                        }`}>
                        {selectedDirs.find(d => d.id === dir.id) ? '✓ ' : ''}{dir.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Nachricht eingeben..." rows={1}
              className="flex-1 px-4 py-3 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none resize-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
              style={{ border: '0.5px solid var(--tf-border)' }} />
            <Button icon={Send} disabled={!input.trim() || loading} onClick={() => sendMessage()} />
          </div>
          <div className="mt-2">
            <Badge variant="default">via {providerName}</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
