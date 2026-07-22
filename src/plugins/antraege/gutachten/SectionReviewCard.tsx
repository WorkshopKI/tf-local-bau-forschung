/**
 * Review-Body EINES Abschnitts im Werkstatt-Layout (Design-Handoff
 * `workflow-mit-bearbeiten`). Kopf (Titel/Status/„bearbeitet"-Badge/Modell) +
 * Karten-Rahmen sitzen im Container (`ActiveAbschnitt` in `GutachtenSection`),
 * Quelle/KI-Hinweise/Denkprozess im rechten `KontextPanel`. Diese Karte zeigt den
 * finalen Text (mit **Inline-Bearbeitung**), die Meta-Zeile, die aufklappbare
 * Regelprüfung (`PruefBlock` — sie gehört an den Text, den sie bewertet), den
 * Versions-Verlauf und die zweizeilige Aktionsleiste.
 *
 * Inline-Bearbeitung als Plain-Text (passt zu Markdown-Render + DOCX-Füller +
 * deterministischen Checks); `onBearbeiten` persistiert + rechnet die Checks neu.
 *
 * Styles in `gutachten.css` (gescopt unter `.gutachten-werkstatt`).
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { Pencil, SlidersHorizontal, ThumbsUp, ThumbsDown, ArrowRight, Undo2, Check, Copy, Info, ChevronRight, SpellCheck } from 'lucide-react';
import { keymap, type EditorView } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { sanitizeHtml } from '@/components/ui/MarkdownRenderer';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';
import { markdownLivePreview } from '@/components/ui/markdownLivePreview';
import { splitSentences, countWords, VB_KUERZEN_HINWEIS, type SkillModifierKey } from '@/core/services/skills';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { VersionVerlauf } from '../kurzfassung/VersionVerlauf';
import { StreamingVorschau } from '../kurzfassung/StreamingVorschau';
import { formatDate } from '../kurzfassung/kurzfassung-verlauf';
import { satzSegmente } from './satzSegmente';
import { belegAbdeckung } from './belege';
import { pruefeLektorat, befundText } from './lektorat';
import { pruefSummary } from './pruefSummary';
import { PruefBlock } from './PruefBlock';
import type { CheckListAktion } from '../kurzfassung/CheckList';
import type { StepRun } from './types';
import { kopiereText } from '@/core/utils/kopieren';

/**
 * Satzweise adressierbarer Text (Journey-Paket 3): jeder Satz als `data-satz-index`-
 * Span (aligned zur Check-Engine via `satzSegmente`/`splitSentences`), damit der
 * „Anzeigen"-Sprung exakt highlighten kann. Inline-Markdown je Satz über
 * `marked.parseInline` (bold etc. bleiben erhalten); `whitespace-pre-wrap` am
 * Container erhält Absätze aus den Original-Trennzeichen. `startIndex` versetzt die
 * globalen Indizes in der Teile-Darstellung (laufender Offset je Teil).
 */
function SatzText({
  text, startIndex = 0, hoverSaetze, onHoverSaetze,
}: {
  text: string;
  startIndex?: number;
  /** Beleg↔Satz-Hover (Journey-Paket 4): highlightet Sätze, die zum gehoverten Beleg gehören. */
  hoverSaetze?: number[] | null;
  onHoverSaetze?: (saetze: number[] | null) => void;
}): React.ReactElement {
  const segs = useMemo(() => satzSegmente(text), [text]);
  return (
    <>
      {segs.map((seg, i) => {
        const idx = startIndex + i;
        const hl = hoverSaetze != null && hoverSaetze.includes(idx);
        return (
          <Fragment key={idx}>
            <span
              data-satz-index={idx}
              className={`g-satz${hl ? ' g-satz-hover' : ''}`}
              {...(onHoverSaetze ? {
                onMouseEnter: () => onHoverSaetze([idx]),
                onMouseLeave: () => onHoverSaetze(null),
              } : {})}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(marked.parseInline(seg.satz, { async: false }) as string) }}
            />
            {seg.sep}
          </Fragment>
        );
      })}
    </>
  );
}

