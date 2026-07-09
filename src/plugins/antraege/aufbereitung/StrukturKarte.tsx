/**
 * Struktur-Map (Karte) der Abdeckung (Paket 2). Horizontaler Baum der
 * VB-Gliederung: Wurzel links (Projekt-Kurzname), Ebene-1-Kapitel vertikal,
 * Ebene-2 nur bei den ZWEI kinderreichsten Kapiteln ausgeklappt (deterministische
 * Regel — kein Hardcode auf konkrete Kapitel), sonst als „+n"-Zähler. Aspekt-Kürzel
 * als Badge, „ohne Aspekt"/„dünn" als tertiärer Text/Dot. Monochrom (nur der
 * dünn-Dot trägt Farbe).
 *
 * Umsetzung: HTML-Knoten (für Hover + dasselbe Fundstellen-Popover wie die Liste,
 * KEIN Sprung) über einer absolut positionierten SVG-Verbindungs-Ebene — die reine
 * Baum-Geometrie ist SVG (Muster `GanttZeitplan`), die Knoten HTML, weil das
 * Popover ein HTML-Element ist. Layout deterministisch aus der Gliederung.
 */
import { useMemo } from 'react';
import type { VbSektion } from './gliederung';
import { sektionZuAspekte, type AspektMapping, type AspektSubstanz } from './aspekte';
import { FundstellePopover } from './FundstelleChip';

export interface StrukturKarteProps {
  gliederung: VbSektion[];
  mapping: AspektMapping;
  substanz: AspektSubstanz[];
  vbMarkdown: string | null;
  /** Projekt-Kurzname (Wurzel-Knoten). */
  wurzel: string;
}

const WARN_DOT = '#f59e0b'; // amber — einzige Farbe (DESIGN_GUIDE: Dots dürfen Farbe tragen)
const NODE_H = 26;
const ROOT_W = 120;
const L1_W = 250;
const L2_W = 52;
const GAP_X = 52;   // Wurzel → Ebene 1
const GAP_X2 = 36;  // Ebene 1 → Ebene 2
const L1_X = ROOT_W + GAP_X;
const L2_X = L1_X + L1_W + GAP_X2;
const TOTAL_W = L2_X + L2_W + 8;

interface L1Row {
  s: VbSektion;
  kinder: VbSektion[];
  expanded: boolean;
  y: number;                 // top-y des Knotens
  kinderRows: Array<{ k: VbSektion; y: number }>;
  aspekte: string[];
  duenn: boolean;
}

export function StrukturKarte({ gliederung, mapping, substanz, vbMarkdown, wurzel }: StrukturKarteProps): React.ReactElement {
  const layout = useMemo(() => baueLayout(gliederung, mapping, substanz), [gliederung, mapping, substanz]);
  const { rows, totalH, rowH } = layout;

  if (rows.length === 0) {
    return <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">Keine Gliederung erkannt.</div>;
  }

  const rootY = totalH / 2;
  const mid = (y: number): number => y + NODE_H / 2;
  const curve = (x1: number, y1: number, x2: number, y2: number): string => {
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };

  return (
    <div className="mt-4 overflow-x-auto pb-2">
      <div className="relative" style={{ width: TOTAL_W, height: totalH }}>
        {/* Verbindungen (SVG-Ebene, nicht interaktiv) */}
        <svg width={TOTAL_W} height={totalH} className="pointer-events-none absolute inset-0" aria-hidden="true">
          {rows.map(r => (
            <path key={`c-${r.s.id}`} d={curve(ROOT_W, rootY + NODE_H / 2, L1_X, mid(r.y))}
              fill="none" stroke="var(--tf-border)" strokeWidth={0.5} />
          ))}
          {rows.flatMap(r => r.kinderRows.map(kr => (
            <path key={`ck-${kr.k.id}`} d={curve(L1_X + L1_W, mid(r.y), L2_X, mid(kr.y))}
              fill="none" stroke="var(--tf-border)" strokeWidth={0.5} />
          )))}
        </svg>

        {/* Wurzel-Knoten */}
        <div className="absolute flex items-center justify-center rounded-md px-2 text-[13px] font-medium text-[var(--tf-text)]"
          style={{ left: 0, top: rootY, width: ROOT_W, height: NODE_H, border: '0.5px solid var(--tf-border)', borderRadius: 6 }}>
          <span className="truncate">{wurzel}</span>
        </div>

        {/* Ebene-1-Knoten */}
        {rows.map(r => (
          <KnotenL1 key={r.s.id} row={r} vbMarkdown={vbMarkdown} />
        ))}

        {/* Ebene-2-Knoten (nur ausgeklappte) */}
        {rows.flatMap(r => r.kinderRows.map(kr => (
          <KnotenL2 key={kr.k.id} sektion={kr.k} y={kr.y} vbMarkdown={vbMarkdown} />
        )))}
      </div>
      {rowH < 34 ? (
        <div className="mt-2 text-[11px] text-[var(--tf-text-tertiary)]">Kompakte Darstellung (viele Kapitel).</div>
      ) : null}
    </div>
  );
}

