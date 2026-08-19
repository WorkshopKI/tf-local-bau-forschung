/**
 * Beta-Funktionen & Expertenmodus — zwei unabhängige Achsen, die entscheiden,
 * ob ein Element in der Oberfläche auftaucht.
 *
 * Abgrenzung zu den drei bestehenden Mechanismen: Feature-Flag, Modul-Schloss
 * und `kuratorOnly` beantworten „darf ich das?" — diese Achsen beantworten
 * „will ich das sehen?". Sie schützen nichts; eine verborgene Route bleibt
 * über ihren Deep-Link erreichbar (wie bei `hideFromNav`).
 *
 * Doku: `docs/architecture/sichtbarkeitsstufen.md`.
 */
export type {
  ElementArt, KatalogEintrag, Marke, Marken, MarkenListe, Schalter,
} from './types';
export { abschnittId, reiterId, seiteId, widgetId } from './types';

export {
  OHNE_MARKE, baueIndex, bilanziere, effektiveMarken, ersterSichtbarerReiter,
  filtereReiter, istMarkiert, istSichtbar, markenAusListe, markenGleich,
  markenZuListe, zaehleZugewinn,
} from './regel';
export type { MarkenBilanz } from './regel';

export { SICHTBARKEITS_KATALOG } from './katalog';

export { SICHTBARKEIT_SIDECAR_PATH, SICHTBARKEIT_IDB_KEY } from './sidecar';
export type { SichtbarkeitSidecar } from './sidecar';

export { useSichtbarkeitStore } from './store';
export type { SichtbarkeitState } from './store';
