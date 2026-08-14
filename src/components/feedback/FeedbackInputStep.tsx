// Strukturierter Feedback-Eingabe-Schritt: erst Typ-Wahl, dann typspezifische
// Felder. Deterministisch + LLM-unabhängig (die Kategorie steht über die Typ-Wahl
// fest). Ausgelagert aus FeedbackPanel.tsx (300-Zeilen-Regel).
//
// v4.36 — kompakter Haushalt: Bereichsauswahl + App-Kontext-ⓘ sitzen in der
// Kopfzeile des Formulars (statt als zwei eigene Zeilen unten), das Titel-Feld
// trägt seine Beschriftung im Platzhalter, und der Erklärtext zum Verbessern
// hängt als ⓘ am Knopf. Die erkannte Seite steht als feste Beschriftung im
// Titel-Rahmen (v4.39.1) — im Wert hätte sie den Platzhalter verdeckt.

import { useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import { Camera, ChevronDown, ChevronRight, Info, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import type { FeedbackCategory, FeedbackContext } from '@/core/types/feedback';
import {
  FEEDBACK_TYPES,
  TEAMFLOW_AREAS,
  composeFeedbackText,
  sichtbareFelder,
  type FeedbackTypeDef,
} from './constants';
import { FaqSuggestions } from './FaqSuggestions';
import { FeedbackScreenshotInput, type FeedbackScreenshotHandle } from './FeedbackScreenshotInput';
import { FeedbackFileInput } from './FeedbackFileInput';
import type { PendingAttachment } from './feedbackAttachments';
import type { FeedbackVorbelegung } from './useFeedbackDialog';

const VISIBLE_AREAS = TEAMFLOW_AREAS;

export interface FeedbackSubmitPayload {
  category: FeedbackCategory;
  /** Optionaler, scannbarer Titel (Redesign v2.199); leer → UI leitet aus der
   *  Hauptantwort ab. */
  title?: string;
  /** Strukturierte Felder; undefined bei Ein-Feld-Typen (Lob/Frage). */
  structured?: Record<string, string>;
  /** Lesbarer Fließtext (Board/Liste/Suche rendern darauf). */
  text: string;
  /** LLM-Hint für die fire-and-forget-Verfeinerung (falls ein LLM läuft). */
  llmHint?: string;
  /** Beigefügte (ggf. annotierte) Screenshots — Blobs, noch nicht persistiert. */
  attachments?: PendingAttachment[];
  /** true = "Feedback speichern & verbessern" (interne KI formt eine Anforderung). */
  verbessern?: boolean;
}

interface Props {
  areaRef: string;
  setAreaRef: (v: string) => void;
  context: FeedbackContext;
  submitting: 'speichern' | 'verbessern' | null;
  /** true wenn die interne KI (Bridge) verbunden ist → zweiter CTA "… & verbessern". */
  kiVerfuegbar: boolean;
  onSubmit: (payload: FeedbackSubmitPayload) => void;
  onShowMyFeedback: () => void;
  /** true wenn das Panel per Shortcut (Strg+Alt+S) geöffnet wurde → Paste-Fläche fokussieren. */
  autoFocusScreenshot?: boolean;
  /**
   * Typ + Titel vorwählen, wenn der Auslöser den Anlass kennt. Greift nur beim
   * Mounten (das Panel unmountet beim Schließen) — „Typ ändern" bleibt frei.
   */
  vorbelegung?: FeedbackVorbelegung | null;
  /** true = das Panel ist für die Screenshot-Aufnahme zusammengeklappt (v4.36). */
  aufnahme: boolean;
  /** Aufnahme-Modus starten/beenden — der Zustand liegt im Panel (es klappt sich zusammen). */
  onAufnahme: (aktiv: boolean) => void;
}

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;
function getIcon(name: string): IconComponent {
  const icon = (Icons as Record<string, unknown>)[name];
  if (typeof icon === 'object' && icon !== null) return icon as IconComponent;
  return Icons.MessageCircle;
}

export function FeedbackInputStep(props: Props): React.ReactElement {
  const { areaRef, setAreaRef, context, submitting, kiVerfuegbar, onSubmit, onShowMyFeedback, autoFocusScreenshot, vorbelegung, aufnahme, onAufnahme } = props;
  // Der Titel beginnt mit der erkannten Seite („Home: "), damit im Board auf
  // einen Blick steht, worum es geht — ohne dass jemand sie abtippt. Das Präfix
  // steht FEST vor dem Feld (v4.39.1): stand es im Wert, verdeckte es den
  // Platzhalter, und niemand sah mehr, dass dort noch etwas hingehört.
  const titelPraefix = `${context.page}: `;
  const [selectedType, setSelectedType] = useState<FeedbackTypeDef | null>(
    () => FEEDBACK_TYPES.find(t => t.category === vorbelegung?.kategorie) ?? null,
  );
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  // Nur der vom Nutzer geschriebene Teil — ohne das Präfix (siehe doSubmit).
  const [titelRest, setTitelRest] = useState(vorbelegung?.titel ?? '');
  // Screenshots + Dateien sind typ-unabhängig → überleben einen Typ-Wechsel (kein Reset in changeType).
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [fileAttachments, setFileAttachments] = useState<PendingAttachment[]>([]);
  const firstFieldRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const screenshotRef = useRef<FeedbackScreenshotHandle>(null);
  // Gesetzt = der Screenshot-Nudge ist aktiv (knappe Eingabe ohne Anhang). Merkt sich,
  // welcher Button gedrückt wurde, damit „Trotzdem senden" korrekt weiterläuft.
  const [nudge, setNudge] = useState<{ verbessern: boolean } | null>(null);

  // Zurück aus der Aufnahme: an die Screenshot-Fläche scrollen (dort steht die
  // neue Miniatur) und sie fokussieren — ein zweiter Strg+V geht direkt.
  // MUSS vor dem Early-Return der Typ-Auswahl stehen (Hook-Reihenfolge).
  const warAufnahme = useRef(aufnahme);
  useEffect(() => {
    if (warAufnahme.current && !aufnahme) screenshotRef.current?.focus();
    warAufnahme.current = aufnahme;
  }, [aufnahme]);

  // Der Typ-Wechsel verwirft NICHTS (v4.39.1): wer schon getippt hat und nur
  // nachsieht, ob ein anderer Typ besser passt, kam bis dahin mit leeren Boxen
  // zurück — während der Screenshot dranblieb, was den Verlust erst recht wie
  // einen Fehler aussehen ließ. Die Werte hängen am Feld-Key; nur die Felder des
  // gewählten Typs werden gerendert und gesendet, Fremdes bleibt liegen.
  const chooseType = (type: FeedbackTypeDef): void => {
    setSelectedType(type);
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  };

  const changeType = (): void => {
    setSelectedType(null);
    setNudge(null);
  };

  const setField = (key: string, value: string): void => {
    setFieldValues(prev => ({ ...prev, [key]: value }));
  };

  // Typ-Auswahl ─────────────────────────────────────────────────────────────
  if (!selectedType) {
    return (
      <div className="p-3 space-y-2.5">
        <label className="text-[12.5px] text-[var(--tf-text-secondary)] block">
          Was möchtest du uns mitteilen?
        </label>
        <div className="flex flex-col gap-1.5">
          {FEEDBACK_TYPES.filter(t => t.primary).map(type => (
            <TypeButton key={type.category} type={type} prominent onClick={() => chooseType(type)} />
          ))}
          <div className="flex flex-row gap-1.5 pt-0.5">
            {FEEDBACK_TYPES.filter(t => !t.primary).map(type => (
              <TypeButton key={type.category} type={type} onClick={() => chooseType(type)} />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onShowMyFeedback}
          className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-[var(--tf-radius)] text-[11.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
        >
          <MessageSquare size={12} /> Mein Feedback ansehen
        </button>
      </div>
    );
  }

  // Feld-Set ──────────────────────────────────────────────────────────────────
  // Bestands-Felder (`legacy`) stehen nicht mehr im Formular — sie bleiben nur im
  // Schema, damit Alt-Tickets weiter gelesen werden.
  const felder = sichtbareFelder(selectedType);

  const canSubmit = felder
    .filter(f => f.required)
    .every(f => (fieldValues[f.key] ?? '').trim().length > 0);

  // Screenshot-Nudge: bei Mehrfeld-Typen ("funktioniert nicht" / "wünsche mir etwas"),
  // wenn nur eine Box gefüllt ist UND noch kein Anhang dranhängt, vor dem Senden auf die
  // Screenshot-Option hinweisen. Ein-Feld-Typen (Frage/Lob) sind bewusst ausgenommen.
  const gefuellteFelder = felder
    .filter(f => (fieldValues[f.key] ?? '').trim().length > 0).length;
  const hatAnhang = attachments.length + fileAttachments.length > 0;
  const sollNudgen = felder.length > 1 && gefuellteFelder <= 1 && !hatAnhang;

  const doSubmit = (verbessern: boolean): void => {
    const isSingleText = felder.length === 1 && felder[0]?.key === 'text';
    const structured = isSingleText
      ? undefined
      : Object.fromEntries(
          felder
            .map(f => [f.key, (fieldValues[f.key] ?? '').trim()] as const)
            .filter(([, v]) => v.length > 0),
        );
    // Nichts geschrieben = kein Titel; `feedbackTitle()` leitet ihn wie bisher
    // aus der Hauptantwort ab, statt 40 Tickets „Home:" zu nennen.
    const rest = titelRest.trim();
    onSubmit({
      category: selectedType.category,
      title: rest ? `${titelPraefix}${rest}` : undefined,
      structured: structured && Object.keys(structured).length > 0 ? structured : undefined,
      text: composeFeedbackText(selectedType, fieldValues),
      llmHint: selectedType.llmHint,
      // Screenshots (Bilder) + beigefügte Dateien laufen durch dieselbe attachments-Kette.
      attachments: attachments.length + fileAttachments.length > 0 ? [...attachments, ...fileAttachments] : undefined,
      verbessern,
    });
  };

  const handleSubmit = (verbessern: boolean): void => {
    // Knappe Eingabe ohne Anhang → erst den Screenshot-Hinweis zeigen (ein Klick). Beim
    // zweiten Klick ist `nudge` gesetzt, der Guard fällt durch und es wird gesendet.
    if (sollNudgen && !nudge) {
      setNudge({ verbessern });
      return;
    }
    doSubmit(verbessern);
  };

  const TypeIcon = getIcon(selectedType.icon);

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={changeType}
          className="inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
        >
          <ChevronRight size={12} className="rotate-180" /> Typ ändern
        </button>
        <div className="flex items-center gap-0.5 shrink-0">
          <BereichAuswahl seite={context.page} areaRef={areaRef} setAreaRef={setAreaRef} />
          <KontextInfo context={context} />
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--tf-text)]">
        <TypeIcon size={14} className="text-[var(--tf-text-secondary)]" />
        {selectedType.label}
      </div>

      {/* Seiten-Präfix als feste Beschriftung IM Feldrahmen: stünde es im Wert,
          bliebe der Platzhalter unsichtbar — und mit ihm der Hinweis, dass hier
          noch ein Titel hingehört. Das umschließende <label> macht auch das
          Präfix zur Klickfläche fürs Feld. */}
      <label
        className="flex items-center w-full pl-2.5 pr-1 rounded-[var(--tf-radius)] cursor-text"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <span className="shrink-0 text-[12.5px] text-[var(--tf-text-secondary)] select-none">{titelPraefix}</span>
        <input
          value={titelRest}
          onChange={e => setTitelRest(e.target.value)}
          aria-label="Titel (optional)"
          placeholder="kurz, worum es geht (optional)"
          maxLength={90}
          className="flex-1 min-w-0 py-1.5 pr-1.5 text-[12.5px] bg-transparent text-[var(--tf-text)] outline-none border-none placeholder:text-[var(--tf-text-tertiary)]"
        />
      </label>

      {felder.map((field, idx) => (
        <div key={field.key} className="flex flex-col gap-0.5">
          <label className="text-[11.5px] text-[var(--tf-text-secondary)]">
            {field.label}
            {field.required
              ? <span className="text-[var(--tf-danger-text)]"> *</span>
              : <span className="text-[var(--tf-text-tertiary)]"> (optional)</span>}
          </label>
          {field.multiline === false ? (
            <input
              ref={idx === 0 ? (el => { firstFieldRef.current = el; }) : undefined}
              value={fieldValues[field.key] ?? ''}
              onChange={e => setField(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-2.5 py-1.5 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
              style={{ border: '0.5px solid var(--tf-border)' }}
            />
          ) : (
            <textarea
              ref={idx === 0 ? (el => { firstFieldRef.current = el; }) : undefined}
              value={fieldValues[field.key] ?? ''}
              onChange={e => setField(field.key, e.target.value)}
              placeholder={field.placeholder}
              rows={field.required ? 3 : 2}
              className="w-full px-2.5 py-2 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none resize-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
              style={{ border: '0.5px solid var(--tf-border)' }}
            />
          )}
        </div>
      ))}

      <FaqSuggestions input={composeFeedbackText(selectedType, fieldValues)} />

      <FeedbackScreenshotInput
        ref={screenshotRef}
        attachments={attachments}
        onChange={next => { setAttachments(next); setNudge(null); }}
        autoFocus={autoFocusScreenshot}
        aufnahme={aufnahme}
        onAufnahme={onAufnahme}
      />

      <FeedbackFileInput files={fileAttachments} onChange={setFileAttachments} />

      {nudge && (
        <div
          className="flex flex-col gap-2 px-3 py-2.5 rounded-[var(--tf-radius)] bg-[var(--tf-warning-bg)]"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          <div className="flex items-start gap-1.5 text-[11.5px] text-[var(--tf-warning-text)]">
            <Camera size={13} className="shrink-0 mt-0.5" />
            <span>Nur wenig ausgefüllt — ein Screenshot hilft uns oft, dich schneller zu verstehen.</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setNudge(null); screenshotRef.current?.focus(); }}
            >
              Screenshot hinzufügen
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => { const v = nudge.verbessern; setNudge(null); doSubmit(v); }}
            >
              Trotzdem senden
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {kiVerfuegbar && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={!canSubmit}
              loading={submitting === 'verbessern'}
              variant="primary"
              className="flex-1"
            >
              Feedback speichern & verbessern
            </Button>
            <Tooltip
              maxWidth={280}
              text="Die interne KI stellt kurze Rückfragen und formt dein Feedback in eine klare, umsetzbare Fassung — die du noch anpassen kannst."
            >
              <button
                type="button"
                aria-label="Erklärung zum Verbessern"
                className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-help"
              >
                <Info size={13} />
              </button>
            </Tooltip>
          </div>
        )}
        <Button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={!canSubmit}
          loading={submitting === 'speichern'}
          variant={kiVerfuegbar ? 'secondary' : 'primary'}
          className="w-full"
        >
          Feedback speichern
        </Button>
      </div>
    </div>
  );
}

// ── Kopfzeilen-Bausteine ─────────────────────────────────────────────────────

/**
 * Bereichsauswahl als unauffälliges Dropdown oben rechts. Der Startwert ist der
 * leere String = „der automatisch erkannte Bereich"; er heißt im Menü nach der
 * Seite, auf der man steht („Seite: Home") — der frühere Text „— Auto-erkannt:
 * Home —" las sich wie ein Systemzustand statt wie eine Auswahl.
 *
 * Bewusst ein natives `<select>` (kein Radix-`Select`): dort ist der leere String
 * als Item-Wert reserviert, und `context.screenRef` bleibt genau dieser leere
 * String, solange niemand etwas auswählt.
 */
function BereichAuswahl({ seite, areaRef, setAreaRef }: { seite: string; areaRef: string; setAreaRef: (v: string) => void }): React.ReactElement {
  return (
    <div className="relative">
      <select
        value={areaRef}
        onChange={e => setAreaRef(e.target.value)}
        aria-label="Bereich"
        className="appearance-none max-w-[190px] pl-1.5 pr-5 py-0.5 text-[11.5px] bg-transparent text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-hover)] rounded-[var(--tf-radius)] outline-none cursor-pointer"
        style={{ border: 'none' }}
      >
        <option value="">Seite: {seite}</option>
        {VISIBLE_AREAS.map(a => (
          <option key={a.ref} value={a.ref}>{a.label}</option>
        ))}
      </select>
      <ChevronDown size={11} className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--tf-text-tertiary)]" />
    </div>
  );
}

