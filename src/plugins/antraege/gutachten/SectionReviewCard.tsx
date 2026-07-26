/**
 * Die Abschnitts-Karte im Werkstatt-Layout — seit v2.337 in VIER Ebenen:
 *
 *   Kopf (`AbschnittKopf`) · Text · Werkzeugzeile (`WerkzeugZeile`) · Fußzeile
 *   (`AbschnittFuss`)
 *
 * plus zwei optionale Bänder direkt am Text: der konsolidierte Hinweis-Streifen
 * darüber und das Bewertungs-Band darunter (Abschnitts-QS + deterministische
 * Regelprüfung). Vorher waren es sieben Ebenen mit drei getrennten Werkzeug-Orten
 * und bis zu fünf einzelnen Bannern.
 *
 * Diese Datei komponiert nur noch; jede Entscheidung, WAS angezeigt wird, liegt
 * in der reinen `abschnittAnzeige.ts` (das Repo hat keine Render-Tests, also muss
 * die Logik testbar daneben liegen).
 *
 * Inline-Bearbeitung bleibt Markdown-Live-Preview (`markdownLivePreview`), die
 * Feedback-Notiz bleibt ein `<input>` — beides erzwingt der Convention-Test
 * `gutachten-entwurf-kein-plain-textarea`.
 *
 * Styles in `gutachten.css` (gescopt unter `.gutachten-werkstatt`).
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { Copy, History, Pencil, SlidersHorizontal, SpellCheck, Trash2 } from 'lucide-react';
import { keymap, type EditorView } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { sanitizeHtml } from '@/components/ui/MarkdownRenderer';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';
import { markdownLivePreview } from '@/components/ui/markdownLivePreview';
import { splitSentences, countWords, type SkillModifierKey } from '@/core/services/skills';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useKopierAktion } from '@/core/hooks/useKopierAktion';
import { VersionVerlauf } from '../kurzfassung/VersionVerlauf';
import { StreamingVorschau } from '../kurzfassung/StreamingVorschau';
import type { LaufPhase } from '../kurzfassung/useStreamingBuffer';
import { satzSegmente } from './satzSegmente';
import { belegAbdeckung } from './belege';
import { pruefSummary } from './pruefSummary';
import { PruefBlock } from './PruefBlock';
import { AbschnittKopf, type MenuAktion } from './AbschnittKopf';
import { HinweisStreifen } from './HinweisStreifen';
import { QsStrip } from './QsStrip';
import { WerkzeugZeile } from './WerkzeugZeile';
import { AbschnittFuss } from './AbschnittFuss';
import { abschnittHinweise, pipelineStatus, qsBadge } from './abschnittAnzeige';
import type { CheckListAktion } from '../kurzfassung/CheckList';
import type { StepRun } from './types';

/**
 * Satzweise adressierbarer Text: jeder Satz als `data-satz-index`-Span (aligned
 * zur Check-Engine via `satzSegmente`/`splitSentences`), damit Fundstellen-Sprünge
 * exakt highlighten. Inline-Markdown je Satz über `marked.parseInline`;
 * `whitespace-pre-wrap` am Container erhält die Absätze. `startIndex` versetzt die
 * globalen Indizes in der Teile-Darstellung.
 */
