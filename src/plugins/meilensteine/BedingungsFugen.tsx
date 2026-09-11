/**
 * Die Fugen zwischen zwei Bedingungs-Zeilen: das **Verknüpfungs-Wort** in der
 * linken Rinne und die **Einfüge-Marke** des Ziehens.
 *
 * Beides beantwortet dieselbe Frage — „wie hängen diese zwei Zeilen zusammen?"
 * —, gehört aber nicht in die Struktur-Rekursion des
 * [BedingungEditor](./BedingungEditor.tsx), die schon genug zu tun hat.
 *
 * **Warum das Wort in einer Rinne steht und nicht in einer eigenen Zeile.**
 * Eine Gruppe zeigt ihre Verknüpfung im Kopf („ALLE müssen zutreffen"), aber
 * gelesen wird eine Regel zwischen den Zeilen. Ohne das Wort dort sah ein
 * Gruppen-Kasten, der Geschwister der Blätter ist, wie deren Untergruppe aus —
 * genau die Rückmeldung, aus der dieses Modul entstand. Eine eigene Zeile je
 * Fuge kostete bei vier Bedingungen rund 42 px und nähme die Dichte zurück,
 * die v5.3 gewonnen hat; die Rinne kostet **null** Höhe und richtet die Kette
 * zusätzlich an einer Kante aus.
 *
 * Die Farbe ist `--tf-text-secondary` (gemessen 5,33:1): das Wort trägt
 * Bedeutung und muss lesbar sein — `--tf-text-tertiary` läge mit 2,61:1 unter AA.
 *
 * **Klein und in Gewicht 500** (v6.59): „und / oder" statt „UND / ODER" in 600.
 * Der Schalter im Gruppenkopf sagt „alle / eine"; das Wort hier ist sein Echo
 * zwischen den Zeilen, kein zweites Bedienelement — und Versalien in Gewicht
 * 600 zogen den Blick auf die Fuge statt auf die Bedingungen (DESIGN_GUIDE:
 * keine Versalien außerhalb von Abschnittsköpfen, nie 600).
 */
import type { BedingungsPfad } from '@/core/status';

/** Wohin ein gezogener Knoten fällt: in diese Liste, an diese Stelle. */
export interface DropZiel { elternPfad: BedingungsPfad; index: number }

export const RINNE_BREITE = 'w-[38px]';

/**
 * Die linke Rinne einer Zeile — ab dem zweiten Geschwister mit dem Wort der
 * Verknüpfung, davor leer. `wort` ist `null` beim ersten Kind.
 */
export function Rinne({ wort }: { wort: string | null }): React.ReactElement {
  return (
    <span
      className={`${RINNE_BREITE} shrink-0 self-start pt-[4px] pr-1.5 text-right select-none
        text-[11px] font-medium leading-[16px]
        text-[var(--tf-text-secondary)]`}
    >
      {wort ?? ''}
    </span>
  );
}

/**
 * Die Einfüge-Marke zwischen zwei Geschwistern.
 *
 * Zeilen selbst sind **kein** „hier hinein"-Ziel: „auf die Zeile" wäre zwischen
 * „davor" und „hinein" nicht zu unterscheiden, und die Regel bekäme beim
 * Loslassen eine andere Bedeutung, als die Geste zeigte. Blattzeilen melden
 * stattdessen ihre nähere **Kante** (obere Hälfte = davor), in eine Gruppe
 * hinein führt deren Kasten.
 *
 * **Sichtbar, sobald ein Zug läuft** (v6.3): vorher bekam die Marke erst Farbe,
 * wenn man sie genau traf — wer nicht weiß, dass es Ziele gibt, sucht keine.
 * Der Trefferbereich ist 10 px hoch, die Linie 2 px; die negativen Ränder
 * halten den Höhenbeitrag bei 2 px.
 */
export function Marke({ elternPfad, index, aktiv, erlaubt, zeigen, setZiel, onAblegen }: {
  elternPfad: BedingungsPfad;
  index: number;
  /** Liegt der Cursor gerade hier? */
  aktiv: boolean;
  /** Darf der gezogene Knoten überhaupt in diese Liste? */
  erlaubt: boolean;
  /** Läuft gerade ein Zug — also: Ziele zeigen? */
  zeigen: boolean;
  setZiel: (z: DropZiel | null) => void;
  onAblegen: () => void;
}): React.ReactElement {
  return (
    <div
      onDragOver={e => {
        if (!erlaubt) return;
        e.preventDefault();
        e.stopPropagation();
        setZiel({ elternPfad, index });
      }}
      onDrop={e => { if (!erlaubt) return; e.preventDefault(); e.stopPropagation(); onAblegen(); }}
      aria-hidden
      className="h-[10px] -my-[4px] flex items-center"
    >
      <div
        className="h-[2px] w-full rounded-full"
        style={aktiv
          ? { background: 'var(--tf-primary)' }
          : (zeigen ? { background: 'var(--tf-border)' } : undefined)}
      />
    </div>
  );
}
