// Feedback-Panel: 2-Step-Flow (Input → Bestätigung) + optional Chatbot + "Mein Feedback"-Tab.
// Slide-in von rechts unten, Schließen via Escape oder X.
// Die Kategorie steht über die Typ-Wahl im Eingabe-Schritt deterministisch fest;
// autoClassifyFeedback() verfeinert nur noch summary/details im Hintergrund.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useMeineFeedbackIdentitaet } from '@/core/hooks/useMeineFeedbackIdentitaet';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useBridgeStatus } from '@/core/services/ai/bridge-status';
import {
  autoClassifyFeedback,
  captureFeedbackContext,
  generateFeedbackId,
  submitFeedback,
  updateFeedback,
  type FeedbackImprovePayload,
} from '@/core/services/feedback';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { canWriteDatenShare } from '@/config/feature-flags';
import type { FeedbackContext, FeedbackItem } from '@/core/types/feedback';
import { TEAMFLOW_AREAS } from './constants';
import { FeedbackInputStep, type FeedbackSubmitPayload } from './FeedbackInputStep';
import { MyFeedbackList } from './MyFeedbackList';
import { FeedbackVerbessernFlow } from './FeedbackVerbessernFlow';
import type { FeedbackVorbelegung } from './useFeedbackDialog';

interface Props {
  open: boolean;
  onClose: () => void;
  /** true wenn per Shortcut (Strg+Alt+S) geöffnet → Screenshot-Paste-Fläche fokussieren. */
  focusScreenshot?: boolean;
  /** Typ/Titel vorwählen, wenn der Auslöser den Anlass kennt (z.B. „Hilfetext stimmt nicht"). */
  vorbelegung?: FeedbackVorbelegung | null;
}

type View = 'input' | 'confirm' | 'verbessern' | 'my-feedback';

// Panel-Breite: per Drag-Handle am linken Rand resizable + in localStorage
// persistiert (Pattern gespiegelt von AntraegeMain). Panel ist rechts verankert →
// nach links ziehen verbreitert.
//
// v4.36: 520 → 420, v4.39.2: 420 → 470 (im Testbetrieb zu eng). Der Schlüssel
// MUSS dabei jedes Mal mitwandern — ein gemerkter Wert schlägt sonst den
// Code-Default, und genau die Leute, die das Fenster mal gezogen haben, sähen
// die Änderung nie.
const PANEL_WIDTH_KEY = 'teamflow_feedback_panel_width_v3';
const PANEL_DEFAULT_WIDTH = 470;
const PANEL_MIN_WIDTH = 360;
const PANEL_MAX_WIDTH = 900;
/** Breite der zusammengeklappten Leiste während der Screenshot-Aufnahme. */
const PANEL_AUFNAHME_WIDTH = 320;
/** Deckkraft des Panel-Hintergrunds (v4.39.1) — der Rest lässt die App durch. */
const PANEL_DECKKRAFT = '88%';

/**
 * Der erfasste Kontext plus dem im Formular gewählten Bereich — Referenz UND
 * Klartext-Beschriftung.
 *
 * EINE Stelle für beide Verwendungen (v4.129): das Absenden setzte
 * `screenRefLabel`, der Verbessern-Ablauf daneben nur `screenRef`. Damit fehlte
 * der KI genau die Angabe, die `promptGenerator` als „Bereich-Referenz"
 * ausgibt — der Nutzer wählte einen Bereich, und die Verbesserung kannte ihn nicht.
 */
function mitBereich(basis: FeedbackContext, areaRef: string): FeedbackContext {
  const info = TEAMFLOW_AREAS.find(a => a.ref === areaRef);
  return { ...basis, screenRef: areaRef || undefined, screenRefLabel: info?.label };
}

function loadPanelWidth(): number {
  try {
    const v = Number(localStorage.getItem(PANEL_WIDTH_KEY));
    if (Number.isFinite(v) && v >= PANEL_MIN_WIDTH) return v;
  } catch { /* ignore */ }
  return PANEL_DEFAULT_WIDTH;
}