function SatzText({
  text, startIndex = 0, hoverSaetze, onHoverSaetze,
}: {
  text: string;
  startIndex?: number;
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

/** Alles, was die Kopfzeile über den Abschnitt wissen muss (aus dem Container). */
export interface KopfInfo {
  /** „A — Kurzfassung". */
  titel: string;
  skillVersion?: number;
  tweakAktiv?: boolean;
  externerProvider?: string;
  onOpenWerkstatt?: () => void;
  onZuruecksetzen?: () => void;
  zuruecksetzenBusy?: boolean;
}

interface Props {
  run: StepRun;
  kopf: KopfInfo;
  busy: boolean;
  llmAvailable: boolean | null;
  /** Neutraler Vermerk nach erschöpftem Auto-Retry — läuft in den Hinweis-Streifen. */
  retryNote?: string | null;
  onModify: (modifier: SkillModifierKey) => void;
  /** Manuelle Inline-Bearbeitung übernehmen (Plain-Text; Hook persistiert + prüft neu). */
  onBearbeiten: (text: string) => Promise<void>;
  /** Regeln neu rechnen — sitzt in der Fußzeile des Prüf-Blocks. */
  onPruefen: () => void;
  /** Prüf-Block-Aktionen (opt-in): regel-gebundene KI-Korrektur + Fundstellen-Sprung. */
  pruefAktion?: CheckListAktion;
  onFreigeben: () => void;
  onVerwerfen: () => void;
  onStop: () => void;
  onUebernehmen: (index: number) => void;
  onErneutOeffnen: () => void;
  onOpenTweak: () => void;
  /** Beratende KI-QS fahren — fehlt, wenn kein QS-Schritt diesen Abschnitt adressiert. */
  onQs?: () => void;
  /** Sprachlicher Feinschliff (manuell) — fehlt, wenn der Lektor-Skill deaktiviert ist. */
  onLektorat?: () => void;
  provenance?: { skillName: string };
  onOpenSkill?: () => void;
  onFeedback?: (rating: 'up' | 'down', notiz?: string) => void;
  streamContent: string;
  streamThinking: string;
  streamPhase?: LaufPhase;
  /** Fundstellen-Sprung von AUSSEN (Prüf-Block/Beleg-Karten): Satz-Index + monotone `nonce`. */
  fundstelle?: { satzIndex: number; nonce: number };
  /** Beleg↔Satz-Hover: gehoverte Satz-Nummern + Setter. */
  hoverSaetze?: number[] | null;
  onHoverSaetze?: (saetze: number[] | null) => void;
}

export function SectionReviewCard({
  run, kopf, busy, llmAvailable, retryNote, onModify, onBearbeiten, onPruefen, pruefAktion,
  onFreigeben, onVerwerfen, onStop, onUebernehmen, onErneutOeffnen, onOpenTweak, onQs, onLektorat,
  provenance, onOpenSkill, onFeedback, streamContent, streamThinking, streamPhase,
  fundstelle, hoverSaetze, onHoverSaetze,
}: Props): React.ReactElement {
  const freigegeben = run.status === 'freigegeben';
  const satzanzahl = splitSentences(run.finalerText).length;
  // Umfang wird in Wörtern beurteilt — gleiche Quelle und Zählung wie die
  // `wortanzahl`-Regel, damit sich Fußzeile und Prüfung nie widersprechen.
  const wortanzahl = countWords(run.finalerText);
  const genDisabled = busy || llmAvailable === false;
  const { fehler, hinweis } = pruefSummary(run.checks);
  const regelnOk = run.checks.length - fehler - hinweis;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [verlaufOffen, setVerlaufOffen] = useState(false);
  const viewRef = useRef<EditorView | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Fundstellen-Sprung: den adressierten Satz suchen, in die Sicht scrollen und
  // ~2 s highlighten. ZWEI Quellen teilen sich denselben Mechanismus — die
  // `fundstelle`-Prop (Prüf-Block, Beleg-Karten) und der QS-Strip in dieser Karte.
  // Bewusst kein zweiter Highlight-Pfad: eine Implementierung, zwei Auslöser.
  const [lokaleFundstelle, setLokaleFundstelle] = useState<{ satzIndex: number; nonce: number } | null>(null);
  const lokalNonce = useRef(0);
  const zeigeSatz = (satzIndex: number): void => {
    lokalNonce.current += 1;
    setLokaleFundstelle({ satzIndex, nonce: lokalNonce.current });
  };
  useEffect(() => markiereSatz(bodyRef.current, fundstelle?.satzIndex), [fundstelle?.nonce, fundstelle?.satzIndex]);
  useEffect(
    () => markiereSatz(bodyRef.current, lokaleFundstelle?.satzIndex),
    [lokaleFundstelle?.nonce, lokaleFundstelle?.satzIndex],
  );

  // Laufender globaler Satz-Offset je Teil, damit `data-satz-index` zur kanonischen
  // `splitSentences(finalerText)`-Nummerierung der Engine passt.
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

  // Save liest den LIVE-Doc-Wert: MarkdownEditor.onChange ist 300 ms debounced, der
  // letzte Anschlag ginge sonst verloren. Keymap einmal bauen, Handler via Ref
  // aktuell halten (kein Stale-Closure) — Mod-Enter übernimmt, Esc bricht ab.
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

  const copy = useKopierAktion(() => run.finalerText, 'Text in Zwischenablage kopieren');
  const hinweise = useMemo(() => abschnittHinweise(run, retryNote), [run, retryNote]);
  const qs = qsBadge(run);

  // ⋯-Menü: alles Seltenere. Im freigegebenen Zustand ohne die Entwurfs-Aktionen.
  const menu: MenuAktion[] = [
    {
      key: 'kopieren',
      label: copy.fehler ? 'Kopieren fehlgeschlagen' : copy.kopiert ? 'Kopiert' : 'Text kopieren',
      icon: <Copy size={14} />,
      onClick: () => { void copy.run(); },
      offenLassen: true,
    },
    ...(!freigegeben && onLektorat ? [{
      key: 'lektorat',
      label: 'Sprachlicher Feinschliff',
      icon: <SpellCheck size={14} />,
      disabled: genDisabled || !run.finalerText.trim(),
      onClick: onLektorat,
    }] : []),
    { key: 'stil', label: 'Persönlicher Stil', icon: <SlidersHorizontal size={14} />, onClick: onOpenTweak },
    {
      key: 'verlauf',
      label: verlaufOffen ? 'Vorfassungen ausblenden' : `Vorfassungen (${run.verlauf?.length ?? 0})`,
      icon: <History size={14} />,
      disabled: (run.verlauf?.length ?? 0) === 0,
      onClick: () => setVerlaufOffen(o => !o),
    },
    ...(!freigegeben ? [{
      key: 'verwerfen',
      label: 'Abschnitt verwerfen',
      icon: <Trash2 size={14} />,
      trenner: true,
      onClick: onVerwerfen,
    }] : []),
  ];

  return (
    <>
      {/* 1 — Kopf */}
      <AbschnittKopf
        titel={kopf.titel}
        status={run.status}
        {...(kopf.skillVersion != null ? { skillVersion: kopf.skillVersion } : {})}
        pipeline={pipelineStatus(run)}
        {...(run.zielFallback ? { zielFallback: true } : {})}
        {...(run.originalText != null ? { bearbeitet: true } : {})}
        {...(kopf.onZuruecksetzen ? { onZuruecksetzen: kopf.onZuruecksetzen } : {})}
        {...(kopf.zuruecksetzenBusy ? { zuruecksetzenBusy: true } : {})}
        {...(kopf.tweakAktiv ? { tweakAktiv: true } : {})}
        {...(kopf.externerProvider ? { externerProvider: kopf.externerProvider } : {})}
        {...(kopf.onOpenWerkstatt ? { onOpenWerkstatt: kopf.onOpenWerkstatt } : {})}
        menu={menu}
      />

      <HinweisStreifen hinweise={hinweise} />

      {/* 2 — Text (bzw. Inline-Editor) */}
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
          {/* Kein autoFocus: der Editor geht als gerenderte Vorschau auf; erst beim Klick
              in eine Zeile werden dort die Marker zum Editieren eingeblendet. */}
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
        // Strukturierte Teile (opt-in): jeder Teil als Block mit Inline-Badge.
        // RENDER-ONLY — `run.finalerText` trägt das Badge NIE.
        <div className="g-body" ref={bodyRef}>
          {run.teile.map((teil, i) => (
            <div key={`${teil.key}-${i}`} className="g-teil">
              <span className="g-teil-badge">{teil.label}</span>
              <div className="whitespace-pre-wrap"><SatzText text={teil.text} startIndex={teilStartIndex[i] ?? 0} hoverSaetze={hoverSaetze} onHoverSaetze={onHoverSaetze} /></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="g-body whitespace-pre-wrap" ref={bodyRef}>
          <SatzText text={run.finalerText} hoverSaetze={hoverSaetze} onHoverSaetze={onHoverSaetze} />
        </div>
      )}

      {/* Abdeckungs-Zähler: Sätze mit ≥1 (live-gültigem) Beleg. Rechnet gegen den
          LIVE-Text — nach manueller Bearbeitung degradierte Belege fallen raus. */}
      {!editing && (run.belege?.length ?? 0) > 0 && (() => {
        const { abgedeckt, gesamt } = belegAbdeckung(run.belege!, satzanzahl);
        return (
          <div className="g-beleg-coverage">
            {abgedeckt} von {gesamt} {gesamt === 1 ? 'Satz' : 'Sätzen'} mit Beleg verknüpft
          </div>
        );
      })()}

      {/* Bewertungs-Band am Text: beratende Abschnitts-QS + deterministische
          Regelprüfung. Beide klappen selbst auf/zu (AmpelGruppe) — grün zu, sonst auf. */}
      {!editing && (
        <div className="g-bewertung">
          <QsStrip
            befunde={run.qsHinweise ?? []}
            {...(run.qsAbnahme ? { abnahme: run.qsAbnahme } : {})}
            satzAnzahl={satzanzahl}
            onZeigeSatz={zeigeSatz}
          />
          <PruefBlock
            checks={run.checks}
            {...(pruefAktion ? { aktion: pruefAktion } : {})}
            {...(!busy && !freigegeben ? { onPruefen } : {})}
          />
        </div>
      )}

      {verlaufOffen && (
        <VersionVerlauf
          versions={run.verlauf ?? []}
          aktuellerText={run.finalerText}
          aktuellErstelltAm={run.erstellt_am}
          busy={busy}
          onUebernehmen={onUebernehmen}
        />
      )}

      {/* 3 — Werkzeugzeile (während eines Laufs: die Streaming-Vorschau) */}
      {busy ? (
        <div className="g-actionbar">
          <StreamingVorschau thinking={streamThinking} content={streamContent} phase={streamPhase} onStop={onStop} />
        </div>
      ) : !editing && (
        <>
          <WerkzeugZeile
            freigegeben={freigegeben}
            genDisabled={genDisabled}
            textVorhanden={!!run.finalerText.trim()}
            qs={qs}
            onModify={onModify}
            onBearbeiten={startEdit}
            {...(onQs ? { onQs } : {})}
            onFreigeben={onFreigeben}
            onErneutOeffnen={onErneutOeffnen}
          />
          {llmAvailable === false && (
            <div className="g-offline-hinweis">
              <Pencil size={12} />
              Offline: manuell bearbeiten und prüfen weiter möglich.
            </div>
          )}
        </>
      )}

      {/* 4 — Fußzeile */}
      {!editing && (
        <AbschnittFuss
          run={run}
          satzanzahl={satzanzahl}
          wortanzahl={wortanzahl}
          regelnOk={regelnOk}
          regelnGesamt={run.checks.length}
          {...(provenance ? { provenance } : {})}
          {...(onOpenSkill ? { onOpenSkill } : {})}
          {...(onFeedback && !freigegeben ? { onFeedback } : {})}
        />
      )}
    </>
  );
}

/**
 * Markiert einen Satz im gerenderten Entwurf: in die Sicht scrollen + ~1,7 s
 * hervorheben (Fade via CSS-Transition). Findet der Selektor nichts (Edit-Modus,
 * veralteter Index) → graceful no-op. Gemeinsame Implementierung beider
 * Sprung-Auslöser.
 */
function markiereSatz(container: HTMLElement | null, satzIndex: number | undefined): (() => void) | undefined {
  if (satzIndex == null) return undefined;
  const el = container?.querySelector<HTMLElement>(`[data-satz-index="${satzIndex}"]`);
  if (!el) return undefined;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('g-satz-hl');
  const t = window.setTimeout(() => el.classList.remove('g-satz-hl'), 1700);
  return () => { window.clearTimeout(t); el.classList.remove('g-satz-hl'); };
}
