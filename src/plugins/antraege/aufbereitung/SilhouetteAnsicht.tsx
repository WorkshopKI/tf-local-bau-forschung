/**
 * Silhouette-Ansicht der Abdeckung (Paket 3, rein deterministisch). Bildet die
 * VB-Gliederung als proportionale Flächenverteilung ab: links eine schmale
 * vertikale Silhouette (ein Block je Ebene-1-Sektion, Höhe ∝ Zeichenanteil),
 * rechts je Block eine Zeile mit Nummer/Titel · Anteil · Aspekt-Badge · Zusatz-
 * Badges. Monochrom — nur der „dünn"-Dot trägt Farbe (Token, kein Hex).
 *
 * „Zeichenanteil" = kontinuierliche Masse eines Kapitels inkl. seiner
 * Unterabschnitte (bis zum Beginn des nächsten Ebene-1-Kapitels), NICHT nur die
 * eigene Überschrift-Sektion. Klick/Hover öffnet dasselbe `FundstellePopover` wie
 * Liste + Karte (kein Sprung).
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { StatusDot } from '@/components/ui/StatusBadge';
import type { VbSektion } from './gliederung';
import { sektionZuAspekte, type AspektMapping, type AspektSubstanz } from './aspekte';
import { baueSilhouetteBloecke } from './silhouette-core';
import { FundstellePopover } from './FundstelleChip';

const WARN = 'var(--tf-warning-text)'; // Warning-Dot/Badge — Token statt Hex (Default #4)
const SPALTE_W = 56;   // Breite der Silhouetten-Spalte
const H_TARGET = 540;  // Zielhöhe für 100 % Zeichenanteil
const MIN_ROW = 22;    // Mindest-Blockhöhe (Label-Lesbarkeit; hebt die 12px-Vorgabe an)

export interface SilhouetteAnsichtProps {
  gliederung: VbSektion[];
  mapping: AspektMapping;
  substanz: AspektSubstanz[];
  vbMarkdown: string | null;
  /** true, wenn eine SEPARATE Anlage-5-Datei als Quelle existiert (→ Fußzeile + „Detail in Anlage 5"). */
  hatAnlage5Datei: boolean;
}

interface SilhouetteZeile {
  sektion?: VbSektion; // undefined = kombinierte Anlagen-Zeile
  nummer?: string;
  titel: string;
  anteil: number;
  hoehe: number;
  aspekte: string[]; // [] = ohne Aspekt
  duenn: boolean;
  detailInAnlage: boolean;
  istAnlagenGruppe: boolean;
}

