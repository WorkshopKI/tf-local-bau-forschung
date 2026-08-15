/**
 * Die Schnellzugriff-Zeile über der Tabelle: was in der Filterleiste angepinnt
 * wurde, steht hier als Schalter.
 *
 * Drei Formen, je nach Art des Pins (`pinnedFilters.ts`):
 *
 * - **Wert** → Umschalt-Chip mit Merkmal, Wert und Trefferzahl. Ein Klick
 *   filtert, ein zweiter hebt auf.
 * - **Facette** → Umschalter (`CollapsibleSeg`, dieselbe Pille wie die
 *   Quickfilter): `Alle · Einzelprojekt 11 · Kooperationsprojekt 2`. Für alles,
 *   wo man ständig hin und her springt statt nur ein und aus.
 * - **Kombination** → Schalter, der seinen Satz DAZULEGT und beim Ausschalten
 *   nur sein eigenes Zutun zurücknimmt.
 *
 * **Die Zähler kommen aus derselben Basis wie die Quickfilter-Pillen**
 * (`useFilteredAntraege().countBase`: Sicht + Vorfilter + Bearbeiter-Filter,
 * ohne die Sidebar-Filter). Eine eigene Basis hier hieße, dass zwei Zeilen
 * übereinander verschiedene Zahlen für dieselbe Frage zeigen.
 */
import { useMemo } from 'react';
import { computeFacetCounts, type ActiveFilterValue, type FilterDefinition } from '@/core/services/csv';
import { FilterChip } from '@/components/ui/FilterChip';
import { useFilteredAntraege } from '../useFilteredAntraege';
import { useFilterState } from './useFilterState';
import { CollapsibleSeg, type CollapsibleSegItem } from './CollapsibleSeg';
import { PinNadel } from './PinNadel';
import { generateLabel } from './frequentFilters';
import {
  usePinnedFilters,
  pinKey,
  wertAktiv,
  wertUmschalten,
  kombiAktiv,
  kombiEinschalten,
  kombiAusschalten,
} from './pinnedFilters';

/** Beschriftung des Umschalters, wenn nichts gewählt ist. `CollapsibleSeg`
 *  kollabiert die Pille genau auf diesem Wert. */
const ALLE = 'Alle';

/** Beschriftung, wenn die Facette mehr als einen Wert trägt — gesetzt aus der
 *  Filterleiste, wo Mehrfachauswahl möglich ist. Der Umschalter kann das nicht
 *  herstellen, aber er darf es auch nicht verschweigen: „Alle" wäre gelogen. */
const MEHRERE = 'Mehrere';

/** Ja/Nein-Facetten führen ihre Werte als `ja`/`nein`; im Umschalter stünden
 *  sie sonst kleingeschrieben zwischen Klartext-Werten. */
const JA_NEIN: Readonly<Record<string, string>> = { ja: 'Ja', nein: 'Nein' };

/** Anzeige-Beschriftung eines Facetten-Werts (Code → Klartext, wo gepflegt). */
function wertLabel(
  v: string, labels: Record<string, string> | undefined, typ?: string,
): string {
  if (typ === 'boolean_ja_nein' && JA_NEIN[v]) return JA_NEIN[v]!;
  return labels?.[v] ?? v;
}

