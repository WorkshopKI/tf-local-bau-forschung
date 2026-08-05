/**
 * Beschriftungen und Klassenkonstanten der Klärungs-Seite.
 *
 * Die Tabellen-Klassen folgen Katalog-Tab und Vorgangs-Board (gleiche Token,
 * gleiche Schriftgrößen) mit **einer** bewussten Abweichung: das Zeilenpolster ist
 * um eine Stufe kleiner. Diese Tabelle wird im Fachtermin per Bildschirmfreigabe
 * durchgegangen — 30 Zeilen am Stück sind hier der Zweck, nicht ein Nebeneffekt.
 * Alles andere bleibt gleich; eine dritte Tabellen-Optik wäre Drift.
 *
 * Rein darstellend.
 */
import { SEED_ZAH_PHASEN, zahPhaseLabel } from '@/core/status';
import type { ZahPhase } from '@/core/status';
import { OHNE_PHASE, type Urteil, type ZielWert } from './typen';

export const thKlasse =
  'text-left font-medium text-[11px] text-[var(--tf-text-tertiary)] px-2 py-1.5 whitespace-nowrap';
export const tdKlasse = 'px-2 py-1 align-middle text-[12px]';

/** Der einzige zugelassene Inline-Stil (wie in `status-cockpit/labels.ts`). */
export const rahmenStil = { border: '0.5px solid var(--tf-border)' } as const;

/**
 * Die drei Antwort-Knöpfe. `zurueckgezogen` ist kein Knopf, sondern eine Folge.
 *
 * **Ein Wort je Knopf.** „gehört nach …" brach als einziges Label zweizeilig um und
 * bestimmte damit die Höhe JEDER der 30 Zeilen (46 px statt 28 px). Drei gleich
 * kurze Wörter wiegen zudem gleich schwer — was „andere" heißt, sagt der Tooltip
 * und danach das Zielfeld, das genau dafür erscheint.
 */
export const URTEIL_LABEL: Record<Urteil, string> = {
  passt: 'passt',
  andere: 'andere',
  unklar: 'unklar',
  zurueckgezogen: 'zurückgezogen',
};

/** Was der knappe Knopf meint — der Tooltip trägt den ganzen Satz. */
export const URTEIL_TITEL: Partial<Record<Urteil, string>> = {
  andere: 'gehört in eine andere Phase',
};

export const URTEIL_WAHL: readonly Urteil[] = ['passt', 'andere', 'unklar'];

/**
 * Beschriftung eines Zielwerts — inklusive der ausdrücklichen Nicht-Phase.
 *
 * Bewusst gegen die **Auslieferung** und nicht gegen den geltenden Schnitt:
 * diese Seite bespricht, ob der ausgelieferte Zuschnitt stimmt, und ihr Export
 * erzeugt einen Diff gegen genau diesen Seed. Zeigte sie die kuratierten
 * Beschriftungen, redeten Frage und Antwort über verschiedene Dinge.
 */
export function zielLabel(ziel: ZielWert | null | undefined): string {
  if (ziel === undefined || ziel === null) return '—';
  return ziel === OHNE_PHASE ? 'ohne Phase' : zahPhaseLabel(ziel, SEED_ZAH_PHASEN);
}

/**
 * Wie {@link zielLabel}, aber gegen die **Fassung** — für die Ist-Stand-Spalte.
 *
 * Die Ausnahme von der Regel darüber, und zwar aus demselben Grund: die Spalte
 * zeigt, was der Katalog HEUTE führt, also muss sie dessen Beschriftung tragen.
 * Gegen die Auslieferung gelabelt hieße ein selbst angelegter Verfahrensschritt
 * „Marker (ohne Phase)" — die Spalte behauptete dann, ein Code stehe neben dem
 * Verfahren, während er in Wahrheit im neuen Schritt liegt.
 */
export function fassungLabel(
  ziel: ZielWert, phasen: readonly ZahPhase[] | undefined,
): string {
  return ziel === OHNE_PHASE ? 'ohne Phase' : zahPhaseLabel(ziel, phasen);
}

/** Uhrzeit-genaue Stand-Anzeige; der Kalendertag steht daneben im Kopf. */
export function standZeit(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Kalendertag, deutsch und mit führender Null (`toLocaleDateString` lässt sie weg). */
export function kurzDatum(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const tag = String(d.getDate()).padStart(2, '0');
  const monat = String(d.getMonth() + 1).padStart(2, '0');
  return `${tag}.${monat}.${d.getFullYear()}`;
}

/** Datum eines Beitrags, deutsch und mit führender Null. */
export function beitragDatum(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${kurzDatum(iso)} ${standZeit(iso)}`;
}
