import type { ReactElement } from 'react';

interface Props {
  /** Roh-`tib_kuerz` des Antrags (im pl/dev-Build Klartext-Kürzel). */
  kuerzel?: string | null;
  /** Optionaler Tooltip-Text; Default „Bearbeiter: <kürzel>". */
  title?: string;
}

/**
 * Kompaktes Mono-Pill für das TIB-Bearbeiter-Kürzel. Wird in den
 * Förderanträge-Ansichten (Liste/Tabelle/Kacheln) und auf der Home-Seite
 * angezeigt, sobald der „alle"-/Übersichtsmodus aktiv ist — damit sichtbar ist,
 * welcher MA einen Antrag bearbeitet. Rendert `null` bei leerem Kürzel.
 *
 * Kein anonId-Mapping nötig: `tib_kuerz` ist bereits das echte Kürzel; die
 * Anzeige läuft nur in pl/dev (Auslastungs-Modul + `deAnonymisierung`).
 */
export function MaKuerzelBadge({ kuerzel, title }: Props): ReactElement | null {
  const k = typeof kuerzel === 'string' ? kuerzel.trim() : '';
  if (!k) return null;
  return (
    <span
      title={title ?? `Bearbeiter: ${k}`}
      className="shrink-0 inline-flex items-center font-mono text-[10.5px] font-medium tracking-wide px-1.5 py-0.5 rounded-md uppercase"
      style={{ background: 'var(--tf-bg-secondary)', color: 'var(--tf-text-secondary)' }}
    >
      {k}
    </span>
  );
}