interface Props {
  run: StepRun;
  busy: boolean;
  llmAvailable: boolean | null;
  onModify: (modifier: SkillModifierKey) => void;
  /** Manuelle Inline-Bearbeitung übernehmen (Plain-Text; Hook persistiert + prüft neu). */
  onBearbeiten: (text: string) => Promise<void>;
  /** Regeln neu rechnen — sitzt im aufgeklappten Prüf-Block, nicht in der Anpassen-Zeile. */
  onPruefen: () => void;
  /**
   * Prüf-Block-Aktionen (Journey-Paket 3, opt-in): regel-gebundene KI-Korrektur je
   * Fehler-Check + Fundstellen-Sprung. Fehlt → Prüfung nur als Anzeige.
   */
  pruefAktion?: CheckListAktion;
  onFreigeben: () => void;
  onVerwerfen: () => void;
  onStop: () => void;
  onUebernehmen: (index: number) => void;
  onErneutOeffnen: () => void;
  onOpenTweak: () => void;
  /** Beratende KI-QS über diesen Abschnitt fahren — fehlt, wenn kein QS-Schritt ihn adressiert. */
  onQs?: () => void;
  /**
   * Sprachlichen Feinschliff (Lektor-Skill) über den Abschnitt fahren. Fehlt,
   * wenn der Kurator den Lektor-Skill deaktiviert hat → Knopf entfällt.
   */
  onLektorat?: () => void;
  /** Provenienz: Name des erzeugenden Skills + Anzahl zugeordneter Regeln. */
  provenance?: { skillName: string; regelCount: number };
  /** Öffnet den erzeugenden Skill in der Skill-Verwaltung (Provenienz-Link). */
  onOpenSkill?: () => void;
  /** Ein-Klick-Feedback zum Entwurf (→ S1). Fehlt → Feedback-Zeile entfällt. */
  onFeedback?: (rating: 'up' | 'down', notiz?: string) => void;
  /** Live-Streaming-Vorschau während `busy`. */
  streamContent: string;
  streamThinking: string;
  /**
   * „Anzeigen"-Sprung (Journey-Paket 3): 0-basierter Satz-Index + monotone `nonce`
   * (löst das Re-Highlight auch bei gleichem Index aus). Nur im gerenderten
   * (nicht-Edit-)Zustand wirksam; sonst graceful no-op.
   */
  fundstelle?: { satzIndex: number; nonce: number };
  /**
   * Beleg↔Satz-Hover (Journey-Paket 4, Phase 6): gehoverte Satz-Nummern (aus Beleg-
   * Karten ODER Satz-Spans) + Setter. Highlightet die betroffenen Sätze im Entwurf.
   */
  hoverSaetze?: number[] | null;
  onHoverSaetze?: (saetze: number[] | null) => void;
}

