/**
 * Review-Body EINES Abschnitts im Werkstatt-Layout (Design-Handoff
 * `workflow-mit-bearbeiten`). Kopf (Titel/Status/„bearbeitet"-Badge/Modell) +
 * Karten-Rahmen sitzen im Container (`ActiveAbschnitt` in `GutachtenSection`),
 * Quelle/Prüfung/Denkprozess im rechten `KontextPanel`. Diese Karte zeigt den
 * finalen Text (mit **Inline-Bearbeitung**), die Meta-Zeile, den Versions-Verlauf
 * und die zweizeilige Aktionsleiste.
 *
 * Inline-Bearbeitung als Plain-Text (passt zu Markdown-Render + DOCX-Füller +
 * deterministischen Checks); `onBearbeiten` persistiert + rechnet die Checks neu.
 *
 * Styles in `gutachten.css` (gescopt unter `.gutachten-werkstatt`).
 */
import { useEffect, useRef, useState } from 'react';
import { Pencil, SlidersHorizontal, ThumbsUp, ThumbsDown, ArrowRight, Undo2, Check, Info } from 'lucide-react';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { splitSentences, VB_KUERZEN_HINWEIS, type SkillModifierKey } from '@/core/services/skills';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import type { ThinkingBudget } from '@/core/services/ai/llm-thinking';
import { VersionVerlauf } from '../kurzfassung/VersionVerlauf';
import { ThinkingControl } from '../kurzfassung/ThinkingControl';
import { StreamingVorschau } from '../kurzfassung/StreamingVorschau';
import { formatDate } from '../kurzfassung/kurzfassung-verlauf';
import type { StepRun } from './types';

interface Props {
  run: StepRun;
  busy: boolean;
  llmAvailable: boolean | null;
  onModify: (modifier: SkillModifierKey) => void;
  /** Manuelle Inline-Bearbeitung übernehmen (Plain-Text; Hook persistiert + prüft neu). */
  onBearbeiten: (text: string) => Promise<void>;
  onPruefen: () => void;
  onFreigeben: () => void;
  onVerwerfen: () => void;
  onStop: () => void;
  onUebernehmen: (index: number) => void;
  onErneutOeffnen: () => void;
  onOpenTweak: () => void;
  /** Beratende KI-QS über diesen Abschnitt fahren — fehlt, wenn kein QS-Schritt ihn adressiert. */
  onQs?: () => void;
  /** Provenienz: Name des erzeugenden Skills + Anzahl zugeordneter Regeln. */
  provenance?: { skillName: string; regelCount: number };
  /** Öffnet den erzeugenden Skill in der Skill-Verwaltung (Provenienz-Link). */
  onOpenSkill?: () => void;
  /** Ein-Klick-Feedback zum Entwurf (→ S1). Fehlt → Feedback-Zeile entfällt. */
  onFeedback?: (rating: 'up' | 'down', notiz?: string) => void;
  /** Thinking-/Reasoning-Budget für die nächste Generierung (Default aus der Einstellung, hier übersteuerbar). */
  thinkingBudget: ThinkingBudget;
  onSetThinkingBudget: (budget: ThinkingBudget) => void;
  /** Live-Streaming-Vorschau während `busy`. */
  streamContent: string;
  streamThinking: string;
}

