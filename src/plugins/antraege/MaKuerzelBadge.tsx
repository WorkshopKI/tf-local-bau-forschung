import type { ReactElement } from 'react';

interface Props {
  /** Roh-Kürzel des Antrags (TIB/BIB/ZTP/PFM; im pl/dev-Build Klartext). */
  kuerzel?: string | null;
  /** Optionaler Tooltip-Text; Default „Bearbeiter: <kürzel>". */
  title?: string;
}

/**
 * Kompaktes Mono-Pill für ein Zuständigkeits-Kürzel. Wird in den
 * Förderanträge-Ansichten (Liste/Tabelle/Kacheln) und auf der Home-Seite
 * angezeigt, sobald der „alle"-/Übersichtsmodus aktiv ist — damit sichtbar ist,
 * welcher MA einen Antrag bearbeitet. Rendert `null` bei leerem Kürzel.
 *
 * Kein anonId-Mapping nötig: die KUERZ-Spalten führen bereits das echte Kürzel;
 * die Anzeige läuft nur in pl/dev (Auslastungs-Modul + `deAnonymisierung`).
 *
 * **Keine Versalien**: Kürzel sind echte Bezeichner mit gemischter Schreibweise
 * („THü", „StE", „AAt"). Ein `uppercase` verfälscht sie — dieselbe Falle wie bei
 * den Abschnitts-Bändern der Tabelle (v3.2.2).
 */
export function MaKuerzelBadge({ kuerzel, title }: Props): ReactElement | null {
  const k = typeof kuerzel === 'string' ? kuerzel.trim() : '';
  if (!k) return null;
  return (
    <span
      title={title ?? `Bearbeiter: ${k}`}
      className="shrink-0 inline-flex items-center font-mono text-[10.5px] font-medium tracking-wide px-1.5 py-0.5 rounded-md"
      style={{ background: 'var(--tf-bg-secondary)', color: 'var(--tf-text-secondary)' }}
    >
      {k}
    </span>
  );
}
