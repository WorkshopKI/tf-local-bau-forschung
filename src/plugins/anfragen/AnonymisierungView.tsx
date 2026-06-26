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
import { ShieldCheck, ShieldAlert, Lock, Copy, ExternalLink, Eye, ArrowUpDown, Rows, Table, ChevronDown, Mailbox } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { getAnfragenDashboardUrl } from '@/config/feature-flags';
import { loadSkillRegistry, getSkillById, type SkillRecord } from '@/core/services/skills';
import {
  ANFRAGE_ANONYMISIEREN_SKILL,
  ANFRAGE_ANONYMISIEREN_SKILL_ID,
} from '@/core/services/skills/registry/anfrage-anonymisieren.seed';
import { resolveAnfragenDashboardUrl } from './settings';
import { runAnonymisierung, istAnonymisiererAktiv } from './services/anonymisierung';
import { pruefeExportSicher } from './services/export-guard';
import {
  buildKindedSegments, platzhalterRanges, trefferToRanges, MARK_CLASS, type KindedRange,
} from './highlight';
import { HighlightedText } from './HighlightedText';
import { AwdToggle } from './AwdToggle';
import { useSyncedPaneHeight } from './useSyncedPaneHeight';
import { useAnfragenStore } from './store';
import { statusErreicht } from './status';
import type { Anfrage } from './types';

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
  const [dashboardUrl, setDashboardUrl] = useState(getAnfragenDashboardUrl());
  const [syncScroll, setSyncScroll] = useState(false);
  const [stacked, setStacked] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);

  const { height, onResizerPointerDown } = useSyncedPaneHeight('anfragen-pane-h-anon');

  const taRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const origRef = useRef<HTMLDivElement>(null);
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

  const aktiv = istAnonymisiererAktiv(skill);
  const schonAnonymisiert = statusErreicht(anfrage.status, 'anonymisiert');
  const kannLaufen = aktiv && !!anfrage.originalMd.trim();

  const pruefung = useMemo(() => pruefeExportSicher(text, anfrage.mapping), [text, anfrage.mapping]);
  const sicher = pruefung.sicher;
  const trefferTypen = useMemo(
    () => Array.from(new Set(pruefung.treffer.map(t => t.typ))).join(', '),
    [pruefung.treffer],
  );

  const origRanges = useMemo<KindedRange[]>(
    () => trefferToRanges(pruefeExportSicher(anfrage.originalMd, anfrage.mapping).treffer, 'pii'),
    [anfrage.originalMd, anfrage.mapping],
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

  const anonymisieren = useAsyncAction(async () => {
    if (!skill) return;
    const { anonymisiertMd, mapping } = await runAnonymisierung(bridge, skill, anfrage.originalMd);
    await upsert({ ...anfrage, anonymisiertMd, mapping, status: 'anonymisiert' }, storage);
  });

  const kopieren = useAsyncAction(async () => {
    const pruef = pruefeExportSicher(text, anfrage.mapping);
    if (!pruef.sicher) throw new Error(`Export blockiert: noch ${pruef.treffer.length} mögliche PII-Treffer im Text.`);
    await navigator.clipboard.writeText(text);
    await upsert({ ...anfrage, anonymisiertMd: text, status: 'export_freigegeben' }, storage);
  });

  const onCombinedClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    const pruef = pruefeExportSicher(text, anfrage.mapping);
    if (!pruef.sicher) { e.preventDefault(); return; }
    void navigator.clipboard.writeText(text).catch(() => undefined);
    void upsert({ ...anfrage, anonymisiertMd: text, status: 'export_freigegeben' }, storage);
  };

  const persistEdit = (): void => {
    if (text !== anfrage.anonymisiertMd) void upsert({ ...anfrage, anonymisiertMd: text }, storage);
  };

  const syncBackdrop = (): void => {
    if (backdropRef.current && taRef.current) {
      backdropRef.current.scrollTop = taRef.current.scrollTop;
      backdropRef.current.scrollLeft = taRef.current.scrollLeft;
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
    syncBackdrop();
    if (syncScroll && taRef.current && origRef.current) mirror(taRef.current, origRef.current);
  };
  const onOrigScroll = (): void => {
    if (syncScroll && taRef.current && origRef.current) mirror(origRef.current, taRef.current);
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
            <HighlightedText
              text={anfrage.originalMd}
              ranges={origRanges}
              highlight={highlight}
              heightPx={height}
              paneRef={origRef}
              onScroll={onOrigScroll}
              emptyHint="— kein Text —"
            />
          </div>

          <div className="awd-colside">
            <div className="awd-sh">
              <ShieldCheck size={13} /> Anonymisiert
              {schonAnonymisiert && (sicher ? (
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

        {(anonymisieren.error || kopieren.error) && (
          <p className="px-[var(--awd-px)] pt-2 text-[11.5px] text-[var(--tf-danger-text)]">
            Fehler: {anonymisieren.error ?? kopieren.error}
          </p>
        )}
      </div>

      <div className="awd-actbar">
        {schonAnonymisiert && (
          <>
            <button
              type="button"
              onClick={() => kopieren.run()}
              disabled={!sicher || kopieren.busy}
              className="text-[12px] px-3 py-1.5 rounded-[var(--tf-radius)] border border-[var(--tf-border)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <Copy size={14} /> {kopieren.busy ? 'Kopiere…' : 'In Zwischenablage kopieren'}
            </button>
            <a
              href={dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onCombinedClick}
              aria-disabled={!sicher}
              tabIndex={sicher ? 0 : -1}
              title="Öffnet den ZIM FAQ-Assistenten in einem neuen Tab. Voraussetzung: Internetzugang + eingeloggter Account."
              className={`text-[12px] px-3 py-1.5 rounded-[var(--tf-radius)] bg-[var(--tf-text)] text-[var(--tf-bg)] flex items-center gap-1.5 transition-opacity ${
                sicher ? 'cursor-pointer hover:opacity-90' : 'opacity-40 cursor-not-allowed pointer-events-none'
              }`}
            >
              <ExternalLink size={14} /> Kopieren &amp; ZIM FAQ-Assistent öffnen
            </a>
          </>
        )}
        {!schonAnonymisiert && skill && !aktiv && (
          <span className="awd-note"><Lock size={12} /> Skill nicht freigeschaltet (Recall-Gate ausstehend).</span>
        )}
        {!sicher && schonAnonymisiert && (
          <span className="awd-note"><ShieldAlert size={12} /> {pruefung.treffer.length} Treffer ({trefferTypen}) — Export blockiert.</span>
        )}
        <span className="awd-sp" />
        <button
          type="button"
          onClick={() => anonymisieren.run()}
          disabled={!kannLaufen || anonymisieren.busy}
          className="text-[12px] px-3 py-1.5 rounded-[var(--tf-radius)] bg-[var(--tf-text)] text-[var(--tf-bg)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-opacity hover:opacity-90"
        >
          <ShieldCheck size={14} /> {anonymisieren.busy ? 'Anonymisiere…' : schonAnonymisiert ? 'Erneut anonymisieren' : 'Anonymisieren'}
        </button>
      </div>
    </div>
  );
}
