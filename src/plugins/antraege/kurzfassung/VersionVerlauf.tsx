/**
 * Aufklappbarer Versionsvergleich unter der aktuellen Kurzfassung: zweispaltige
 * Diff-Ansicht — links die aktuelle Fassung, rechts per Tabs die früheren
 * Fassungen, mit markierten Änderungen (Einfügungen links grün, Löschungen
 * rechts rot durchgestrichen). Pro Vorfassung: Meta, Prüf-Ergebnis und
 * „Diese Fassung übernehmen" (Rückgriff). Self-gated — rendert nichts, wenn
 * kein Verlauf vorhanden ist.
 */
import { useMemo, useState } from 'react';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Tabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { splitSentences } from '@/core/services/skills';
import { CheckList } from './CheckList';
import { versionLabel, formatDate } from './kurzfassung-verlauf';
import { computeFinalerTextDiff, diffStats, type DiffOp } from './kurzfassung-diff';
import type { BridgeZiel } from '@/core/services/ai/transports/streamlit';
import type { KurzfassungVersion } from './types';

interface Props {
  versions: KurzfassungVersion[];
  /** Finaler Text der aktuell aktiven Fassung (Diff-Basis, linke Spalte). */
  aktuellerText: string;
  /** Zeitstempel der aktuell aktiven Fassung (linke Meta-Zeile). */
  aktuellErstelltAm: string;
  /** Interne KI der aktiven Fassung — ohne sie wäre ein KI-Vergleich nicht zuordenbar. */
  aktuellZiel?: BridgeZiel;
  /** Ob die aktive Fassung auf gekürzter VB entstand (für den Vergleichs-Hinweis). */
  aktuellVbGekuerzt?: boolean;
  busy: boolean;
  onUebernehmen: (index: number) => void;
}

/** Kurz-Beschriftung der internen KI (Tab + Meta-Zeile). */
const ZIEL_KURZ: Record<BridgeZiel, string> = { standard: 'Standard-KI', agentisch: 'agentische KI' };

const DIFF_BOX ='rounded-[8px] border-[0.5px] border-[var(--tf-border)] p-3 text-[13px] leading-[1.7] text-[var(--tf-text)] whitespace-pre-wrap max-h-[360px] overflow-auto';
const META = 'mb-2 flex items-baseline gap-2 flex-wrap text-[11.5px] text-[var(--tf-text-tertiary)]';

/** Kurzdatum (Tag.Monat.) für die Tab-Beschriftung. */
function kurzDatum(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  } catch {
    return iso;
  }
}

/**
 * Eine Diff-Seite rendern. `aktuell` zeigt Gleiches + Einfügungen (op !== -1,
 * Einfügungen grün), `vorfassung` zeigt Gleiches + Löschungen (op !== 1,
 * Löschungen rot durchgestrichen).
 */
function renderSide(diffs: DiffOp[], side: 'aktuell' | 'vorfassung'): React.ReactNode {
  return diffs.map(([op, text], i) => {
    if (side === 'aktuell') {
      if (op === -1) return null; // Löschung gehört nicht in die aktuelle Fassung
      if (op === 1) return <span key={i} className="bg-[var(--tf-success-bg)] text-[var(--tf-success-text)] rounded-[2px]">{text}</span>;
      return <span key={i}>{text}</span>;
    }
    if (op === 1) return null; // Einfügung gehört nicht in die Vorfassung
    if (op === -1) return <span key={i} className="bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)] line-through rounded-[2px]">{text}</span>;
    return <span key={i}>{text}</span>;
  });
}