const anteilLabel = (a: number): string =>
  `${(a * 100).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

/**
 * Deterministisches Silhouetten-Modell: Ebene-1-Blöcke (ohne `s-toc`, `s-intro` nur
 * > 1 %), Masse = kontinuierlicher Zeichen-Span bis zum nächsten Ebene-1-Kapitel,
 * eingebettete `Anlage …`-Kapitel zu einer Sammelzeile gebündelt.
 */
function baueSilhouette(
  gliederung: VbSektion[], mapping: AspektMapping, substanz: AspektSubstanz[], hatAnlage5Datei: boolean,
): SilhouetteZeile[] {
  const s2a = sektionZuAspekte(mapping);
  const duennAspekte = new Set(substanz.filter(x => x.duenn).map(x => x.aspektId));
  // Geteilter Massen-/Anteils-Kern (identisch zur Lesemodus-Scroll-Nav).
  const kern = baueSilhouetteBloecke(gliederung);
  const bloecke = kern.map(b => ({ s: b.sektion, masse: b.masse }));
  const gesamt = kern.reduce((sum, b) => sum + b.masse, 0) || 1;
  const anteilVon = (masse: number): number => masse / gesamt;

  const kinderVon = (s: VbSektion): VbSektion[] =>
    s.nummer ? gliederung.filter(k => k.ebene === 2 && k.nummer?.startsWith(`${s.nummer}.`)) : [];
  const aspekteFuer = (s: VbSektion): string[] => {
    const eigen = s2a[s.id] ?? [];
    if (eigen.length) return eigen;
    const set = new Set<string>();
    for (const k of kinderVon(s)) for (const a of s2a[k.id] ?? []) set.add(a);
    return [...set].sort();
  };
  const istAnlage = (s: VbSektion): boolean => /^anlage/i.test(s.titel.trim());

  const kapitel = bloecke.filter(b => !istAnlage(b.s) && !(b.s.id === 's-intro' && anteilVon(b.masse) <= 0.01));
  const anlagen = bloecke.filter(b => istAnlage(b.s));

  const zeilen: SilhouetteZeile[] = kapitel.map(b => {
    const aspekte = aspekteFuer(b.s);
    const anteil = anteilVon(b.masse);
    return {
      sektion: b.s, nummer: b.s.nummer, titel: b.s.titel, anteil,
      hoehe: Math.max(MIN_ROW, anteil * H_TARGET),
      aspekte,
      duenn: aspekte.length > 0 && aspekte.every(a => duennAspekte.has(a)),
      detailInAnlage: hatAnlage5Datei && aspekte.includes('H'),
      istAnlagenGruppe: false,
    };
  });

  if (anlagen.length) {
    const masse = anlagen.reduce((sum, b) => sum + b.masse, 0);
    const anteil = anteilVon(masse);
    const nummern = anlagen.map(b => b.s.nummer ?? b.s.titel.replace(/^anlage\s*/i, '').trim()).filter(Boolean).join(' / ');
    zeilen.push({
      titel: `Anlagen ${nummern}`.trim(), anteil,
      hoehe: Math.max(MIN_ROW, anteil * H_TARGET),
      aspekte: [], duenn: false, detailInAnlage: false, istAnlagenGruppe: true,
    });
  }
  return zeilen;
}

export function SilhouetteAnsicht({
  gliederung, mapping, substanz, vbMarkdown, hatAnlage5Datei,
}: SilhouetteAnsichtProps): React.ReactElement {
  const zeilen = useMemo(
    () => baueSilhouette(gliederung, mapping, substanz, hatAnlage5Datei),
    [gliederung, mapping, substanz, hatAnlage5Datei],
  );

  if (zeilen.length === 0) {
    return <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">Keine Gliederung erkannt.</div>;
  }

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-[2px]">
        {zeilen.map((z, i) => <Zeile key={z.sektion?.id ?? `anlagen-${i}`} z={z} vbMarkdown={vbMarkdown} />)}
      </div>
      {hatAnlage5Datei ? (
        <div className="mt-3 text-[11.5px] text-[var(--tf-text-tertiary)]" style={{ paddingLeft: SPALTE_W + 16 }}>
          + Anlage 5 (separate Datei, im Zeitplan ausgewertet)
        </div>
      ) : null}
    </div>
  );
}

function Zeile({ z, vbMarkdown }: { z: SilhouetteZeile; vbMarkdown: string | null }): React.ReactElement {
  const inhalt = (
    <>
      <div className="shrink-0" style={{ width: SPALTE_W }}>
        <div
          className="h-full rounded-[2px]"
          style={{ background: 'var(--tf-bg-secondary)', border: '0.5px solid var(--tf-border)', opacity: z.istAnlagenGruppe ? 0.6 : 1 }}
        />
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 py-0.5">
        {z.duenn ? <StatusDot color={WARN} size={7} title="dünne Substanz" /> : null}
        {z.nummer ? <span className="text-[13.5px] text-[var(--tf-text-tertiary)]">{z.nummer}</span> : null}
        <span className={cn('text-[13.5px]', z.istAnlagenGruppe ? 'text-[var(--tf-text-tertiary)]' : 'text-[var(--tf-text)]')}>{z.titel}</span>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{anteilLabel(z.anteil)}</span>
        {z.aspekte.length > 0 ? (
          <span className="rounded px-1 py-0.5 text-[10.5px] text-[var(--tf-text-secondary)]" style={{ border: '0.5px solid var(--tf-border)' }}>
            {z.aspekte.join('/')}
          </span>
        ) : !z.istAnlagenGruppe ? (
          <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">ohne Aspekt</span>
        ) : null}
        {z.duenn ? (
          <span className="rounded px-1.5 py-0.5 text-[10.5px] whitespace-nowrap text-[var(--tf-warning-text)]"
            style={{ border: '0.5px solid var(--tf-warning-border)', background: 'var(--tf-warning-soft)' }}>
            dünn
          </span>
        ) : null}
        {z.detailInAnlage ? <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">Detail in Anlage 5</span> : null}
      </div>
    </>
  );

  if (z.sektion) {
    return (
      <div className="group relative flex items-stretch gap-4 rounded outline-none hover:bg-[var(--tf-hover)] focus:bg-[var(--tf-hover)]"
        style={{ minHeight: z.hoehe }} tabIndex={0}>
        {inhalt}
        <FundstellePopover sektion={z.sektion} vbMarkdown={vbMarkdown} />
      </div>
    );
  }
  return <div className="flex items-stretch gap-4" style={{ minHeight: z.hoehe }}>{inhalt}</div>;
}
