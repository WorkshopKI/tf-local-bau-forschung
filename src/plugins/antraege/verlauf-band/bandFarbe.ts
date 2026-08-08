/**
 * Die Farbe eines Statusabschnitts — **eine** Stelle, weil Bahn und Legende
 * dieselbe nennen müssen. Zwei Ableitungen wären zwei Wahrheiten, und die
 * Legende erklärte dann eine Bahn, die anders aussieht.
 *
 * Gefärbt wird nach {@link getStatusCategory}, nicht nach dem Rohstatus
 * (Pitfall #12): mehrere Rohstatus teilen sich eine Kategorie und damit einen
 * Farbton — die Farbe sagt „welche Art von Arbeit", der Text sagt „welcher
 * Status".
 */
import { getStatusCategory } from '@/core/utils/status-canonical';
import { KANBAN_LANE_ACCENT } from '@/plugins/home/widgets/kanbanLanes';

/**
 * Der **satte** Akzent — für kleine Marken: das Quadrat der Legende, der
 * Führungsstrich einer Unter-Beschriftung, der Streifen an einer Segmentgrenze.
 * Auf neun Pixeln trägt keine Tönung.
 */
export function segmentFarbe(roh: string | undefined): string {
  return KANBAN_LANE_ACCENT[getStatusCategory(roh ?? '')];
}

/** Anteil des Akzents in der Balkenfläche. Siehe {@link segmentFuellung}. */
const TOENUNG = '30%';

/**
 * Die **Fläche** des Balkens — der Akzent, auf den Seitengrund getönt.
 *
 * **Warum nicht der satte Ton mit weißer Schrift** (so war es bis v3.37): die
 * `--tf-kanban-*`-Tokens sind Lane-Akzente für kleine Farbchips, nicht für
 * Textuntergrund. Weiße 11-px-Schrift darauf erreicht gemessen **3,02–5,06:1**
 * im hellen Modus (sechs der neun Kategorien unter den 4,5:1, die AA für kleine
 * Schrift verlangt) und **2,14–2,92:1** im dunklen — dort sind die Tokens
 * Pastelltöne (Helligkeit 58–70 %), und *jede* Beschriftung fiel durch. Getönt
 * mit normaler Textfarbe sind es ≥ 12,6:1 hell und ≥ 5,7:1 dunkel. Der Guard
 * `band-fuellung-kontrast` hält das fest — wer hier „satter" will, muss ihn
 * schlagen, nicht überreden.
 *
 * **Was die Tönung kostet, und wo es zurückkommt:** getönt rücken die
 * Kategorien zusammen (`offen`/`in Prüfung` liegen satt 37 RGB-Einheiten
 * auseinander, getönt 11). Deshalb überlebt der satte Ton am **Grenzstreifen**
 * — der trennt die Abschnitte und nennt die Farbe des folgenden.
 *
 * `color-mix` statt vorgemischter Tokens ist Hausmuster (`theme.css`: „Tönungen
 * entstehen wie beim Feedback-Kanban per color-mix, dark-aware").
 */
export function segmentFuellung(roh: string | undefined): string {
  return `color-mix(in srgb, ${segmentFarbe(roh)} ${TOENUNG}, var(--tf-bg))`;
}
