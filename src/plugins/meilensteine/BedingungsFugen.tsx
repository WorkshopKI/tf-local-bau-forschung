/**
 * Die Fugen zwischen zwei Bedingungen: der **Verbinder** („und" / „oder") und
 * die **Einfüge-Marke** des Ziehens.
 *
 * **Der Verbinder ist der Schalter** (v6.60, Prototyp C3). Bis v6.59 stand das
 * Wort als stilles Echo in einer linken Rinne, geschaltet wurde oben im Kopf
 * („alle | eine") — zwei Stellen für eine Sache, und die PL fand den Bereich
 * damit „noch nicht übersichtlich genug". Jetzt steht das Wort genau dort, wo
 * man eine Regel liest: zwischen zwei Karten oder zwei Bedingungen. Ein Klick
 * macht aus „und" ein „oder" — für alle Verbinder derselben Gruppe zugleich,
 * weil es EINE Verknüpfung ist. Der `title` sagt vorher, was der Klick tut.
 *
 * Getönt (`--tf-primary-light` / `--tf-primary`), damit man ihn als Bedienelement
 * erkennt; ungetönt läse er sich wieder als Text. Ohne `onSchalte` (Sammel-
 * Meilenstein: Unter-Meilensteine gelten immer alle) bleibt er stilles Wort.
 */
import type { BedingungsPfad, Verknuepfung } from '@/core/status';

/** Wohin ein gezogener Knoten fällt: in diese Liste, an diese Stelle. */
export interface DropZiel { elternPfad: BedingungsPfad; index: number }

export function Verbinder({ verknuepfung, onSchalte, linie = false }: {
  verknuepfung: Verknuepfung;
  /** Fehlt: nur das Wort, kein Schalter. */
  onSchalte?: () => void;
  /** Zwischen zwei Bedingungen einer Karte: mit Haarlinie links und rechts. */
  linie?: boolean;
}): React.ReactElement {
  const und = verknuepfung === 'alle';
  const wort = und ? 'und' : 'oder';
  const pille = onSchalte ? (
    <button
      type="button"
      onClick={onSchalte}
      title={und ? 'Klick: „oder" — dann genügt eine' : 'Klick: „und" — dann müssen alle zutreffen'}
      aria-label={`Verknüpfung „${wort}" — Klick schaltet auf „${und ? 'oder' : 'und'}"`}
      // GROSS geschrieben (v6.64): die zugeklappte Zeile über dem Bereich sagt
      // längst „TIB gefüllt UND BIB gefüllt" — dieselbe Verknüpfung soll hier
      // nicht kleiner aussehen. Das stille Wort (ohne `onSchalte`) bleibt klein:
      // so trennt die Schreibweise Schalter von Text.
      className="shrink-0 cursor-pointer select-none rounded-full px-2.5 py-[1px] text-[11px] font-medium leading-[16px]
        bg-[var(--tf-primary-light)] text-[var(--tf-primary)] hover:brightness-95
        focus-visible:outline-2 focus-visible:outline-[var(--tf-primary)] focus-visible:outline-offset-1"
      style={{ border: '0.5px solid var(--tf-border-hover)' }}
    >
      {wort.toUpperCase()}
    </button>
  ) : (
    <span className="shrink-0 px-1.5 text-[11px] font-medium text-[var(--tf-text-secondary)]">{wort}</span>
  );
  if (!linie) return <span className="flex shrink-0 items-center self-center">{pille}</span>;
  return (
    <div className="flex items-center gap-2 px-3 py-0.5">
      <span className="h-px flex-1 bg-[var(--tf-border)]" />
      {pille}
      <span className="h-px flex-1 bg-[var(--tf-border)]" />
    </div>
  );
}

/**
 * Die Einfüge-Marke zwischen zwei Bedingungen einer Karte.
 *
 * Zeilen selbst sind **kein** „hier hinein"-Ziel: „auf die Zeile" wäre zwischen
 * „davor" und „hinein" nicht zu unterscheiden, und die Regel bekäme beim
 * Loslassen eine andere Bedeutung, als die Geste zeigte. Blattzeilen melden
 * stattdessen ihre nähere **Kante** (obere Hälfte = davor), in eine Gruppe
 * hinein führt deren Karte.
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
      className="h-[10px] -my-[4px] flex items-center px-2"
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
