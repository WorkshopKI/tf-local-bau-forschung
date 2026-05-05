/**
 * Globaler Keyboard-Listener fuer das Plugin "dokument-review".
 *   j / ArrowDown   naechster Eintrag in der gefilterten Liste
 *   k / ArrowUp     vorheriger Eintrag
 *   n               naechster offener Review-Eintrag (skipt non-review)
 *   Enter           Selektion fokussieren (no-op solange Detail offen)
 *   Escape          Selektion zuruecknehmen
 *   i               Irrelevant-Aktion auf selektiertem Eintrag
 *   r               Relevant-ohne-Zuordnung-Aktion auf selektiertem Eintrag
 *   a               Antrag-Autocomplete-Input fokussieren
 *
 * Tasten werden ignoriert wenn der Fokus in einem Input/Textarea/contenteditable
 * liegt (kollidiert sonst mit Texteingabe).
 */
import { useEffect, useMemo } from 'react';
import type { ManifestEntry } from '@/phase2';
import { useDokumentReviewStore } from '../store';
import { applyFilters, isInReviewQueue } from '../filtering';
import { useReviewActions } from '../hooks/useReviewActions';

interface Props {
  entries: ManifestEntry[];
  onReloadEntry: (filename: string) => Promise<void>;
  onRemoveEntry: (filename: string) => void;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export function KeyboardHandler({ entries, onReloadEntry, onRemoveEntry }: Props): null {
  const viewMode = useDokumentReviewStore(s => s.viewMode);
  const confidenceFilter = useDokumentReviewStore(s => s.confidenceFilter);
  const docTypeFilter = useDokumentReviewStore(s => s.docTypeFilter);
  const sourceFilter = useDokumentReviewStore(s => s.sourceFilter);
  const sortKey = useDokumentReviewStore(s => s.sortKey);
  const selectedFilename = useDokumentReviewStore(s => s.selectedFilename);
  const setSelected = useDokumentReviewStore(s => s.setSelected);

  const filtered = useMemo(
    () => applyFilters(entries, { viewMode, confidenceFilter, docTypeFilter, sourceFilter, sortKey }),
    [entries, viewMode, confidenceFilter, docTypeFilter, sourceFilter, sortKey],
  );

  const actions = useReviewActions(
    async (filename) => { await onReloadEntry(filename); },
    (filename) => { onRemoveEntry(filename); },
  );

  useEffect(() => {
    if (viewMode === 'pending') return;

    const handler = (e: KeyboardEvent): void => {
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const idx = selectedFilename ? filtered.findIndex(x => x.filename === selectedFilename) : -1;
      const current = idx >= 0 ? filtered[idx] : null;

      switch (e.key) {
        case 'j':
        case 'ArrowDown': {
          e.preventDefault();
          const next = idx >= 0 ? filtered[Math.min(filtered.length - 1, idx + 1)] : filtered[0];
          if (next) setSelected(next.filename);
          break;
        }
        case 'k':
        case 'ArrowUp': {
          e.preventDefault();
          const prev = idx > 0 ? filtered[idx - 1] : filtered[0];
          if (prev) setSelected(prev.filename);
          break;
        }
        case 'n': {
          e.preventDefault();
          const start = idx >= 0 ? idx + 1 : 0;
          const next = filtered.slice(start).find(isInReviewQueue) ?? filtered.find(isInReviewQueue);
          if (next) setSelected(next.filename);
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setSelected(null);
          break;
        }
        case 'i': {
          if (!current) return;
          e.preventDefault();
          void (async () => {
            await actions.markIrrelevant(current);
            const nextIdx = filtered.findIndex(x => x.filename === current.filename);
            const next = filtered[nextIdx + 1] ?? filtered[nextIdx - 1] ?? null;
            setSelected(next?.filename ?? null);
          })();
          break;
        }
        case 'r': {
          if (!current) return;
          e.preventDefault();
          void (async () => {
            await actions.confirmRelevantWithoutMatch(current);
            const nextIdx = filtered.findIndex(x => x.filename === current.filename);
            const next = filtered[nextIdx + 1] ?? filtered[nextIdx - 1] ?? null;
            setSelected(next?.filename ?? null);
          })();
          break;
        }
        case 'a': {
          e.preventDefault();
          const input = document.querySelector<HTMLInputElement>('[data-tf-autocomplete-input="true"]');
          input?.focus();
          input?.select();
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); };
  }, [actions, filtered, selectedFilename, setSelected, viewMode]);

  return null;
}
