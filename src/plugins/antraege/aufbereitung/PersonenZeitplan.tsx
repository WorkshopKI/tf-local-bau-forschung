/**
 * Schwimmbahnen-Ansicht des Zeitplan-Tabs „Nach Person" (Paket 3, pure). Eine Bahn
 * je Mitarbeiter (`maNr`), Balken aus den Einzel-`ApZeile`-Einträgen der Person.
 * Nutzt dieselbe X-Achse/Gridlines/Leerflächen-Annotation wie „Nach AP"
 * (`GanttAchse`) und positioniert die Balken **tagesgenau** über `posStart`/`posEnde`
 * (Fallback: ganze Monate). Bahn-Warnung (Kapazität) kommt aus der geteilten
 * `kapazitaetProMaMonat`-Aggregation — NICHT aus Befund-Texten (Default #5).
 */
import { useMemo } from 'react';
import { type ApZeile, kapazitaetProMaMonat, KAPAZITAET_GRENZE_PM } from './tabellen';
import {
  GANTT_W, GANTT_ROW_H, GANTT_KOPF_H,
  macheAchse, GanttGrid, GanttLeerAnnotation,
} from './GanttAchse';

const WARN = 'var(--tf-warning-text)'; // Bahn-Warnung — Token statt Hex (Default #4)

interface PersonenZeitplanProps {
  zeilen: ApZeile[];
  /** Monat, bis zu dem die X-Achse reicht (max über beide Quellen). */
  achseMax: number;
  /** Quelle des angezeigten Zeitplans (für die Leerflächen-Annotation). */
  quelleLabel: string;
}

const kuerzePm = (n: number): string => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });

interface Bahn {
  ma: string;
  eintraege: ApZeile[];
  summePm: number;
  ueberlastet: boolean;
}

export function PersonenZeitplan({ zeilen, achseMax, quelleLabel }: PersonenZeitplanProps): React.ReactElement {
  const bahnen = useMemo<Bahn[]>(() => {
    const proMa = new Map<string, ApZeile[]>();
    for (const z of zeilen) {
      const ma = z.maNr?.trim();
      if (!ma) continue;
      const arr = proMa.get(ma) ?? [];
      arr.push(z);
      proMa.set(ma, arr);
    }
    const last = kapazitaetProMaMonat(zeilen);
    return [...proMa.keys()]
      .sort((a, b) => a.localeCompare(b, 'de'))
      .map(ma => ({
        ma,
        eintraege: proMa.get(ma)!,
        summePm: proMa.get(ma)!.reduce((sum, z) => sum + (z.pm ?? 0), 0),
        ueberlastet: [...(last.get(ma)?.values() ?? [])].some(l => l.pm > KAPAZITAET_GRENZE_PM + 1e-9),
      }));
  }, [zeilen]);

  if (bahnen.length === 0) {
    return (
      <div className="py-10 text-center text-[13px] text-[var(--tf-text-tertiary)]">
        Keine MA-Zuordnung im Zeitplan — „Nach Person" ist nur mit Anlage 5 verfügbar.
      </div>
    );
  }

  const achse = macheAchse(achseMax);
  const { x } = achse;
  const H = GANTT_KOPF_H + bahnen.length * GANTT_ROW_H + 8;
  const letzterMonat = zeilen.reduce((max, z) => Math.max(max, z.monatEnde ?? z.monatStart ?? 0), 0);

  return (
    <svg viewBox={`0 0 ${GANTT_W} ${H}`} width="100%" role="img" aria-label="Schwimmbahnen des Projektplans nach Mitarbeiter"
      style={{ display: 'block', maxWidth: '100%' }}>
      <GanttGrid achse={achse} hoehe={H} />
      <GanttLeerAnnotation achse={achse} letzterMonat={letzterMonat} anzahlZeilen={bahnen.length} quelleLabel={quelleLabel} />

      {bahnen.map((bahn, i) => {
        const rowTop = GANTT_KOPF_H + i * GANTT_ROW_H;
        const mid = rowTop + GANTT_ROW_H / 2;
        return (
          <g key={bahn.ma}>
            {bahn.ueberlastet ? <circle cx={6} cy={rowTop + 10} r={3.5} fill={WARN} /> : null}
            <text x={14} y={rowTop + 14} fontSize={14} fontWeight={500} fill="var(--tf-text)">MA {bahn.ma}</text>
            <text x={14} y={rowTop + 26} fontSize={10.5} fill="var(--tf-text-tertiary)">{kuerzePm(bahn.summePm)} PM</text>

            {bahn.eintraege.map((z, j) => {
              if (z.monatStart == null) return null;
              const p1 = z.posStart ?? z.monatStart;
              const p2 = z.posEnde ?? ((z.monatEnde ?? z.monatStart) + 1);
              const x1 = x(p1);
              const breite = Math.max(2, x(p2) - x1);
              return (
                <g key={`${z.nummer}-${j}`}>
                  <text x={x1} y={mid - 8} fontSize={11} fill="var(--tf-text-tertiary)">{z.nummer}</text>
                  <rect x={x1} y={mid - 4} width={breite} height={8} rx={4} fill="var(--tf-text-secondary)" opacity={0.75} />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
