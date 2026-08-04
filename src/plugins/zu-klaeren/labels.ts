/**
 * Beschriftungen und Klassenkonstanten der Klärungs-Seite.
 *
 * Die Tabellen-Klassen sind bewusst identisch zu Katalog-Tab und Vorgangs-Board —
 * dieselbe Zeilenhöhe, dieselben Token. Eine dritte Tabellen-Optik im selben
 * Subsystem wäre keine Gestaltung, sondern Drift.
 *
 * Rein darstellend.
 */
import { ZAH_PHASE_LABEL } from '@/core/status';
import { OHNE_PHASE, type Urteil, type ZielWert } from './typen';

export const thKlasse =
  'text-left font-medium text-[11px] text-[var(--tf-text-tertiary)] px-2 py-1.5 whitespace-nowrap';
export const tdKlasse = 'px-2 py-1.5 align-middle text-[12px]';

/** Der einzige zugelassene Inline-Stil (wie in `status-cockpit/labels.ts`). */
export const rahmenStil = { border: '0.5px solid var(--tf-border)' } as const;

/** Die drei Antwort-Knöpfe. `zurueckgezogen` ist kein Knopf, sondern eine Folge. */
export const URTEIL_LABEL: Record<Urteil, string> = {
  passt: 'passt',
  andere: 'gehört nach …',
  unklar: 'unklar',
  zurueckgezogen: 'zurückgezogen',
};

export const URTEIL_WAHL: readonly Urteil[] = ['passt', 'andere', 'unklar'];

/** Beschriftung eines Zielwerts — inklusive der ausdrücklichen Nicht-Phase. */
export function zielLabel(ziel: ZielWert | null | undefined): string {
  if (ziel === undefined || ziel === null) return '—';
  return ziel === OHNE_PHASE ? 'ohne Phase' : ZAH_PHASE_LABEL[ziel];
}

/** Uhrzeit-genaue Stand-Anzeige; der Kalendertag steht daneben im Kopf. */
export function standZeit(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Datum eines Beitrags, deutsch und mit führender Null. */
export function beitragDatum(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const tag = String(d.getDate()).padStart(2, '0');
  const monat = String(d.getMonth() + 1).padStart(2, '0');
  return `${tag}.${monat}.${d.getFullYear()} ${standZeit(iso)}`;
}