export function VersionVerlauf({
  versions, aktuellerText, aktuellErstelltAm, aktuellZiel, aktuellVbGekuerzt, busy, onUebernehmen,
}: Props): React.ReactElement | null {
  // Default: neueste Vorfassung gewählt. State darf nach Übernehmen/Neu-Lauf
  // veralten → beim Zugriff hart clampen.
  const [rawIdx, setRawIdx] = useState(versions.length - 1);

  const idx = Math.min(Math.max(rawIdx, 0), versions.length - 1);
  const gewaehlt = versions[idx];

  const diffs = useMemo(
    () => (gewaehlt ? computeFinalerTextDiff(gewaehlt.finalerText, aktuellerText) : []),
    [gewaehlt, aktuellerText],
  );
  const stats = useMemo(() => diffStats(diffs), [diffs]);

  if (versions.length === 0 || !gewaehlt) return null;

  // Tabs neueste-zuerst; Original-Index als id für onUebernehmen/Auswahl erhalten.
  const tabs = versions
    .map((v, i) => ({ v, i }))
    .reverse()
    .map(({ v, i }) => ({
      id: String(i),
      // Die KI gehört ins Tab-Label, nicht nur in die Meta-Zeile: zwei Fassungen
      // desselben Zyklus tragen sonst dieselbe Beschriftung und dasselbe Datum.
      label: `${versionLabel(v)}${v.ziel ? ` · ${ZIEL_KURZ[v.ziel]}` : ''} · ${kurzDatum(v.erstellt_am)}`,
    }));

  const satzAktuell = splitSentences(aktuellerText).length;
  const satzGewaehlt = splitSentences(gewaehlt.finalerText).length;
  // Zwei Fassungen aus verschiedenen KIs sind nicht ohne Weiteres vergleichbar, wenn
  // eine davon auf gekappter Vorhabensbeschreibung entstand: die Fenster der beiden
  // internen KIs unterscheiden sich um etwa das Vierfache. Dann vergleicht man
  // „gekürzt gegen vollständig" — das muss dastehen, sonst liest es sich als
  // Qualitätsurteil über das Modell.
  const kontextUnterschied = !!aktuellZiel && !!gewaehlt.ziel
    && aktuellZiel !== gewaehlt.ziel
    && !!aktuellVbGekuerzt !== !!gewaehlt.vbGekuerzt;

  return (
    <div className="mt-4">
      <CollapsibleSection label={`Vorfassungen (${versions.length})`} defaultOpen={false}>
        <div className="pb-3">
          <Tabs tabs={tabs} activeTab={String(idx)} onChange={id => setRawIdx(Number(id))} />

          <div className="mt-3 mb-3 flex items-center gap-3 text-[11.5px]">
            <span className="text-[var(--tf-success-text)]">+{stats.added}</span>
            <span className="text-[var(--tf-danger-text)]">−{stats.removed}</span>
            <span className="text-[var(--tf-text-tertiary)]">Änderungen ggü. „{versionLabel(gewaehlt)}"</span>
          </div>

          {kontextUnterschied && (
            <div className="mb-3 px-3 py-2 rounded-[8px] bg-[var(--tf-bg-secondary)] text-[11.5px] leading-[1.5] text-[var(--tf-text-secondary)]">
              Die beiden Fassungen sahen unterschiedlich viel vom Antrag: eine entstand auf gekürzter
              Vorhabensbeschreibung, die andere nicht. Der Unterschied im Text sagt daher nicht allein
              etwas über die KI aus.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Links: aktuelle Fassung (Einfügungen grün) */}
            <div>
              <div className={META}>
                <span className="text-[12px] font-medium text-[var(--tf-text-secondary)]">Aktuelle Fassung</span>
                <span>·</span>
                <span>{formatDate(aktuellErstelltAm)}</span>
                <span>·</span>
                <span>{satzAktuell} {satzAktuell === 1 ? 'Satz' : 'Sätze'}</span>
                <span>·</span>
                <span>{aktuellerText.length} Zeichen</span>
                {aktuellZiel ? <><span>·</span><span>{ZIEL_KURZ[aktuellZiel]}</span></> : null}
                {aktuellVbGekuerzt ? <><span>·</span><span>VB gekürzt</span></> : null}
              </div>
              <div className={DIFF_BOX}>{renderSide(diffs, 'aktuell')}</div>
            </div>

            {/* Rechts: gewählte Vorfassung (Löschungen rot durchgestrichen) */}
            <div>
              <div className={META}>
                {/* Das Label kürzt eine freie Anweisung auf Tab-Länge — der Volltext
                    steht im Tooltip, damit die Fassung eindeutig zuordenbar bleibt. */}
                <span
                  className="text-[12px] font-medium text-[var(--tf-text-secondary)]"
                  {...(gewaehlt.anweisung ? { title: `Anweisung: ${gewaehlt.anweisung}` } : {})}
                >
                  {versionLabel(gewaehlt)}
                </span>
                <span>·</span>
                <span>generiert am {formatDate(gewaehlt.erstellt_am)}</span>
                <span>·</span>
                <span>{satzGewaehlt} {satzGewaehlt === 1 ? 'Satz' : 'Sätze'}</span>
                <span>·</span>
                <span>{gewaehlt.finalerText.length} Zeichen</span>
                {gewaehlt.ziel ? <><span>·</span><span>{ZIEL_KURZ[gewaehlt.ziel]}</span></> : null}
                {gewaehlt.vbGekuerzt ? <><span>·</span><span>VB gekürzt</span></> : null}
              </div>
              <div className={DIFF_BOX}>{renderSide(diffs, 'vorfassung')}</div>

              {gewaehlt.checks.length > 0 && (
                <div className="mt-2.5">
                  <CheckList checks={gewaehlt.checks} />
                </div>
              )}

              <div className="mt-3">
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => onUebernehmen(idx)}>
                  Diese Fassung übernehmen
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
