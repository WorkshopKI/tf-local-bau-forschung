// Inline FAQ-Vorschläge bei Kategorie "Frage".
// Debounced (500ms) Wort-Overlap-Matching gegen alle FAQ-Einträge.

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { bumpFaqAskCount, getFeedbackList, matchFaqEntries } from '@/core/services/feedback';
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
  // Aufschlag auf den gespeicherten Zähler, solange das Panel offen ist — der
  // geschriebene Stand kommt erst beim nächsten Laden zurück.
  const [geradeGefragt, setGeradeGefragt] = useState<Record<string, number>>({});
  // Je FAQ nur EINMAL zählen: Auf- und Zuklappen ist eine Frage, keine drei.
  const gezaehlt = useRef<Set<string>>(new Set());

  /**
   * Der einzige Aufrufer von `bumpFaqAskCount` (v4.129). Bis dahin hatte die
   * Funktion keinen — die Spalte „Gefragt" im FAQ-Tab stand deshalb bei jedem
   * Eintrag dauerhaft auf „0×", obwohl die Vorschläge benutzt wurden.
   *
   * Best-effort: ein Schreibfehler darf das Aufklappen nicht verhindern. Ohne
   * Share-Schreibrecht (prod) ist `updateFeedback` ohnehin ein No-op — der
   * Zähler wächst dann beim Kurator, nicht beim Melder.
   */
  const zaehleFrage = (faqId: string): void => {
    if (gezaehlt.current.has(faqId)) return;
    gezaehlt.current.add(faqId);
    setGeradeGefragt(v => ({ ...v, [faqId]: (v[faqId] ?? 0) + 1 }));
    void bumpFaqAskCount(storage, faqId).catch(err => {
      console.warn('[FaqSuggestions] Frage-Zähler nicht gespeichert', err);
    });
  };

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
          const askCount = (item.faq_ask_count ?? 0) + (geradeGefragt[item.id] ?? 0);
          return (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => {
                  const next = isOpen ? null : item.id;
                  setExpandedId(next);
                  if (next) {
                    zaehleFrage(item.id);
                    onFaqViewed?.(item.id);
                  }
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