export function PinLeiste(): React.ReactElement | null {
  const pins = usePinnedFilters(s => s.pins);
  const setzeDelta = usePinnedFilters(s => s.setzeDelta);
  const definitions = useFilterState(s => s.definitions);
  const active = useFilterState(s => s.active);
  const valueLabels = useFilterState(s => s.valueLabels);
  const setActiveValue = useFilterState(s => s.setActiveValue);
  const { countBase } = useFilteredAntraege();

  const defById = useMemo(
    () => new Map(definitions.map(d => [d.id, d])),
    [definitions],
  );

  // Zähler je Pin, EINMAL für alle. `computeFacetCounts` läuft je Aufruf über
  // die ganze Basis; ohne Memo liefe das bei jedem Tastendruck im Suchfeld neu.
  const zaehler = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const p of pins) {
      if (p.art === 'kombination') continue;
      const def = defById.get(p.filterId);
      if (!def) continue;
      m.set(p.filterId, computeFacetCounts(countBase, active, definitions, def));
    }
    return m;
  }, [pins, defById, countBase, active, definitions]);

  if (pins.length === 0) return null;

  const setzeSlot = (filterId: string, value: ActiveFilterValue | null): void => {
    setActiveValue(filterId, value);
  };

  return (
    <>
      {pins.map(p => {
        if (p.art === 'kombination') {
          const an = kombiAktiv(active, p.gesetzt);
          const label = generateLabel(p.gesetzt, definitions, valueLabels);
          return (
            <span key={pinKey(p)} className="group/pin inline-flex items-center gap-0.5">
              <FilterChip
                label="Satz"
                value={label}
                onClick={() => {
                  if (an) {
                    for (const a of kombiAusschalten(active, p.gesetzt, p.delta)) {
                      setzeSlot(a.filterId, a.value);
                    }
                    setzeDelta(p.signatur, null);
                    return;
                  }
                  const { aenderungen, delta } = kombiEinschalten(active, p.gesetzt);
                  for (const a of aenderungen) setzeSlot(a.filterId, a.value);
                  setzeDelta(p.signatur, delta);
                }}
                title={an
                  ? `„${label}" ausschalten — nimmt nur zurück, was dieser Schalter gesetzt hat`
                  : `„${label}" dazulegen`}
                className={an ? 'ring-1 ring-[var(--tf-primary)]' : undefined}
              />
              <PinNadel pin={p} bezeichnung={label} stetsSichtbar={false} />
            </span>
          );
        }

        const def = defById.get(p.filterId);
        // Filter-Definition weg (Kuration umgebaut) → der Pin bleibt liegen,
        // zeigt aber nichts an. Ein Chip ohne Definition könnte weder zählen
        // noch schalten.
        if (!def) return null;
        const counts = zaehler.get(p.filterId);
        const labels = valueLabels[def.feld];

        if (p.art === 'wert') {
          const an = wertAktiv(active, def.id, p.wert);
          const n = counts?.get(p.wert) ?? 0;
          const text = wertLabel(p.wert, labels, def.typ);
          return (
            <span key={pinKey(p)} className="group/pin inline-flex items-center gap-0.5">
              <FilterChip
                label={def.name}
                // Wert und Zahl getrennt gesetzt: als eine Zeichenkette las sich
                // „NW 1 0" wie ein zweiteiliger Wert — bei Werten, die selbst
                // eine Ziffer tragen, verschmelzen Bezeichner und Trefferzahl.
                value={<>{text}<span className="ml-1.5 tabular-nums text-[var(--tf-text-tertiary)]">{n}</span></>}
                onClick={() => setzeSlot(def.id, wertUmschalten(active, def, p.wert))}
                title={an ? `„${text}" wieder aufheben` : `Auf „${text}" filtern (${n})`}
                className={an ? 'ring-1 ring-[var(--tf-primary)]' : undefined}
              />
              <PinNadel pin={p} bezeichnung={`${def.name} ${text}`} stetsSichtbar={false} />
            </span>
          );
        }

        const modell = umschalterModell(def, active, counts, labels);
        return (
          <span key={pinKey(p)} className="group/pin inline-flex items-center gap-0.5">
            <CollapsibleSeg
              label={def.name}
              value={modell.wert}
              items={modell.items}
              onChange={l => {
                // „Mehrere" ist eine Auskunft, keine Wahl — ein Klick darauf
                // darf die Auswahl nicht leeren, die er gerade beschreibt.
                if (l === MEHRERE) return;
                setzeSlot(def.id, umschalterZuWert(l, def, counts, labels));
              }}
              defaultValue={ALLE}
            />
            <PinNadel pin={p} bezeichnung={def.name} stetsSichtbar={false} />
          </span>
        );
      })}
    </>
  );
}

/** Die belegten Werte der Facette in stabiler Reihenfolge (häufigste zuerst). */
function werteVon(counts: Map<string, number> | undefined): string[] {
  if (!counts) return [];
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

function gewaehlteWerte(
  active: readonly { filterId: string; value: ActiveFilterValue }[], filterId: string,
): string[] {
  const af = active.find(a => a.filterId === filterId);
  if (!af) return [];
  if (Array.isArray(af.value)) return af.value as string[];
  return typeof af.value === 'string' && af.value ? [af.value] : [];
}

/**
 * Segmente und aktueller Wert des Facetten-Umschalters — in EINEM Schritt,
 * weil `CollapsibleSeg` verlangt, dass der Wert genau einem Segment entspricht.
 * Getrennt berechnet wären es zwei Ableitungen, die auseinanderlaufen können,
 * und die Pille zeigte dann gar nichts Ausgewähltes an.
 */
function umschalterModell(
  def: FilterDefinition,
  active: readonly { filterId: string; value: ActiveFilterValue }[],
  counts: Map<string, number> | undefined,
  labels: Record<string, string> | undefined,
): { wert: string; items: CollapsibleSegItem[] } {
  const items: CollapsibleSegItem[] = [{ label: ALLE }];
  for (const v of werteVon(counts)) {
    items.push({ label: wertLabel(v, labels, def.typ), count: counts?.get(v) ?? 0 });
  }
  const gewaehlt = gewaehlteWerte(active, def.id);
  let wert = ALLE;
  if (gewaehlt.length > 1) {
    wert = MEHRERE;
  } else if (gewaehlt.length === 1) {
    const l = wertLabel(gewaehlt[0]!, labels, def.typ);
    // Ein Wert, den die Facette gerade nicht anbietet (durch eine andere Achse
    // weggefiltert), hat kein Segment — er liest sich als „Mehrere", nicht als
    // „Alle": es filtert etwas, nur nicht sichtbar in dieser Pille.
    wert = items.some(i => i.label === l) ? l : MEHRERE;
  }
  if (wert === MEHRERE) items.push({ label: MEHRERE });
  return { wert, items };
}

function umschalterZuWert(
  gewaehltesLabel: string,
  def: FilterDefinition,
  counts: Map<string, number> | undefined,
  labels: Record<string, string> | undefined,
): ActiveFilterValue | null {
  if (gewaehltesLabel === ALLE) return null;
  if (gewaehltesLabel === MEHRERE) return null;
  const wert = werteVon(counts).find(v => wertLabel(v, labels, def.typ) === gewaehltesLabel);
  if (wert === undefined) return null;
  return def.typ === 'multi_select' ? [wert] : wert;
}