/** Was automatisch mitgeht — früher eine eigene Klapp-Zeile im Formular. */
function KontextInfo({ context }: { context: FeedbackContext }): React.ReactElement {
  return (
    <Tooltip
      maxWidth={260}
      content={
        <div className="space-y-0.5">
          <div className="font-medium">Wird automatisch mitgesendet</div>
          <div>Seite: {context.page}</div>
          <div>Gerät: {context.device} · {context.viewport}</div>
          <div>Session: {Math.round(context.sessionDuration / 60)} Min.</div>
          {context.errors.length > 0 && <div>Fehler: {context.errors.length}</div>}
        </div>
      }
    >
      <button
        type="button"
        aria-label="Welcher App-Kontext mitgesendet wird"
        className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-help"
      >
        <Info size={12} />
      </button>
    </Tooltip>
  );
}

function TypeButton({ type, prominent, onClick }: { type: FeedbackTypeDef; prominent?: boolean; onClick: () => void }): React.ReactElement {
  const Icon = getIcon(type.icon);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full cursor-pointer transition-colors whitespace-nowrap ${
        prominent
          ? 'px-3 py-2 text-[12.5px] text-[var(--tf-text)] hover:bg-[var(--tf-hover)]'
          : 'px-2.5 py-1.5 text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
      }`}
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <Icon size={prominent ? 14 : 12} className="text-[var(--tf-text-secondary)] shrink-0" />
      {type.label}
    </button>
  );
}