function KnotenL1({ row, vbMarkdown }: { row: L1Row; vbMarkdown: string | null }): React.ReactElement {
  const { s, kinder, expanded, aspekte, duenn } = row;
  const badge = aspekte.length ? aspekte.join('/') : null;
  return (
    <div className="group absolute" style={{ left: L1_X, top: row.y, width: L1_W, height: NODE_H }} tabIndex={0}>
      <div className="flex h-full items-center gap-1.5 rounded-md px-2 text-[13px] outline-none hover:bg-[var(--tf-hover)] focus:bg-[var(--tf-hover)]"
        style={{ border: '0.5px solid var(--tf-border)', borderRadius: 6 }}>
        {s.nummer ? <span className="shrink-0 text-[var(--tf-text-tertiary)]">{s.nummer}</span> : null}
        <span className="min-w-0 flex-1 truncate text-[var(--tf-text)]">{s.titel}</span>
        {duenn ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[var(--tf-text-tertiary)]" title="dünne Substanz">
            <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: WARN_DOT }} /> dünn
          </span>
        ) : null}
        {!expanded && kinder.length > 0 ? <span className="shrink-0 text-[11px] text-[var(--tf-text-tertiary)]">+{kinder.length}</span> : null}
        {badge ? (
          <span className="shrink-0 rounded px-1 py-0.5 text-[10.5px] text-[var(--tf-text-secondary)]" style={{ border: '0.5px solid var(--tf-border)' }}>{badge}</span>
        ) : (
          <span className="shrink-0 text-[10.5px] text-[var(--tf-text-tertiary)]">ohne Aspekt</span>
        )}
      </div>
      <FundstellePopover sektion={s} vbMarkdown={vbMarkdown} />
    </div>
  );
}

function KnotenL2({ sektion, y, vbMarkdown }: { sektion: VbSektion; y: number; vbMarkdown: string | null }): React.ReactElement {
  return (
    <div className="group absolute" style={{ left: L2_X, top: y, width: L2_W, height: NODE_H }} tabIndex={0}>
      <div className="flex h-full items-center justify-center rounded-md text-[12px] text-[var(--tf-text-secondary)] outline-none hover:bg-[var(--tf-hover)] focus:bg-[var(--tf-hover)]"
        style={{ border: '0.5px solid var(--tf-border)', borderRadius: 6 }}>
        {sektion.nummer ?? sektion.id}
      </div>
      <FundstellePopover sektion={sektion} vbMarkdown={vbMarkdown} />
    </div>
  );
}

/**
 * Deterministisches Layout: Ebene-1-Sektionen (ohne `s-toc`/`s-intro`) vertikal;
 * die ZWEI „prominentesten" Kapitel werden ausgeklappt — sortiert nach
 * (Kinderzahl desc, trägt-Aspekt desc, Dokumentreihenfolge asc). Der Aspekt-
 * Tiebreak hält bei gleicher Kinderzahl inhaltlich relevante Kapitel vor „ohne
 * Aspekt"-Kapiteln (z.B. „Wirtschaftliche Risiken") — deterministisch, KEIN
 * Hardcode auf konkrete Kapitelnummern. Ausgeklappte Kinder reservieren eigene
 * Zeilen, der Elternknoten wird dagegen zentriert. Bei > 25 Ebene-1-Knoten
 * kompakterer Zeilenabstand.
 */
export function baueLayout(gliederung: VbSektion[], mapping: AspektMapping, substanz: AspektSubstanz[]) {
  const s2a = sektionZuAspekte(mapping);
  const duennAspekte = new Set(substanz.filter(x => x.duenn).map(x => x.aspektId));
  const l1 = gliederung.filter(s => s.ebene === 1 && s.id !== 's-toc' && s.id !== 's-intro');
  const kinderVon = (s: VbSektion): VbSektion[] =>
    s.nummer ? gliederung.filter(k => k.ebene === 2 && k.nummer?.startsWith(`${s.nummer}.`)) : [];

  const aspekteFuer = (s: VbSektion, kinder: VbSektion[]): string[] => {
    const eigen = s2a[s.id] ?? [];
    if (eigen.length) return eigen;
    const set = new Set<string>();
    for (const k of kinder) for (const a of s2a[k.id] ?? []) set.add(a);
    return [...set].sort();
  };

  const mitKindern = l1.map(s => ({ s, kinder: kinderVon(s), aspekte: aspekteFuer(s, kinderVon(s)) }));
  const expandIds = new Set(
    mitKindern.filter(x => x.kinder.length > 0)
      .sort((a, b) =>
        b.kinder.length - a.kinder.length
        || (b.aspekte.length > 0 ? 1 : 0) - (a.aspekte.length > 0 ? 1 : 0)
        || a.s.start - b.s.start)
      .slice(0, 2).map(x => x.s.id),
  );

  const rowH = l1.length > 25 ? 28 : 34;

  let y = 0;
  const rows: L1Row[] = mitKindern.map(({ s, kinder }) => {
    const expanded = expandIds.has(s.id);
    const block = expanded ? Math.max(1, kinder.length) : 1;
    const top = y;
    const centerY = top + ((block - 1) * rowH) / 2;
    const kinderRows = expanded ? kinder.map((k, i) => ({ k, y: top + i * rowH })) : [];
    y += block * rowH;
    const aspekte = aspekteFuer(s, kinder);
    return { s, kinder, expanded, y: centerY, kinderRows, aspekte, duenn: aspekte.some(a => duennAspekte.has(a)) };
  });

  return { rows, totalH: Math.max(rowH, y), rowH };
}
