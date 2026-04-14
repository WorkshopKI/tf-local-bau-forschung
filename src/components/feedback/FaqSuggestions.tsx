// Inline FAQ-Vorschläge bei Kategorie "Frage".
// Debounced (500ms) Wort-Overlap-Matching gegen alle FAQ-Einträge.

import { useEffect, useState } from 'react';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { getFeedbackList, matchFaqEntries } from '@/core/services/feedback';
import type { FeedbackItem } from '@/core/types/feedback';

interface Props {
  input: string;
  onFaqViewed?: (faqId: string) => void;
}

export function FaqSuggestions({ input, onFaqViewed }: Props): React.ReactElement | null {
  const storage = useStorage();
  const [allFaqs, setAllFaqs] = useState<FeedbackItem[]>([]);
  const [matches, setMatches] = useState<Array<{ item: FeedbackItem; score: number }>>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Lade FAQs einmalig beim Mount
  useEffect(() => {
    let cancelled = false;
    getFeedbackList(storage).then(items => {
      if (!cancelled) setAllFaqs(items.filter(i => i.is_faq && i.faq_answer));
    });
    return () => { cancelled = true; };
  }, [storage]);

  // Debounced Matching
  useEffect(() => {
    if (!input.trim() || allFaqs.length === 0) {
      setMatches([]);
      return;
    }
    const handle = setTimeout(() => {
      setMatches(matchFaqEntries(input, allFaqs));
    }, 500);
    return () => clearTimeout(handle);
  }, [input, allFaqs]);

  if (matches.length === 0) return null;

  return (
    <div className="rounded-[var(--tf-radius)] p-3 bg-[var(--tf-warning-bg)]" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <Lightbulb size={14} className="text-[var(--tf-warning-text)]" />
        <span className="text-[12px] font-semibold text-[var(--tf-warning-text)]">Ähnliche Fragen (bereits beantwortet)</span>
      </div>
      <div className="space-y-1.5">
        {matches.map(({ item }) => {
          const summary = item.llm_summary || item.text || '–';
          const isOpen = expandedId === item.id;
          const askCount = item.faq_ask_count ?? 0;
          return (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => {
                  const next = isOpen ? null : item.id;
                  setExpandedId(next);
                  if (next && onFaqViewed) onFaqViewed(item.id);
                }}
                className="w-full text-left flex items-start gap-1.5 cursor-pointer text-[12.5px] text-[var(--tf-text)] hover:text-[var(--tf-primary)]"
              >
                <ChevronDown
                  size={14}
                  className={`mt-0.5 transition-transform ${isOpen ? 'rotate-180' : '-rotate-90'} text-[var(--tf-text-tertiary)]`}
                />
                <span className="flex-1">
                  {summary}
                  {askCount > 0 && (
                    <span className="ml-1.5 text-[10.5px] text-[var(--tf-text-tertiary)]">
                      · {askCount}× gefragt
                    </span>
                  )}
                </span>
              </button>
              {isOpen && item.faq_answer && (
                <div className="mt-1 ml-5 p-2 rounded-[var(--tf-radius)] bg-[var(--tf-bg)] text-[12px] text-[var(--tf-text-secondary)] whitespace-pre-wrap" style={{ border: '0.5px solid var(--tf-border)' }}>
                  {item.faq_answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10.5px] text-[var(--tf-text-tertiary)]">
        Keine davon? Schreibe deine Frage trotzdem unten.
      </p>
    </div>
  );
}
