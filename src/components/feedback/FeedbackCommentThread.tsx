// Kommentar-Thread + Eingabe (Redesign v2.199) für den Detail-Drawer.
// Append-only über `addComment` (useAsyncAction, kein silent-fail). Ohne Identität
// (meId) ist die Eingabe deaktiviert (Read-only-Anzeige).
//
// Das Eingabefeld wächst beim Schreiben mit (Rezept aus dem Chat-Composer) UND
// lässt sich am nativen Anfasser ziehen. Beide schreiben `style.height` — damit sie
// sich nicht gegenseitig überschreiben, setzt das Ziehen die gemerkte MINDESThöhe,
// nicht eine feste Höhe (siehe `berechneKommentarHoehe`).

import { useLayoutEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { addComment } from '@/core/services/feedback';
import type { FeedbackItem } from '@/core/types/feedback';
import { berechneKommentarHoehe, clampKommentarHoehe, waehleKommentarVorschau } from './feedbackUi';
import { FeedbackAvatar } from './FeedbackAvatar';
import { FeedbackCommentList } from './FeedbackCommentList';

// Gerätelokale Darstellungs-Präferenz — kein Share, kein Snapshot, kein Schema.
// `-v1` im Schlüssel ist Absicht: ein späterer Wechsel der Grundhöhe muss auf `-v2`
// bumpen, sonst überstimmt eine einmal gemerkte kleinere Höhe den neuen Standard
// dauerhaft (der Grund, aus dem v2.357.0 `resizable` am Hilfe-Dialog zurücknahm).
const HOEHE_KEY = 'tf-feedback-kommentar-hoehe-v1';
const MIN_H = 56;   // ~2 Zeilen — Untergrenze fürs Ziehen
const MAX_H = 320;  // ~12 Zeilen — darüber scrollt das Feld intern

function leseGemerkteHoehe(): number | undefined {
  try { return clampKommentarHoehe(localStorage.getItem(HOEHE_KEY), MIN_H, MAX_H); } catch { return undefined; }
}

interface Props {
  ticket: FeedbackItem;
  meId?: string;
  meName?: string;
  onChanged: () => void;
  /** Beim Öffnen eingefrorene Zahl neuer Kommentare → die letzten N werden
   *  hervorgehoben. 0 = nichts hervorheben. */
  neueKommentare?: number;
}

export function FeedbackCommentThread({ ticket, meId, meName, onChanged, neueKommentare = 0 }: Props): React.ReactElement {
  const storage = useStorage();
  const [text, setText] = useState('');
  const comments = ticket.comments ?? [];

  const taRef = useRef<HTMLTextAreaElement>(null);
  const grundHoehe = useRef(0);
  const [gemerkt, setGemerkt] = useState<number | undefined>(leseGemerkteHoehe);

  // Auto-Wachsen. Layout-Effekt statt useEffect, damit die Höhe vor dem Paint steht
  // (sonst blitzt beim Öffnen die Ein-Zeilen-Höhe auf).
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    // Grundhöhe EINMAL messen, bevor irgendein Stil gesetzt ist: `height:'auto'`
    // hebelt `rows` aus, das leere Feld fiele sonst auf eine Zeile zusammen.
    if (grundHoehe.current === 0) grundHoehe.current = ta.offsetHeight;
    ta.style.height = 'auto';
    ta.style.height = `${berechneKommentarHoehe(ta.scrollHeight, grundHoehe.current, gemerkt, MAX_H)}px`;
  }, [text, gemerkt]);

  // Zieh-Geste erkennen: Höhe vor dem Zeiger-Druck merken, beim Loslassen
  // vergleichen. Bewusst KEIN ResizeObserver (wie am Dialog) — der kann
  // Tipp-Wachstum nicht vom Ziehen unterscheiden und würde die Mindesthöhe
  // beim Schreiben hochratschen. Ein bloßer Klick ins Feld ändert nichts.
  const merkeZiehen = (): void => {
    const ta = taRef.current;
    if (!ta) return;
    const vorher = ta.offsetHeight;
    window.addEventListener('pointerup', () => {
      const nachher = taRef.current?.offsetHeight ?? vorher;
      if (Math.abs(nachher - vorher) <= 1) return;
      const wert = Math.round(Math.max(MIN_H, Math.min(MAX_H, nachher)));
      setGemerkt(wert);
      try { localStorage.setItem(HOEHE_KEY, String(wert)); } catch { /* gesperrt → nur für die Sitzung */ }
    }, { once: true });
  };

  const submit = useAsyncAction(async () => {
    if (!meId || !text.trim()) return;
    const res = await addComment(storage, ticket.id, meId, text, meName);
    if (res.ok) { setText(''); onChanged(); }
  });

  return (
    <div className="space-y-2.5">
      <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] font-medium">
        Kommentare{comments.length > 0 ? ` (${comments.length})` : ''}
      </p>

      {comments.length === 0 ? (
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)] italic">Noch keine Kommentare.</p>
      ) : (
        // Dieselbe Auswahl-Funktion wie der Hover, nur ohne Grenzen: der Thread
        // zeigt alles und kürzt nichts.
        <FeedbackCommentList
          {...waehleKommentarVorschau(comments, {
            maxEintraege: Infinity,
            maxZeichen: Infinity,
            neuAnzahl: neueKommentare,
          })}
          variante="thread"
        />
      )}

      {/* Eingabe */}
      {meId ? (
        <div className="flex gap-2 items-start pt-0.5">
          <FeedbackAvatar name={meName || meId} size={20} className="mt-1.5" />
          <div className="flex-1 min-w-0 flex items-end gap-1.5">
            <textarea
              ref={taRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onPointerDown={merkeZiehen}
              placeholder="Kommentar schreiben …"
              rows={3}
              className="flex-1 min-w-0 px-2.5 py-1.5 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none resize-y placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
              style={{ border: '0.5px solid var(--tf-border)', minHeight: MIN_H, maxHeight: MAX_H }}
            />
            <button
              type="button"
              onClick={() => submit.run()}
              disabled={!text.trim() || submit.busy}
              className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-[var(--tf-radius)] bg-[var(--tf-primary)] text-[var(--tf-on-primary)] cursor-pointer disabled:opacity-40 disabled:cursor-default"
              aria-label="Kommentar senden"
              title="Kommentar senden"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-[var(--tf-text-tertiary)] italic">
          Zum Kommentieren im Profil anmelden.
        </p>
      )}
    </div>
  );
}
