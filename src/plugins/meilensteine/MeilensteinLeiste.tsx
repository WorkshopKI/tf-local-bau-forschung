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
import {
  VOR_EINGANG_HINWEIS, ZUSTAND_FARBE, ZUSTAND_LABEL, ZUSTAND_TEXT_FARBE,
  feldStil, formatAbweichung, formatDatum,
} from './labels';

/** Label-Spalte. Breit genug für den längsten Meilenstein-Titel des Seeds
 *  („Schriftstück abgestimmt und zur QS gesendet", eingerückt + Nummer) — der
 *  Name ist die Information, die Wochen-Achse nur die Verortung dazu. Längere
 *  Titel kürzt weiterhin `truncate` mit dem vollen Text im `title`. */
const LABEL_W = 340;
const ZEILE_H = 26;
/** Zustands-Spalte rechts. Die Wochen-Achse im Kopf muss denselben Platz
 *  aussparen — sonst ist sie breiter als die Zeilen darunter und die Marken
 *  stehen neben den Punkten, auf die sie sich beziehen. */
const STATUS_W = 92;

/** Ist-Woche eines Ergebnisses relativ zur Soll-Woche (nur wenn beides bekannt). */
function istWoche(e: MstErgebnis, sollWoche: number): number | null {
  return e.abweichungTage === null ? null : sollWoche + e.abweichungTage / 7;
}

function Marke({ links, farbe, gefuellt, titel, vorAchse }: {
  links: number; farbe: string; gefuellt: boolean; titel: string;
  /**
   * Der wahre Wert liegt LINKS neben der Achse und wurde auf 0 % geklemmt.
   * Dann steht statt des Punktes ein nach links zeigendes Dreieck: ein Punkt
   * auf der „Eingang"-Marke behauptete einen Termin, den der Tooltip im selben
   * Atemzug widerlegt (früheres Datum, negative Abweichung).
   */
  vorAchse?: boolean;
}): React.ReactElement {
  return (
    <Tooltip content={titel}>
      {vorAchse ? (
        <span
          className="absolute top-1/2 block"
          style={{
            left: `${links}%`,
            width: 0,
            height: 0,
            marginLeft: -6,
            marginTop: -4.5,
            borderTop: '4.5px solid transparent',
            borderBottom: '4.5px solid transparent',
            borderRight: `6px solid ${farbe}`,
          }}
        />
      ) : (
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
      )}
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

  // Höchstens ~8 Beschriftungen: die Achse ist die schmalere der beiden Spalten,
  // dichtere Marken stünden bei engem Fenster aneinander.
  const achsMarken = Array.from({ length: maxWoche + 1 }, (_, i) => i)
    .filter(w => w % Math.max(1, Math.ceil(maxWoche / 8)) === 0);

  return (
    <div className="flex flex-col">
      {/* Wochen-Achse — Spaltenraster identisch zu den Zeilen darunter. */}
      <div className="flex items-end" style={{ height: 18 }}>
        <div className="shrink-0" style={{ width: LABEL_W }} />
        <div className="relative flex-1">
          {achsMarken.map(w => {
            const links = pos(w);
            // Randmarken nach innen ziehen: mittig gesetzt ragt „Eingang" in die
            // Label-Spalte und die letzte Woche in die Zustands-Spalte.
            const versatz = links <= 0 ? '0%' : links >= 100 ? '-100%' : '-50%';
            return (
              <span
                key={w}
                className="absolute text-[10px] text-[var(--tf-text-tertiary)] whitespace-nowrap"
                style={{ left: `${links}%`, transform: `translateX(${versatz})` }}
              >
                {w === 0 ? 'Eingang' : `W${w}`}
              </span>
            );
          })}
        </div>
        <div className="shrink-0" style={{ width: STATUS_W }} />
      </div>

      {sortiert.map(k => {
        const e = perKnoten.get(k.id);
        if (!e) return null;
        const tiefe = tiefeVon(knoten, k.id);
        const farbe = ZUSTAND_FARBE[e.zustand];
        const sollLinks = pos(k.sollWoche);
        const ist = istWoche(e, k.sollWoche);
        const istLinks = ist === null ? null : pos(ist);
        // `pos` klemmt auf 0–100 %. Ein Ist VOR dem Eingang landete damit exakt
        // auf der „Eingang"-Marke, während der Tooltip ein früheres Datum und
        // eine negative Abweichung nannte — am echten Bestand 471 Ergebnisse in
        // 426 von 1767 Verbünden. Die Klemmung wird darum sichtbar gemacht.
        const vorAchse = ist !== null && ist < 0;
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
                  vorAchse={vorAchse}
                  titel={`Erreicht ${formatDatum(e.istDatum)} · ${formatAbweichung(e.abweichungTage)}${
                    vorAchse ? ` — ${VOR_EINGANG_HINWEIS}` : ''}`}
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

            {/* Textfarbe aus `ZUSTAND_TEXT_FARBE`, nicht aus der Marken-Palette:
                deren Rahmen-Tokens kamen als Schrift auf 1,2–1,4:1 Kontrast. */}
            <span
              className="shrink-0 text-right text-[11px]"
              style={{ width: STATUS_W, color: ZUSTAND_TEXT_FARBE[e.zustand] }}
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