export function SectionReviewCard({
  run, busy, llmAvailable, onModify, onBearbeiten, onPruefen, onFreigeben, onVerwerfen, onStop, onUebernehmen, onErneutOeffnen, onOpenTweak, onQs, provenance, onOpenSkill, onFeedback, thinkingBudget, onSetThinkingBudget, streamContent, streamThinking,
}: Props): React.ReactElement {
  const freigegeben = run.status === 'freigegeben';
  const satzanzahl = splitSentences(run.finalerText).length;
  const genDisabled = busy || llmAvailable === false;

  // Inline-Bearbeitung (Plain-Text). `draft` lokal; Übernehmen persistiert via Hook.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const save = useAsyncAction(
    async (text: string) => { await onBearbeiten(text); },
    { onSuccess: () => setEditing(false) },
  );
  const startEdit = (): void => { setDraft(run.finalerText); setEditing(true); };
  const cancelEdit = (): void => { setEditing(false); save.clearError(); };
  useEffect(() => { if (editing) taRef.current?.focus(); }, [editing]);
  const onEditKey = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void save.run(draft); }
  };

  // Ein-Klick-Feedback: ein Votum je Abschnittsversion (Reset bei neuer Generierung).
  const [fbDone, setFbDone] = useState(false);
  const [fbNote, setFbNote] = useState('');
  // 👎 öffnet erst das Notizfeld (Slide-in, V4); gesendet wird bei Enter/Blur/2. Klick.
  const [downActive, setDownActive] = useState(false);
  useEffect(() => { setFbDone(false); setFbNote(''); setDownActive(false); }, [run.erstellt_am, run.skillVersion]);
  const submitFeedback = (rating: 'up' | 'down'): void => {
    if (fbDone) return; // ein Votum je Version — Doppel-Trigger (Blur + Klick) abfangen
    onFeedback?.(rating, fbNote.trim() || undefined);
    setFbDone(true);
  };
  const onDownClick = (): void => {
    if (!downActive) { setDownActive(true); return; } // erst Notizfeld zeigen, dann bestätigen
    submitFeedback('down');
  };

  return (
    <>
      {run.warnung && (
        <div className="mb-3 text-[12px] text-[var(--tf-warning-text)] bg-[var(--tf-warning-bg)] rounded-[8px] px-3 py-2">
          {run.warnung}
        </div>
      )}
      {run.vbGekuerzt && (
        <div className="mb-3 text-[12px] text-[var(--tf-warning-text)] bg-[var(--tf-warning-bg)] rounded-[8px] px-3 py-2">
          ⚠ Die Vorhabensbeschreibung war zu lang fürs LLM-Kontextfenster und wurde für die Analyse gekürzt — der Schluss floss nicht in diesen Abschnitt ein. {VB_KUERZEN_HINWEIS}
        </div>
      )}

      {/* Entwurf / Inline-Editor */}
      {editing ? (
        <div className="g-edit">
          <div className="g-edit-bar">
            <Pencil className="g-ebi" />
            <span>Entwurf bearbeiten</span>
            <span className="g-ab-spacer" />
            <button type="button" className="g-btn ghost sm" onClick={cancelEdit}>Abbrechen</button>
            <button type="button" className="g-btn primary sm" disabled={save.busy} onClick={() => save.run(draft)}>
              {save.busy ? 'Übernehmen…' : 'Übernehmen'}
            </button>
          </div>
          <textarea
            ref={taRef}
            className="g-editable"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onEditKey}
            aria-label="Entwurfstext bearbeiten"
          />
          <div className="mt-1.5 text-[11px] text-[var(--tf-text-tertiary)]">⌘/Strg + Enter übernimmt · Esc bricht ab</div>
          {save.error && (
            <div className="mt-2 text-[12px] text-[var(--tf-danger-text)] bg-[var(--tf-danger-bg)] rounded-[8px] px-3 py-2">{save.error}</div>
          )}
        </div>
      ) : (
        // Der finale Text ist bewusst Markdown (Skill-Format z.B. „**Kurztitel:** …",
        // seed.ts) — wie die Quellenanalyse über den MarkdownRenderer darstellen.
        <div className="g-body">
          <MarkdownRenderer content={run.finalerText} />
        </div>
      )}

      {/* Meta-Zeile — schlank: Satzzahl/Status + Regel-Anzahl; Provenienz (Skill) hinter dem Info-Icon. */}
      <div className="g-metaline">
        <span>
          {satzanzahl} {satzanzahl === 1 ? 'Satz' : 'Sätze'} · {freigegeben ? `freigegeben am ${formatDate(run.freigegeben_am ?? run.erstellt_am)}` : 'Entwurf'}
          {run.mitTweak ? ' · mit persönlichem Stil' : ''}
          {provenance ? ` · prüft ${provenance.regelCount} ${provenance.regelCount === 1 ? 'Regel' : 'Regeln'}` : ''}
        </span>
        {provenance && (() => {
          const prov = `erzeugt mit ${provenance.skillName}${run.skillVersion != null ? ` v${run.skillVersion}` : ''}`;
          return onOpenSkill ? (
            <button type="button" className="g-meta-info" onClick={onOpenSkill} title={prov} aria-label={`${prov} — Skill öffnen`}>
              <Info size={13} />
            </button>
          ) : (
            <span className="g-meta-info" title={prov} aria-label={prov}><Info size={13} /></span>
          );
        })()}
      </div>

      {/* Anpassen direkt am Text (dezent): Neu/Kürzer/Länger · Thinking · Prüfen · KI-QS.
          Nur im bearbeitbaren Zustand (Entwurf, nicht generierend). */}
      {!busy && !freigegeben && (
        <>
          <div className="g-refine-row">
            <span className="g-ab-anpassen">
              <span className="g-ab-anpassen-lbl">Anpassen</span>
              <button type="button" className="g-btn ghost sm" disabled={genDisabled} onClick={() => onModify('neu')}>Neu</button>
              <button type="button" className="g-btn ghost sm" disabled={genDisabled} onClick={() => onModify('kuerzer')}>Kürzer</button>
              <button type="button" className="g-btn ghost sm" disabled={genDisabled} onClick={() => onModify('laenger')}>Länger</button>
            </span>
            <ThinkingControl budget={thinkingBudget} onChange={onSetThinkingBudget} disabled={busy} />
            <button type="button" className="g-btn ghost sm" onClick={onPruefen}>Prüfen</button>
            {onQs && (
              <button type="button" className="g-btn ghost sm" disabled={genDisabled} onClick={onQs}>KI-QS prüfen</button>
            )}
          </div>
          {llmAvailable === false && (
            <div className="mb-1 text-[11.5px] text-[var(--tf-warning-text)]">
              KI nicht erreichbar — Neu/Kürzer/Länger derzeit nicht möglich.
            </div>
          )}
        </>
      )}

      <VersionVerlauf
        versions={run.verlauf ?? []}
        aktuellerText={run.finalerText}
        aktuellErstelltAm={run.erstellt_am}
        busy={busy}
        onUebernehmen={onUebernehmen}
      />

      {/* Aktionsleiste */}
      {busy ? (
        <div className="g-actionbar">
          <StreamingVorschau thinking={streamThinking} content={streamContent} onStop={onStop} />
        </div>
      ) : freigegeben ? (
        <div className="g-actionbar">
          <div className="g-ab-row compact">
            <span className="g-freigabe-tag"><Check className="g-vi" /> Freigegeben</span>
            <button type="button" className="g-btn sm" onClick={onErneutOeffnen}><Undo2 size={14} /> Erneut öffnen</button>
            {onQs && (
              <button type="button" className="g-btn sm" disabled={genDisabled} onClick={onQs}>KI-QS prüfen</button>
            )}
            <span className="g-ab-spacer" />
            <button type="button" className="g-vbtn" title="Einstellungen Persönlicher Stil" aria-label="Persönlicher Stil" onClick={onOpenTweak}><SlidersHorizontal className="g-vi" /></button>
          </div>
        </div>
      ) : (
        <div className="g-actionbar">
          {/* Eine kompakte Entscheidungs-Zeile: Bearbeiten · 👍/👎 (+Notiz) · Stil · Verwerfen · CTA.
              Die Anpassen/Prüfen-Tools sitzen dezent oben direkt am Text (g-refine-row). */}
          <div className="g-ab-row compact">
            <button type="button" className="g-vbtn" title="Bearbeiten" aria-label="Bearbeiten" onClick={startEdit}><Pencil className="g-vi" /></button>
            {onFeedback && (
              fbDone ? (
                <span className="g-fb-done">Danke — Rückmeldung gespeichert.</span>
              ) : (
                <>
                  <button type="button" className="g-vbtn" title="Entwurf gut" aria-label="Entwurf gut" onClick={() => submitFeedback('up')}><ThumbsUp className="g-vi" /></button>
                  <button type="button" className={`g-vbtn${downActive ? ' down' : ''}`} title="Entwurf nicht gut" aria-label="Entwurf nicht gut" onClick={onDownClick}><ThumbsDown className="g-vi" /></button>
                  {downActive && (
                    <input
                      className="g-noteinput g-noteinput-ctx"
                      value={fbNote}
                      onChange={e => setFbNote(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitFeedback('down'); } }}
                      onBlur={() => submitFeedback('down')}
                      placeholder="Was stört dich am Entwurf? (kein Antragsbezug)"
                      maxLength={140}
                      autoFocus
                    />
                  )}
                </>
              )
            )}
            <button type="button" className="g-vbtn" title="Einstellungen Persönlicher Stil" aria-label="Persönlicher Stil" onClick={onOpenTweak}><SlidersHorizontal className="g-vi" /></button>
            <span className="g-ab-spacer" />
            <button type="button" className="g-btn ghost sm" onClick={onVerwerfen}>Verwerfen</button>
            <button type="button" className="g-btn primary" onClick={onFreigeben}>Freigeben &amp; weiter <ArrowRight size={14} /></button>
          </div>
        </div>
      )}
    </>
  );
}