export function SectionReviewCard({
  run, busy, llmAvailable, onModify, onBearbeiten, onPruefen, pruefAktion, onFreigeben, onVerwerfen, onStop, onUebernehmen, onErneutOeffnen, onOpenTweak, onQs, onLektorat, provenance, onOpenSkill, onFeedback, streamContent, streamThinking, fundstelle, hoverSaetze, onHoverSaetze,
}: Props): React.ReactElement {
  const freigegeben = run.status === 'freigegeben';
  const satzanzahl = splitSentences(run.finalerText).length;
  // Umfang wird in Wörtern beurteilt — gleiche Quelle (`finalerText`, auch bei
  // strukturierten `teile`) und gleiche Zählung wie die `wortanzahl`-Regel im
  // Prüf-Block darunter, damit sich Meta-Zeile und Prüfung nie widersprechen.
  const wortanzahl = countWords(run.finalerText);
  const genDisabled = busy || llmAvailable === false;

  // Wächter über dem sprachlichen Feinschliff: LIVE gegen die letzte Verlaufs-
  // Fassung gerechnet (das ist der Stand vor dem Lektor-Lauf) — nichts
  // Zusätzliches persistiert, und ein späterer manueller Edit fließt mit ein.
  const lektoratBefund = useMemo(() => {
    if (!run.lektoriert) return '';
    const vorher = run.verlauf?.[run.verlauf.length - 1]?.finalerText;
    return vorher ? befundText(pruefeLektorat(vorher, run.finalerText)) : '';
  }, [run.lektoriert, run.verlauf, run.finalerText]);

  // Regelprüfung direkt am Text (aufklappbar über die Meta-Zeile): grün → zu, sonst auf.
  // Die Karte remountet nur beim Abschnittswechsel (`key` in `ActiveAbschnitt`), darum
  // den Default bei JEDER Änderung des Prüf-Ergebnisses neu ableiten — sonst bliebe der
  // Block nach einer Neu-Generierung mit frischem Befund zugeklappt.
  const { fehler, hinweis } = pruefSummary(run.checks);
  const hatBefund = fehler + hinweis > 0;
  const befundSig = run.checks.map(c => c.level).join('');
  const [pruefOpen, setPruefOpen] = useState(hatBefund);
  useEffect(() => { setPruefOpen(hatBefund); }, [befundSig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inline-Bearbeitung (Live-Preview-Markdown). `draft` lokal; Übernehmen persistiert via Hook.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const viewRef = useRef<EditorView | null>(null);
  // „Anzeigen"-Sprung: den adressierten Satz suchen, in die Sicht scrollen und
  // temporär highlighten (~2s, Fade via CSS-Transition). Auf `nonce` getriggert,
  // damit wiederholte Klicks auf dieselbe Stelle erneut auslösen. Findet der
  // Selector nichts (Edit-Modus / nicht-adressierbar) → graceful no-op.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!fundstelle) return undefined;
    const el = bodyRef.current?.querySelector<HTMLElement>(`[data-satz-index="${fundstelle.satzIndex}"]`);
    if (!el) return undefined;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('g-satz-hl');
    const t = window.setTimeout(() => el.classList.remove('g-satz-hl'), 1700);
    return () => { window.clearTimeout(t); el.classList.remove('g-satz-hl'); };
  }, [fundstelle?.nonce, fundstelle?.satzIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  // Laufender globaler Satz-Offset je Teil (Teile-Darstellung), damit `data-satz-index`
  // zur kanonischen `splitSentences(finalerText)`-Nummerierung der Engine passt.
  const teilStartIndex = useMemo(() => {
    const offs: number[] = [];
    let acc = 0;
    for (const teil of run.teile ?? []) { offs.push(acc); acc += splitSentences(teil.text).length; }
    return offs;
  }, [run.teile]);
  const save = useAsyncAction(
    async (text: string) => { await onBearbeiten(text); },
    { onSuccess: () => setEditing(false) },
  );
  const startEdit = (): void => { setDraft(run.finalerText); setEditing(true); };
  const cancelEdit = (): void => { setEditing(false); save.clearError(); };

  // Save liest den LIVE-Doc-Wert: MarkdownEditor.onChange ist 300ms debounced, der letzte
  // Anschlag ginge sonst verloren. Keymap einmal bauen, Handler via Ref aktuell halten
  // (kein Stale-Closure) — Mod-Enter übernimmt, Esc bricht ab.
  const handlersRef = useRef<{ save: (text: string) => void; cancel: () => void }>({ save: () => {}, cancel: () => {} });
  handlersRef.current.save = (text: string): void => { void save.run(text); };
  handlersRef.current.cancel = cancelEdit;
  const editExtensions = useMemo(() => {
    const km = Prec.highest(keymap.of([
      { key: 'Mod-Enter', run: (v: EditorView) => { handlersRef.current.save(v.state.doc.toString()); return true; } },
      { key: 'Escape', run: () => { handlersRef.current.cancel(); return true; } },
    ]));
    return [markdownLivePreview(), km];
  }, []);

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

  // Entwurf in die Zwischenablage — kopiert den kanonischen `finalerText` (ohne Teil-Badge).
  // Rein lokale Aktion (kein Netz/Transport); kurzes Häkchen-Feedback wie beim Chat-CopyButton.
  // Sitzt bewusst in der Meta-Zeile direkt unter dem Text (nicht in der Aktionsleiste):
  // Kopieren ist der häufigste Weg, den Abschnitt weiterzuverwenden, und gehört an den Text.
  const [copied, setCopied] = useState(false);
  const copy = useAsyncAction(async () => {
    await kopiereText(run.finalerText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  });
  const copyBtn = (
    <button
      type="button"
      className={`g-meta-copy${copied ? ' ok' : ''}`}
      title={copy.error ? `Kopieren fehlgeschlagen: ${copy.error}` : 'Text in Zwischenablage kopieren'}
      aria-label="Text in Zwischenablage kopieren"
      onClick={() => copy.run()}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Kopiert' : 'Text kopieren'}
    </button>
  );

  return (
    <>
      {run.warnung && (
        <div className="mb-3 text-[12px] text-[var(--tf-warning-text)] bg-[var(--tf-warning-bg)] rounded-[8px] px-3 py-2">
          {run.warnung}
        </div>
      )}
      {run.chatResetStatus && (
        <div className="mb-3 text-[12px] text-[var(--tf-warning-text)] bg-[var(--tf-warning-bg)] rounded-[8px] px-3 py-2">
          ⚠ Chat-Reset fehlgeschlagen — dieser Abschnitt kann durch alten Chat-Verlauf der internen KI
          beeinflusst sein. In AitisiGPT einen neuen Chat starten und den Abschnitt neu generieren.
        </div>
      )}
      {run.vbGekuerzt && (
        <div
          className="mb-2 text-[11px] text-[var(--tf-text-tertiary)]"
          title={`Diese Fassung entstand auf einer gekürzten Vorhabensbeschreibung — der Schluss floss nicht ein. ${VB_KUERZEN_HINWEIS}`}
        >
          ⚠ auf gekürzter VB-Basis
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
            <button type="button" className="g-btn primary sm" disabled={save.busy} onClick={() => save.run(viewRef.current?.state.doc.toString() ?? draft)}>
              {save.busy ? 'Übernehmen…' : 'Übernehmen'}
            </button>
          </div>
          {/* Kein autoFocus: der Editor geht als saubere, gerenderte Vorschau auf; erst beim Klick
              in eine Zeile (Fokus) werden dort die Marker zum Editieren eingeblendet. */}
          <MarkdownEditor
            value={draft}
            onChange={setDraft}
            frame="none"
            className="g-edit-cm"
            minHeight="160px"
            extensions={editExtensions}
            onCreateEditor={v => { viewRef.current = v; }}
          />
          <div className="mt-1.5 text-[11px] text-[var(--tf-text-tertiary)]">⌘/Strg + Enter übernimmt · Esc bricht ab</div>
          {save.error && (
            <div className="mt-2 text-[12px] text-[var(--tf-danger-text)] bg-[var(--tf-danger-bg)] rounded-[8px] px-3 py-2">{save.error}</div>
          )}
        </div>
      ) : run.teile?.length ? (
        // Strukturierte Teile (opt-in): jeder Teil als Block mit kleinem Inline-Badge
        // (Label aus der Skill-Deklaration). RENDER-ONLY — `run.finalerText` (Quelle
        // für Bearbeiten/Transfer/DOCX) trägt das Badge NIE. Satzweise adressierbar
        // (SatzText) für den „Anzeigen"-Sprung; laufender globaler Offset je Teil.
        <div className="g-body" ref={bodyRef}>
          {run.teile.map((teil, i) => (
            <div key={`${teil.key}-${i}`} className="g-teil">
              <span className="g-teil-badge">{teil.label}</span>
              <div className="whitespace-pre-wrap"><SatzText text={teil.text} startIndex={teilStartIndex[i] ?? 0} hoverSaetze={hoverSaetze} onHoverSaetze={onHoverSaetze} /></div>
            </div>
          ))}
        </div>
      ) : (
        // Der finale Text ist bewusst Markdown (Skill-Format z.B. „**Kurztitel:** …",
        // seed.ts) — satzweise adressierbar (SatzText, Inline-Markdown je Satz),
        // damit „Anzeigen" exakt highlighten kann.
        <div className="g-body whitespace-pre-wrap" ref={bodyRef}>
          <SatzText text={run.finalerText} hoverSaetze={hoverSaetze} onHoverSaetze={onHoverSaetze} />
        </div>
      )}

      {/* Abdeckungs-Zähler (Journey-Paket 4): Sätze mit ≥1 (live-gültigem) Beleg.
          Rechnet gegen den LIVE-Text — nach manueller Bearbeitung degradierte Belege
          fallen automatisch raus. Nur im gerenderten Zustand + bei vorhandenen Belegen. */}
      {!editing && (run.belege?.length ?? 0) > 0 && (() => {
        const { abgedeckt, gesamt } = belegAbdeckung(run.belege!, satzanzahl);
        return (
          <div className="g-beleg-coverage">
            {abgedeckt} von {gesamt} {gesamt === 1 ? 'Satz' : 'Sätzen'} mit Beleg verknüpft
          </div>
        );
      })()}

      {/* Wächter-Hinweis nach dem Feinschliff: rein beratend. Er meldet nur, was
          deterministisch messbar ist (Zahlen-Inventar + Umfang) — die Beurteilung
          bleibt beim Gutachter, der Vergleich steht im Versionsverlauf unten. */}
      {!editing && lektoratBefund && (
        <div className="g-lektor-hinweis">
          ⚠ Gegenüber dem Stand vor dem Feinschliff: {lektoratBefund} — bitte im Versionsvergleich unten prüfen.
        </div>
      )}

      {/* Meta-Zeile — schlank: Satzzahl/Status + Prüf-Aufklapper; Provenienz (Skill) hinter dem Info-Icon. */}
      <div className="g-metaline">
        <span>
          {satzanzahl} {satzanzahl === 1 ? 'Satz' : 'Sätze'} · {wortanzahl.toLocaleString('de-DE')} {wortanzahl === 1 ? 'Wort' : 'Wörter'} · {freigegeben ? `freigegeben am ${formatDate(run.freigegeben_am ?? run.erstellt_am)}` : 'Entwurf'}
          {run.mitTweak ? ' · mit persönlichem Stil' : ''}
          {run.lektoriert ? ' · sprachlich überarbeitet' : ''}
        </span>
        {/* Zahl aus `run.checks` (Stand der Prüfung), NICHT aus den live aktiven Skill-Regeln —
            das Label muss beschreiben, was der Aufklapper zeigt. */}
        {run.checks.length > 0 && (
          <button
            type="button"
            className={`g-pruef-toggle${fehler > 0 ? ' fehler' : hinweis > 0 ? ' hinweis' : ''}`}
            aria-expanded={pruefOpen}
            onClick={() => setPruefOpen(o => !o)}
            title={pruefOpen ? 'Prüfung einklappen' : 'Prüfung anzeigen'}
          >
            · prüft {run.checks.length} {run.checks.length === 1 ? 'Regel' : 'Regeln'}
            {fehler > 0 && ` · ${fehler} ${fehler === 1 ? 'Fehler' : 'Fehler'}`}
            {hinweis > 0 && ` · ${hinweis} ${hinweis === 1 ? 'Hinweis' : 'Hinweise'}`}
            <ChevronRight
              size={12}
              className="shrink-0 transition-transform duration-200"
              style={{ transform: pruefOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
            />
          </button>
        )}
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
        {copyBtn}
      </div>

      {/* Regelprüfung am Text — Auf/Zu über den Meta-Zeilen-Trigger (Grid-Animation wie AmpelGruppe). */}
      {run.checks.length > 0 && (
        <div className="g-pruefblock" style={{ gridTemplateRows: pruefOpen ? '1fr' : '0fr' }}>
          <div className="overflow-hidden">
            <PruefBlock
              checks={run.checks}
              aktion={pruefAktion}
              {...(!busy && !freigegeben ? { onPruefen } : {})}
            />
          </div>
        </div>
      )}

      {/* Anpassen direkt am Text (dezent): Neu/Kürzer/Länger · KI-QS.
          Nur im bearbeitbaren Zustand (Entwurf, nicht generierend). */}
      {!busy && !freigegeben && (
        <>
          <div className="g-refine-row">
            <span className="g-ab-anpassen">
              <span className="g-ab-anpassen-lbl">Anpassen:</span>
              <button type="button" className="g-btn ghost sm" disabled={genDisabled} onClick={() => onModify('neu')}>Neu</button>
              <button type="button" className="g-btn ghost sm" disabled={genDisabled} onClick={() => onModify('kuerzer')}>Kürzer</button>
              <button type="button" className="g-btn ghost sm" disabled={genDisabled} onClick={() => onModify('laenger')}>Länger</button>
            </span>
            {/* Abgesetzt, weil anderer Charakter: Neu/Kürzer/Länger generieren aus der
                Vorhabensbeschreibung NEU, der Feinschliff fasst nur die Sprache an. */}
            {onLektorat && (
              <>
                <span className="g-refine-sep" aria-hidden="true" />
                <button
                  type="button"
                  className="g-btn ghost sm"
                  disabled={genDisabled || !run.finalerText.trim()}
                  onClick={onLektorat}
                  title="Überarbeitet den Abschnitt nur sprachlich — Inhalt und Umfang bleiben unverändert. Die bisherige Fassung bleibt im Versionsverlauf."
                >
                  <SpellCheck size={13} /> Sprachlicher Feinschliff
                </button>
              </>
            )}
            {onQs && (
              <button type="button" className="g-btn ghost sm" disabled={genDisabled} onClick={onQs}>KI-QS prüfen</button>
            )}
          </div>
          {llmAvailable === false && (
            <div className="mb-1 flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-tertiary)]">
              <Pencil size={12} />
              Offline: manuell bearbeiten und prüfen weiter möglich.
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
