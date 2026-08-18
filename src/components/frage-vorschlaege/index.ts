/**
 * Vorschlagsliste für ein Suchfeld im Frage-Modus — Mechanik geteilt, Katalog
 * je Seite ([abschnitte.ts](./abschnitte.ts)).
 *
 * Zwei Seiten benutzen sie: die Förderantrags-Liste
 * ([antrags-frage.md](docs/architecture/antrags-frage.md)) und die
 * Dokumenten-Suche ([suche-relevanz.md §8](docs/architecture/suche-relevanz.md)).
 * Beide bringen ihren eigenen `FrageKatalog` mit — vorgeschlagen wird nur, was
 * die Maschine dahinter auch ausführen kann.
 */
export {
  baueFrageAbschnitte, ersteLuecke, flacheListe, hatLuecke, luecke,
  LUECKE_AUF, LUECKE_ZU,
  type FrageAbschnitt, type FrageKatalog, type FrageVorschlag, type FrageVorschlagArt,
} from './abschnitte';
export {
  useFrageVorschlaege, LUECKEN_HINWEIS,
  type FrageVorschlaegeOptionen, type FrageVorschlaegeSteuerung, type SuchFeldElement,
} from './useFrageVorschlaege';
export { FrageVorschlaege } from './FrageVorschlaege';
