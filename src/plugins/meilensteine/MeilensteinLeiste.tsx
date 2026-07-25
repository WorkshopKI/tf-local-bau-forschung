/**
 * Meilenstein-Zeitstrahl eines Verbunds: je Knoten eine Zeile auf einer
 * Wochen-Achse. Soll ist eine hohle Raute, Ist ein gefüllter Punkt; liegen sie
 * auseinander, verbindet sie eine Linie in der Verzugsfarbe.
 *
 * Reines React/CSS ohne SVG und ohne Chart-Bibliothek — dieselbe Bauart wie die
 * Status-Timeline. Die Achse ist relativ (Woche 0 … n), nicht kalendarisch: die
 * Frage ist „wie weit ist dieser Antrag in SEINER Laufzeit", nicht „welcher Tag
 * ist heute". Kalenderdaten stehen in den Tooltips.
 */
import { Tooltip } from '@/components/ui/Tooltip';
import type { MeilensteinKnoten, MstErgebnis, VerbundMeilensteine } from '@/core/meilensteine';
import { sortiereKnoten, tiefeVon } from '@/core/meilensteine';
import { ZUSTAND_FARBE, ZUSTAND_LABEL, feldStil, formatAbweichung, formatDatum } from './labels';

const LABEL_W = 210;
const ZEILE_H = 26;

/** Ist-Woche eines Ergebnisses relativ zur Soll-Woche (nur wenn beides bekannt). */
function istWoche(e: MstErgebnis, sollWoche: number): number | null {
  return e.abweichungTage === null ? null : sollWoche + e.abweichungTage / 7;
}

function Marke({ links, farbe, gefuellt, titel }: {
  links: number; farbe: string; gefuellt: boolean; titel: string;
}): React.ReactElement {
  return (
    <Tooltip content={titel}>
      <span
        className="absolute top-1/2 block rounded-full"
        style={{
          left: `${links}%`,
          width: 9,
          height: 9,
          marginLeft: -4.5,
          marginTop: -4.5,
          background: gefuellt ? farbe : 'transparent',
          border: `1.5px solid ${farbe}`,
        }}
      />
    </Tooltip>
  );
}

export function MeilensteinLeiste({ bewertung, knoten }: {
  bewertung: VerbundMeilensteine;
  knoten: MeilensteinKnoten[];
}): React.ReactElement {
  const sortiert = sortiereKnoten(knoten);
  const perKnoten = new Map(bewertung.ergebnisse.map(e => [e.knotenId, e]));

  // Achse: bis zur spätesten Soll-Woche, mindestens aber bis zur laufenden Woche
  // — sonst rutscht ein überfälliger Vorgang aus dem Bild.
  const maxSoll = Math.max(1, ...sortiert.map(k => k.sollWoche));
  const maxWoche = Math.max(maxSoll, bewertung.wocheAktuell ?? 0);
  const pos = (woche: number): number => Math.min(100, Math.max(0, (woche / maxWoche) * 100));
  const heuteLinks = bewertung.wocheAktuell === null ? null : pos(bewertung.wocheAktuell);

  const achsMarken = Array.from({ length: maxWoche + 1 }, (_, i) => i)
    .filter(w => w % Math.max(1, Math.ceil(maxWoche / 12)) === 0);

  return (
    <div className="flex flex-col">
      {/* Wochen-Achse */}
      <div className="flex items-end" style={{ height: 18 }}>
        <div style={{ width: LABEL_W }} />
        <div className="relative flex-1">
          {achsMarken.map(w => (
            <span
              key={w}
              className="absolute text-[10px] text-[var(--tf-text-tertiary)]"
              style={{ left: `${pos(w)}%`, transform: 'translateX(-50%)' }}
            >
              {w === 0 ? 'Eingang' : `W${w}`}
            </span>
          ))}
        </div>
      </div>

      {sortiert.map(k => {
        const e = perKnoten.get(k.id);
        if (!e) return null;
        const tiefe = tiefeVon(knoten, k.id);
        const farbe = ZUSTAND_FARBE[e.zustand];
        const sollLinks = pos(k.sollWoche);
        const ist = istWoche(e, k.sollWoche);
        const istLinks = ist === null ? null : pos(ist);
        const verzug = e.abweichungTage !== null && e.abweichungTage > 0;

        return (
          <div key={k.id} className="flex items-center" style={{ height: ZEILE_H }}>
            <div
              className="shrink-0 flex items-baseline gap-1.5 pr-2 min-w-0"
              style={{ width: LABEL_W, paddingLeft: tiefe * 12 }}
            >
              <span className="text-[10.5px] font-mono text-[var(--tf-text-tertiary)] shrink-0">
                {k.nummer}
              </span>
              <span
                className="text-[12px] truncate"
                style={{ color: e.zustand === 'nichtRelevant' ? 'var(--tf-text-tertiary)' : 'var(--tf-text)' }}
                title={k.label}
              >
                {k.label}
              </span>
            </div>

            <div className="relative flex-1 h-full">
              {/* Grundlinie */}
              <span
                aria-hidden
                className="absolute left-0 right-0 top-1/2"
                style={{ height: '0.5px', background: 'var(--tf-border)', marginTop: -0.25 }}
              />
              {/* Heute-Linie */}
              {heuteLinks !== null && (
                <span
                  aria-hidden
                  className="absolute top-1 bottom-1"
                  style={{ left: `${heuteLinks}%`, width: '0.5px', background: 'var(--tf-border-hover)' }}
                />
              )}
              {/* Verzugs-Strecke Soll → Ist */}
              {istLinks !== null && verzug && (
                <span
                  aria-hidden
                  className="absolute top-1/2"
                  style={{
                    left: `${Math.min(sollLinks, istLinks)}%`,
                    width: `${Math.abs(istLinks - sollLinks)}%`,
                    height: 2,
                    marginTop: -1,
                    background: farbe,
                    opacity: 0.5,
                  }}
                />
              )}
              {e.zustand !== 'nichtRelevant' && (
                <Marke
                  links={sollLinks}
                  farbe="var(--tf-border-hover)"
                  gefuellt={false}
                  titel={`Soll: Woche ${k.sollWoche} (${formatDatum(e.sollDatum)})`}
                />
              )}
              {istLinks !== null && (
                <Marke
                  links={istLinks}
                  farbe={farbe}
                  gefuellt
                  titel={`Erreicht ${formatDatum(e.istDatum)} · ${formatAbweichung(e.abweichungTage)}`}
                />
              )}
              {/* Erreicht ohne Datum: Punkt auf dem Soll-Termin, damit der
                  Zustand sichtbar ist, ohne einen Termin zu erfinden. */}
              {e.zustand === 'erreicht' && istLinks === null && (
                <Marke
                  links={sollLinks} farbe={farbe} gefuellt
                  titel="Erreicht — Datum aus den Daten nicht ableitbar"
                />
              )}
            </div>

            <span
              className="shrink-0 w-[92px] text-right text-[11px]"
              style={{ color: farbe }}
              title={e.zustand === 'erreicht' ? formatAbweichung(e.abweichungTage) : undefined}
            >
              {ZUSTAND_LABEL[e.zustand]}
            </span>
          </div>
        );
      })}

      {sortiert.length === 0 && (
        <p className="py-4 text-[12px] text-[var(--tf-text-tertiary)]" style={feldStil}>
          Der freigegebene Plan enthält keine Meilensteine.
        </p>
      )}
    </div>
  );
}
