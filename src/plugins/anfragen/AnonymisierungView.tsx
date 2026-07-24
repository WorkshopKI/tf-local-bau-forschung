/**
 * View 1 „Anonymisierung" (Layout A) — Original-Mailtext ↔ anonymisierter Text
 * nebeneinander. Absorbiert die frühere `AnfrageAnonymisierung` (Skill-Load +
 * Lauf) und den `ReviewEditor` (editierbares Anon-Pane mit Live-Export-Guard).
 *
 * Der anonymisierte Text bleibt EDITIERBAR mit Live-`pruefeExportSicher` (einzige
 * technische PII-Grenze): das Badge „Keine PII"/„… PII-Treffer" und die Export-
 * Buttons werden vom Guard getrieben.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ShieldCheck, ShieldAlert, Lock, Copy, ExternalLink, Eye, ArrowUpDown, Rows, Table, ChevronDown, Mailbox, AlertTriangle } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { kiVerbindungGeprueft } from '@/core/services/ai/ki-guard';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { Button } from '@/components/ui/button';
import { getAnfragenDashboardUrl } from '@/config/feature-flags';
import { loadSkillRegistry, getSkillById, type SkillRecord } from '@/core/services/skills';
import {
  ANFRAGE_ANONYMISIEREN_SKILL,
  ANFRAGE_ANONYMISIEREN_SKILL_ID,
} from '@/core/services/skills/registry/anfrage-anonymisieren.seed';
import { resolveAnfragenDashboardUrl } from './settings';
import { runAnonymisierung, istAnonymisiererFreigeschaltet } from './services/anonymisierung';
import { anredeFuerExport } from './services/anrede';
import { pruefeExportSicher } from './services/export-guard';
import { hashText, istOriginalStale } from './original-hash';
import {
  buildKindedSegments, platzhalterRanges, trefferToRanges, MARK_CLASS, type KindedRange,
} from './highlight';
import { HighlightedText } from './HighlightedText';
import { AwdToggle } from './AwdToggle';
import { useSyncedPaneHeight } from './useSyncedPaneHeight';
import { useAnfragenStore } from './store';
import { statusErreicht } from './status';
import type { Anfrage } from './types';
import { kopiereText } from '@/core/utils/kopieren';

interface Props {
  anfrage: Anfrage;
  highlight: boolean;
  onToggleHighlight: () => void;
}

function ResizerGrip(): React.ReactElement {
  return (
    <svg viewBox="0 0 26 9" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path d="M4 3h18M4 6h18" />
    </svg>
  );
}

export function AnonymisierungView({ anfrage, highlight, onToggleHighlight }: Props): React.ReactElement {
  const storage = useStorage();
  const bridge = useAIBridge();
  const upsert = useAnfragenStore(s => s.upsert);

  const [skill, setSkill] = useState<SkillRecord | null>(null);
  const [text, setText] = useState(anfrage.anonymisiertMd);
  const [origText, setOrigText] = useState(anfrage.originalMd);
  const [dashboardUrl, setDashboardUrl] = useState(getAnfragenDashboardUrl());
  const [syncScroll, setSyncScroll] = useState(false);
  const [stacked, setStacked] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [verallgOpen, setVerallgOpen] = useState(false);

  const { height, onResizerPointerDown } = useSyncedPaneHeight('anfragen-pane-h-anon');

  const taRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const origTaRef = useRef<HTMLTextAreaElement>(null);
  const origBackdropRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await loadSkillRegistry(storage);
      if (cancelled) return;
      setSkill(getSkillById(loaded.file, ANFRAGE_ANONYMISIEREN_SKILL_ID) ?? ANFRAGE_ANONYMISIEREN_SKILL);
    })();
    return () => { cancelled = true; };
  }, [storage]);

  useEffect(() => {
    let cancelled = false;
    void resolveAnfragenDashboardUrl(storage.idb).then(u => { if (!cancelled) setDashboardUrl(u); });
    return () => { cancelled = true; };
  }, [storage]);

  // Reset bei Anfrage-Wechsel / erneuter Anonymisierung.
  useEffect(() => { setText(anfrage.anonymisiertMd); }, [anfrage.id, anfrage.anonymisiertMd]);
  useEffect(() => { setOrigText(anfrage.originalMd); }, [anfrage.id, anfrage.originalMd]);

  const aktiv = istAnonymisiererFreigeschaltet(skill);
  const schonAnonymisiert = statusErreicht(anfrage.status, 'anonymisiert');
  const kannLaufen = aktiv && !!origText.trim();
  // Original nach dem Anonymisieren editiert → anonyme Fassung/Mapping veraltet.
  const stale = istOriginalStale(anfrage, origText);

  const pruefung = useMemo(() => pruefeExportSicher(text, anfrage.mapping), [text, anfrage.mapping]);
  const sicher = pruefung.sicher;
  // Export erst frei, wenn PII-Guard sauber UND der Originaltext nicht seit dem
  // Anonymisieren geändert wurde (sonst passt die anonyme Fassung nicht mehr).
  const exportFrei = sicher && !stale;
  const trefferTypen = useMemo(
    () => Array.from(new Set(pruefung.treffer.map(t => t.typ))).join(', '),
    [pruefung.treffer],
  );

  const origRanges = useMemo<KindedRange[]>(
    () => trefferToRanges(pruefeExportSicher(origText, anfrage.mapping).treffer, 'pii'),
    [origText, anfrage.mapping],
  );
  const origSegs = useMemo(
    () => (highlight ? buildKindedSegments(origText, origRanges) : [{ text: origText, kind: null }]),
    [origText, origRanges, highlight],
  );
  const anonRanges = useMemo<KindedRange[]>(
    () => [...platzhalterRanges(text), ...trefferToRanges(pruefung.treffer, 'leak')],
    [text, pruefung.treffer],
  );
  const anonSegs = useMemo(
    () => (highlight ? buildKindedSegments(text, anonRanges) : [{ text, kind: null }]),
    [text, anonRanges, highlight],
  );

  const mappingRows = useMemo(() => {
    const seen = new Set<string>();
    return anfrage.mapping.map(m => {
      const dup = seen.has(m.platzhalter);
      seen.add(m.platzhalter);
      return { ...m, dup };
    });
  }, [anfrage.mapping]);

  // Distinkte Platzhalter (in Mapping-Reihenfolge) — die externe Runde muss sie
  // unverändert zurückliefern, sonst keine Wiedereinsetzung. Platzhalter sind opak
  // (kein PII) → gefahrlos kopierbar.
  const exportPlatzhalter = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of anfrage.mapping) {
      if (!seen.has(m.platzhalter)) { seen.add(m.platzhalter); out.push(m.platzhalter); }
    }
    return out;
  }, [anfrage.mapping]);

  const platzhalterKopieren = useAsyncAction(async () => {
    await kopiereText(exportPlatzhalter.join(' '));
  });

  const anonymisieren = useAsyncAction(async () => {
    if (!skill) return;
    // Interne KI nicht verbunden? Verbinden-Dialog statt Auto-Tab (s. AnfrageAufnahme).
    if (!(await kiVerbindungGeprueft(bridge))) return;
    // Editierten Originaltext als Basis nehmen (evtl. noch nicht geblurrt) und in
    // EINEM upsert persistieren: Originaltext + Basis-Hash + anonyme Fassung.
    const basis = origText;
    const { anonymisiertMd, mapping, verallgemeinerungen } = await runAnonymisierung(bridge, skill, basis);
    await upsert(
      { ...anfrage, originalMd: basis, anonBasisHash: hashText(basis), anonymisiertMd, mapping, verallgemeinerungen, status: 'anonymisiert' },
      storage,
    );
  });

  const kopieren = useAsyncAction(async () => {
    if (istOriginalStale(anfrage, origText)) throw new Error('Originaltext geändert — bitte erneut anonymisieren, bevor exportiert wird.');
    const pruef = pruefeExportSicher(text, anfrage.mapping);
    if (!pruef.sicher) throw new Error(`Export blockiert: noch ${pruef.treffer.length} mögliche PII-Treffer im Text.`);
    // Präambel voranstellen (Anrede-Hinweis + Platzhalter-Erhalt); gespeichert wird
    // weiterhin der reine anonyme Text.
    await kopiereText(anredeFuerExport(text));
    await upsert({ ...anfrage, anonymisiertMd: text, status: 'export_freigegeben' }, storage);
  });

  /**
   * „Kopieren & Assistent öffnen" — erst kopieren, dann öffnen (v2.301.3).
   *
   * Vorher hing das Öffnen an einem `<a target="_blank">`: die Navigation startete im
   * selben Tick wie der Kopier-Aufruf, und verlor das Dokument dabei den Fokus, lehnte
   * Chrome `writeText` ab. Der Fehler war zusätzlich per `.catch(() => undefined)`
   * verschluckt — im Assistenten landete dann der ALTE Inhalt der Zwischenablage, also
   * womöglich eine fremde Anfrage. Bei einer de-anonymisierungs-geprüften Mail ist das
   * der teuerste denkbare Fehlerfall, deshalb hier derselbe Ablauf wie im Recherche-Tab.
   */
  const kopierenUndOeffnen = useAsyncAction(async () => {
    if (istOriginalStale(anfrage, origText)) throw new Error('Originaltext geändert — bitte erneut anonymisieren, bevor exportiert wird.');
    const pruef = pruefeExportSicher(text, anfrage.mapping);
    if (!pruef.sicher) throw new Error(`Export blockiert: noch ${pruef.treffer.length} mögliche PII-Treffer im Text.`);
    await kopiereText(anredeFuerExport(text));
    await upsert({ ...anfrage, anonymisiertMd: text, status: 'export_freigegeben' }, storage);
    window.open(dashboardUrl, '_blank', 'noopener,noreferrer');
  });

  const persistEdit = (): void => {
    if (text !== anfrage.anonymisiertMd) void upsert({ ...anfrage, anonymisiertMd: text }, storage);
  };

  // Bearbeiteten Original-Mailtext beim Verlassen des Feldes persistieren.
  const persistOrigEdit = (): void => {
    if (origText !== anfrage.originalMd) void upsert({ ...anfrage, originalMd: origText }, storage);
  };

  const syncBackdrop = (ta: HTMLTextAreaElement | null, bd: HTMLDivElement | null): void => {
    if (bd && ta) {
      bd.scrollTop = ta.scrollTop;
      bd.scrollLeft = ta.scrollLeft;
    }
  };
  const mirror = (src: HTMLElement, dst: HTMLElement): void => {
    if (lockRef.current) return;
    lockRef.current = true;
    const denom = src.scrollHeight - src.clientHeight || 1;
    dst.scrollTop = (src.scrollTop / denom) * (dst.scrollHeight - dst.clientHeight);
    requestAnimationFrame(() => { lockRef.current = false; });
  };
  const onTaScroll = (): void => {
    syncBackdrop(taRef.current, backdropRef.current);
    if (syncScroll && taRef.current && origTaRef.current) mirror(taRef.current, origTaRef.current);
  };
  const onOrigScroll = (): void => {
    syncBackdrop(origTaRef.current, origBackdropRef.current);
    if (syncScroll && taRef.current && origTaRef.current) mirror(origTaRef.current, taRef.current);
  };

  return (
    <div className="awd-view">
      <div className="awd-view-scroll">
        <div className="awd-pairhead">
          <span className="awd-label">Anonymisierung</span>
          <span className="awd-pairhead-sub">Original ↔ anonymisierter Text</span>
          <div className="awd-controls">
            <AwdToggle on={highlight} onClick={onToggleHighlight} Icon={Eye} label="Hervorheben" />
            <AwdToggle on={syncScroll} onClick={() => setSyncScroll(v => !v)} Icon={ArrowUpDown} label="Synchron scrollen" />
            <AwdToggle on={stacked} onClick={() => setStacked(v => !v)} Icon={Rows} label="Untereinander" />
          </div>
        </div>

        <div className={`awd-pair${stacked ? ' stacked' : ''}`}>
          <div className="awd-colside">
            <div className="awd-sh">
              <Mailbox size={13} /> Original-Mailtext
            </div>
            <div
              className="awd-edit-wrap"
              style={{ height }}
              title="Original-Mailtext bearbeiten — z. B. Anrede/Signatur oder Text entfernen, der die KI irritiert. Änderungen werden lokal gespeichert."
            >
              <div ref={origBackdropRef} aria-hidden className="awd-edit-layer awd-edit-backdrop">
                {origSegs.map((s, i) =>
                  s.kind
                    ? <mark key={i} className={MARK_CLASS[s.kind]}>{s.text}</mark>
                    : <span key={i}>{s.text}</span>,
                )}
                {'\n'}
              </div>
              <textarea
                ref={origTaRef}
                value={origText}
                onChange={e => setOrigText(e.target.value)}
                onScroll={onOrigScroll}
                onBlur={persistOrigEdit}
                spellCheck={false}
                placeholder="Original-Mailtext … (Anrede/Signatur oder irritierenden Text vor dem Anonymisieren entfernen)"
                className="awd-edit-layer awd-edit-ta"
              />
            </div>
          </div>

          <div className="awd-colside">
            <div className="awd-sh">
              <ShieldCheck size={13} /> Anonymisiert
              {schonAnonymisiert && (stale ? (
                <span className="awd-badge warn"><span className="awd-bdot" /> Originaltext geändert · erneut anonymisieren</span>
              ) : sicher ? (
                <span className="awd-badge ok"><span className="awd-bdot" /> Keine PII · Export möglich</span>
              ) : (
                <span className="awd-badge warn"><span className="awd-bdot" /> {pruefung.treffer.length} mögliche PII-Treffer</span>
              ))}
            </div>
            {schonAnonymisiert ? (
              <div className="awd-edit-wrap" style={{ height }}>
                <div ref={backdropRef} aria-hidden className="awd-edit-layer awd-edit-backdrop">
                  {anonSegs.map((s, i) =>
                    s.kind
                      ? <mark key={i} className={MARK_CLASS[s.kind]}>{s.text}</mark>
                      : <span key={i}>{s.text}</span>,
                  )}
                  {'\n'}
                </div>
                <textarea
                  ref={taRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onScroll={onTaScroll}
                  onBlur={persistEdit}
                  spellCheck={false}
                  className="awd-edit-layer awd-edit-ta"
                />
              </div>
            ) : (
              <HighlightedText
                text=""
                ranges={[]}
                highlight={highlight}
                heightPx={height}
                mono
                emptyHint="Noch nicht anonymisiert — rechts erscheint die anonyme Version nach dem Anonymisieren."
              />
            )}
          </div>
        </div>

        <div className="awd-resizer" onPointerDown={onResizerPointerDown} title="Höhe ziehen (beide Spalten)">
          <ResizerGrip />
        </div>

        {schonAnonymisiert && (
          <div className={`awd-drawer${mappingOpen ? ' open' : ''}`}>
            <button type="button" className="awd-drawer-h" onClick={() => setMappingOpen(v => !v)} aria-expanded={mappingOpen}>
              <Table className="awd-dico" size={14} />
              Mapping ({anfrage.mapping.length} {anfrage.mapping.length === 1 ? 'Ersetzung' : 'Ersetzungen'})
              <span className="awd-lock"><Lock size={11} />verlässt das System nicht — nur lokal gespeichert</span>
              <span className="awd-ct">
                {mappingOpen ? 'einklappen' : 'aufklappen'}
                <ChevronDown className="awd-chev" size={14} />
              </span>
            </button>
            <div className="awd-drawer-body">
              <table className="awd-map">
                <thead><tr><th>Platzhalter</th><th>Original</th><th>Typ</th></tr></thead>
                <tbody>
                  {mappingRows.map((m, i) => (
                    <tr key={`${m.platzhalter}-${i}`}>
                      <td>
                        <span className="awd-pl">{m.platzhalter}</span>
                        {m.dup && <span className="awd-dup">Alias</span>}
                      </td>
                      <td>{m.original}</td>
                      <td className="awd-ty">{m.typ}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {schonAnonymisiert && anfrage.verallgemeinerungen.length > 0 && (
          <div className={`awd-drawer${verallgOpen ? ' open' : ''}`}>
            <button type="button" className="awd-drawer-h" onClick={() => setVerallgOpen(v => !v)} aria-expanded={verallgOpen}>
              <Table className="awd-dico" size={14} />
              Verallgemeinerungen ({anfrage.verallgemeinerungen.length})
              <span className="awd-lock"><Lock size={11} />Original verlässt das System nicht — exportiert wird die verallgemeinerte Fassung</span>
              <span className="awd-ct">
                {verallgOpen ? 'einklappen' : 'aufklappen'}
                <ChevronDown className="awd-chev" size={14} />
              </span>
            </button>
            <div className="awd-drawer-body">
              <table className="awd-map">
                <thead><tr><th>Original (sensibel)</th><th>Verallgemeinert (exportiert)</th></tr></thead>
                <tbody>
                  {anfrage.verallgemeinerungen.map((v, i) => (
                    <tr key={i}>
                      <td>{v.original}</td>
                      <td>{v.verallgemeinert}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {schonAnonymisiert && exportPlatzhalter.length > 0 && (
          <div className="awd-phhint">
            <span className="awd-phhint-label">Diese Platzhalter müssen in der Antwort erhalten bleiben:</span>
            <code className="awd-phhint-list">{exportPlatzhalter.join(' · ')}</code>
            <button type="button" className="awd-phhint-copy" onClick={() => platzhalterKopieren.run()} title="Distinkte Platzhalter kopieren">
              <Copy size={11} /> {platzhalterKopieren.busy ? 'kopiert…' : 'kopieren'}
            </button>
          </div>
        )}

        {(anonymisieren.error || kopieren.error || kopierenUndOeffnen.error) && (
          <p className="px-[var(--awd-px)] pt-2 text-[11.5px] text-[var(--tf-danger-text)]">
            Fehler: {anonymisieren.error ?? kopieren.error ?? kopierenUndOeffnen.error}
          </p>
        )}
      </div>

      <div className="awd-actbar">
        {schonAnonymisiert && (
          <>
            <Button variant="secondary" icon={Copy} loading={kopieren.busy} disabled={!exportFrei} onClick={() => kopieren.run()}>
              In Zwischenablage kopieren
            </Button>
            <Button
              variant="primary"
              icon={ExternalLink}
              loading={kopierenUndOeffnen.busy}
              disabled={!exportFrei}
              onClick={() => kopierenUndOeffnen.run()}
              title="Kopiert den Text und öffnet den ZIM FAQ-Assistenten in einem neuen Tab. Voraussetzung: Internetzugang + eingeloggter Account."
            >
              Kopieren &amp; ZIM FAQ-Assistent öffnen
            </Button>
          </>
        )}
        {!schonAnonymisiert && skill && !aktiv && (
          <span className="awd-note"><Lock size={12} /> Skill nicht freigeschaltet (Recall-Gate ausstehend).</span>
        )}
        {stale && (
          <span className="awd-note"><AlertTriangle size={12} /> Originaltext geändert — bitte erneut anonymisieren (Export gesperrt).</span>
        )}
        {!sicher && schonAnonymisiert && !stale && (
          <span className="awd-note"><ShieldAlert size={12} /> {pruefung.treffer.length} Treffer ({trefferTypen}) — Export blockiert.</span>
        )}
        <span className="awd-sp" />
        <Button
          variant={schonAnonymisiert && !stale ? 'secondary' : 'primary'}
          icon={ShieldCheck}
          loading={anonymisieren.busy}
          disabled={!kannLaufen}
          onClick={() => anonymisieren.run()}
        >
          {schonAnonymisiert ? 'Erneut anonymisieren' : 'Anonymisieren'}
        </Button>
      </div>
    </div>
  );
}