export function FeedbackPanel({ open, onClose, focusScreenshot, vorbelegung }: Props): React.ReactElement | null {
  const storage = useStorage();
  const { profile } = useProfile();
  const meinKuerzel = useMeinKuerzel();
  const ich = useMeineFeedbackIdentitaet();
  const { activeId, activeName: activePluginName, navigate } = useNavigation();
  const bridge = useAIBridge();
  const kiVerfuegbar = useBridgeStatus(s => s.status) === 'connected';

  const [view, setView] = useState<View>('input');
  const [areaRef, setAreaRef] = useState('');
  // true = für die Screenshot-Aufnahme zusammengeklappt (v4.36). Der Body bleibt
  // dabei GEMOUNTET und wird nur ausgeblendet — sonst wäre der Entwurf weg.
  const [aufnahme, setAufnahme] = useState(false);
  const [submitting, setSubmitting] = useState<'speichern' | 'verbessern' | null>(null);
  const [submittedItem, setSubmittedItem] = useState<FeedbackItem | null>(null);
  const [improvePayload, setImprovePayload] = useState<FeedbackImprovePayload | null>(null);
  // Read-only prod-Client: der persoenliche Handle, in dessen Outbox das Roh-Feedback
  // landete (v2.207.1). Nicht-null nur ohne Daten-Share-Schreibrecht → der Verbessern-
  // Ablauf schreibt die polierte Fassung in die Outbox zurück (sonst sammelt der Kurator
  // den Roh-Text ein). Bei Schreibrecht (Kurator/PL/dev) bleibt es null (Shared-Write greift).
  const [outboxHandle, setOutboxHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [context, setContext] = useState<FeedbackContext | null>(null);
  // Gescheitertes Absenden hat eine Stimme (v4.129): bis dahin landete der
  // Fehler nur in der Konsole, das Panel sprang zurück auf „Senden", und die
  // eigens für den Nutzer formulierte Meldung aus `submitFeedback` sah niemand.
  const [submitFehler, setSubmitFehler] = useState<string | null>(null);
  // Id des laufenden Versuchs — ein Wiederholungsklick schreibt dieselbe Id
  // statt eine Kopie anzulegen (siehe `SubmitFeedbackRouting.vorgabeId`).
  const versuchId = useRef<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(loadPanelWidth);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onResizeMouseDown = useCallback((e: React.MouseEvent): void => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: panelWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent): void => {
      const drag = dragRef.current;
      if (!drag) return;
      // Rechts verankert: nach links ziehen (negativer Delta) verbreitert.
      const delta = ev.clientX - drag.startX;
      const dynMax = Math.min(PANEL_MAX_WIDTH, window.innerWidth - 32);
      setPanelWidth(Math.min(dynMax, Math.max(PANEL_MIN_WIDTH, drag.startWidth - delta)));
    };
    const onUp = (): void => {
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  useEffect(() => {
    try { localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth)); } catch { /* ignore */ }
  }, [panelWidth]);

  // ESC-Handler. Im Aufnahme-Modus beendet Escape NUR diesen — das Panel zu
  // schließen hieße, den halb getippten Entwurf wegzuwerfen.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      if (aufnahme) { setAufnahme(false); return; }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, aufnahme]);

  // Reset + Context-Capture beim Öffnen
  useEffect(() => {
    if (open) {
      setView('input');
      setAreaRef('');
      setAufnahme(false);
      setSubmittedItem(null);
      setImprovePayload(null);
      setOutboxHandle(null);
      setSubmitFehler(null);
      versuchId.current = null;
      setContext(captureFeedbackContext(activeId, activePluginName));
    }
  }, [open, activeId, activePluginName]);

  const handleSubmit = useCallback(async (payload: FeedbackSubmitPayload) => {
    if (!payload.text.trim() || !context) return;
    setSubmitting(payload.verbessern ? 'verbessern' : 'speichern');
    setSubmitFehler(null);
    try {
      // Kanonische Schreib-Id (v3.7): dieselbe, die Stimmen und Kommentare
      // tragen. Bis hierher stand hier `profile.name`, verglichen wurde aber
      // gegen das Kürzel — damit war jedes eigene Ticket fremd. Bestandsdaten
      // heilt der tolerante Lesepfad (feedbackIdentitaet), nicht eine Migration.
      const userId = ich.schreibId ?? 'anonymous';
      const fullContext = mitBereich(context, areaRef);
      // Erster Versuch vergibt die Id, jeder weitere schreibt auf dieselbe.
      versuchId.current ??= generateFeedbackId();
      // Dispatch: Clients mit Daten-Share-Schreibrecht (Kurator / PL via
      // datenShareSchreibrecht / dev) schreiben direkt ins geteilte Feedback-File
      // (sofort für alle sichtbar); read-only-Clients (prod-Enduser) in die
      // pers. Outbox, die der Kurator einsammelt.
      const isKurator = profile?.is_kurator === true || profile?.is_admin === true;
      const canWriteShared = canWriteDatenShare(isKurator);
      const persHandle = canWriteShared ? null : await getPersoenlichHandle(storage.idb).catch(() => null);
      // Kategorie steht deterministisch aus der Typ-Wahl fest (kein LLM nötig).
      const item = await submitFeedback(storage, {
        user_id: userId,
        user_display_name: profile?.name,
        title: payload.title,
        category: payload.category,
        structured: payload.structured,
        text: payload.text,
        context: fullContext,
      }, {
        isKurator,
        writeToShared: canWriteShared,
        persHandle,
        kuerzel: meinKuerzel,
        vorgabeId: versuchId.current,
      }, payload.attachments);
      setSubmittedItem(item);
      // Ab hier ist die Eingabe beim Team — die nächste ist eine neue.
      versuchId.current = null;

      if (payload.verbessern) {
        // Geführter Verbessern-Ablauf: Roh-Feedback ist bereits gespeichert (nie
        // verlieren), jetzt in den interaktiven Wizard (Rückfragen → generieren →
        // editieren/speichern). Die KI-Calls laufen intern-only in FeedbackVerbessernFlow.
        // Ohne Schreibrecht landete das Roh-Feedback in der pers. Outbox → der Handle
        // wird durchgereicht, damit die Verbesserung sie überschreibt (Kurator-Parität).
        setOutboxHandle(canWriteShared ? null : persHandle);
        setImprovePayload({ text: payload.text, structured: payload.structured, category: payload.category });
        setView('verbessern');
      } else {
        setView('confirm');
        // Fire-and-forget Hintergrund-Verfeinerung (blockiert UI nicht). Überschreibt
        // die per Typ-Wahl gesetzte category NICHT — nur summary/Klassifikations-Meta.
        // Läuft NIE auf Streamlit → in prod (interne Bridge only) faktisch nie.
        const transport = bridge.getActiveTransport();
        void autoClassifyFeedback(transport, payload.text, fullContext, areaRef || undefined, payload.llmHint)
          .then((classification) => {
            if (!classification) return;
            return updateFeedback(storage, item.id, {
              llm_classification: classification,
              llm_summary: classification.summary,
            });
          });
      }
    } catch (err) {
      console.error('[FeedbackPanel] submit failed', err);
      // Die Meldungen aus `submitFeedback` sind für genau diese Stelle
      // geschrieben („liegt lokal, ist aber noch nicht beim Team") — sie gehören
      // vor den Nutzer, nicht in die Konsole. Der Entwurf bleibt stehen.
      setSubmitFehler(
        err instanceof Error && err.message
          ? err.message
          : 'Das Feedback konnte nicht gespeichert werden. Bitte gleich noch einmal versuchen.',
      );
    } finally {
      setSubmitting(null);
    }
  }, [activeId, areaRef, context, profile, ich, meinKuerzel, storage, bridge]);

  if (!open) return null;

  return (
    <div
      className="fixed bottom-20 right-4 z-40 max-w-[calc(100vw-2rem)] rounded-[12px] shadow-2xl flex flex-col overflow-hidden"
      style={{
        width: aufnahme ? PANEL_AUFNAHME_WIDTH : panelWidth,
        border: '0.5px solid var(--tf-border)',
        maxHeight: 'calc(100vh - 6rem)',
        // Leicht durchscheinend, damit man sieht, worüber das Fenster liegt. Der
        // Weichzeichner ist kein Effekt, sondern die Bedingung dafür: ohne ihn
        // stünde der scharfe Text darunter als Geisterbild im Formular.
        background: `color-mix(in srgb, var(--tf-bg) ${PANEL_DECKKRAFT}, transparent)`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      role="dialog"
      aria-label="Feedback"
    >
      {/* Resize-Handle am linken Rand (Panel ist rechts verankert → links ziehen verbreitert) */}
      {!aufnahme && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Breite ändern"
          onMouseDown={onResizeMouseDown}
          className="absolute left-0 top-0 h-full w-[6px] cursor-col-resize hover:bg-[var(--tf-border-hover)] z-10"
          style={{ touchAction: 'none' }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
        <div className="flex items-center gap-2">
          {view !== 'input' && view !== 'my-feedback' && (
            <button
              type="button"
              onClick={() => setView('input')}
              className="p-1 rounded hover:bg-[var(--tf-hover)] cursor-pointer text-[var(--tf-text-tertiary)]"
              aria-label="Zurück"
            >
              <ArrowLeft size={14} />
            </button>
          )}
          {/* Panel-Titel auf der Größe des geteilten Dialog-Kopfes (15px) — er
              stand auf 13px und damit fast gleichauf mit dem Formularinhalt
              (12.5px), also trug die Hierarchie niemand. */}
          <span className="text-[15px] font-medium text-[var(--tf-text)]">
            {aufnahme ? 'Screenshot aufnehmen' : view === 'my-feedback' ? 'Mein Feedback' : 'Feedback'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--tf-hover)] cursor-pointer text-[var(--tf-text-tertiary)]"
          aria-label="Schließen"
        >
          <X size={14} />
        </button>
      </div>

      {/* Aufnahme-Leiste — ersetzt sichtbar den Body, ohne ihn auszuhängen. */}
      {aufnahme && (
        <div className="px-3.5 py-3 space-y-2">
          <p className="text-[12px] text-[var(--tf-text)] leading-[1.5]">
            Jetzt <strong>Win+Shift+S</strong> drücken und den Bereich aufziehen — danach
            <strong> Strg+V</strong>. Das Fenster geht dann von selbst wieder auf.
          </p>
          <Button type="button" variant="secondary" onClick={() => setAufnahme(false)}>Abbrechen</Button>
        </div>
      )}

      {/* Body */}
      <div className={`flex-1 overflow-y-auto ${aufnahme ? 'hidden' : ''}`}>
        {view === 'input' && submitFehler && (
          <div
            role="alert"
            className="mx-3.5 mt-3 p-2.5 rounded-[var(--tf-radius)] bg-[var(--tf-danger-bg)] text-[12px] leading-relaxed text-[var(--tf-danger-text)]"
          >
            {submitFehler}
          </div>
        )}
        {view === 'input' && context && (
          <FeedbackInputStep
            areaRef={areaRef}
            setAreaRef={setAreaRef}
            context={context}
            submitting={submitting}
            kiVerfuegbar={kiVerfuegbar}
            onSubmit={handleSubmit}
            onShowMyFeedback={() => setView('my-feedback')}
            autoFocusScreenshot={focusScreenshot}
            vorbelegung={vorbelegung}
            aufnahme={aufnahme}
            onAufnahme={setAufnahme}
          />
        )}

        {view === 'confirm' && submittedItem && (
          <ConfirmStep onDone={onClose} />
        )}

        {view === 'verbessern' && submittedItem && improvePayload && context && (
          <FeedbackVerbessernFlow
            feedbackId={submittedItem.id}
            payload={improvePayload}
            context={mitBereich(context, areaRef)}
            pluginId={activeId}
            outboxHandle={outboxHandle}
            onClose={onClose}
          />
        )}

        {view === 'my-feedback' && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setView('input')}
                className="text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft size={12} /> Neues Feedback
              </button>
              <button
                type="button"
                onClick={() => { onClose(); navigate('feedback-board'); }}
                className="text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] inline-flex items-center gap-1 cursor-pointer"
              >
                Feedback-Board →
              </button>
            </div>
            <MyFeedbackList />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-Komponenten ──────────────────────────────────────────────────────────

function ConfirmStep({ onDone }: { onDone: () => void }): React.ReactElement {
  return (
    <div className="p-4 text-center space-y-3">
      <div className="w-12 h-12 mx-auto rounded-full bg-[var(--tf-success-bg)] flex items-center justify-center">
        <Check size={22} className="text-[var(--tf-success-text)]" />
      </div>
      <p className="text-[14px] font-medium text-[var(--tf-text)]">Danke für dein Feedback!</p>
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
        Es ist gespeichert und sichtbar unter „Mein Feedback".
      </p>
      <div className="pt-1">
        <Button type="button" onClick={onDone} variant="primary">Fertig</Button>
      </div>
    </div>
  );
}
