/**
 * Sichtbarkeits-Marken — die vierte Achse neben Feature-Flag (Bauzeit),
 * Modul-Schloss (Passwort) und `kuratorOnly` (Rolle).
 *
 * Die drei bestehenden beantworten „darf ich das?". Diese beantwortet
 * „will ich das sehen?" — sie schützt nichts, sie räumt auf.
 *
 * **Zwei unabhängige Marken, keine Stufe.** Eine einzige Stufe würfe „neue
 * Listenansicht für alle" und „neuer Regel-Editor für Profis" in denselben
 * Topf: wer Beta einschaltet, um Neues zu probieren, bekäme das Tiefenwerkzeug
 * gleich mit. Getrennt sind es zwei Aussagen:
 *
 * |              | Zielgruppe: alle | Zielgruppe: Experten |
 * |--------------|------------------|----------------------|
 * | stabil       | Standard         | `experte`            |
 * | in Erprobung | `beta`           | `beta` + `experte`   |
 *
 * Verknüpft wird mit UND: beide Marken sind Einschränkungen, also muss jede
 * durch ihren Schalter gedeckt sein.
 */

/** Reife (`beta`) und Zielgruppe (`experte`) — je eine Achse. */
export type Marke = 'beta' | 'experte';

/** Was ein Element einschränkt. Leeres Objekt = Standard (immer sichtbar). */
export interface Marken {
  beta?: true;
  experte?: true;
}

/** Stand der beiden Profil-Schalter. Beide fehlend/false = aus. */
export interface Schalter {
  beta: boolean;
  experte: boolean;
}

/**
 * Was markiert werden kann. `widget` steht neben `abschnitt`, obwohl ein
 * Startseiten-Widget auch „ein Abschnitt von Home" wäre: die Widgets haben
 * einen eigenen Katalog, eine eigene Verwaltung und eine persönliche
 * Anordnung — in der Kurator-GUI gehören sie deshalb in eine eigene Gruppe.
 */
export type ElementArt = 'seite' | 'reiter' | 'abschnitt' | 'widget';

export interface KatalogEintrag {
  /**
   * Stabile Id, `<art>:<pfad>`:
   * `seite:antraege` · `reiter:antraege/fristen` ·
   * `abschnitt:einstellungen/sec-provider` · `widget:kanban`
   *
   * Sie ist ein Vertrag: die Kurator-Sidecar referenziert sie, und ein
   * Umbenennen verliert die Kuration dieses Eintrags (der Sidecar-Leser
   * behält unbekannte Ids, wertet sie aber nicht aus).
   */
  id: string;
  art: ElementArt;
  /** Wie es auf dem Bildschirm heißt — die Kurator-GUI zeigt genau das. */
  label: string;
  /** Plugin-Id des Wirts. Gruppiert die Kurator-GUI; bei Seiten = die Seite selbst. */
  seite: string;
  marken: Marken;
  /**
   * Nie markierbar — weder im Seed noch über die Sidecar. Betrifft die
   * Elemente, über die man die Schalter, den Kurator-Zugang und die
   * Modul-Freischaltung überhaupt erst erreicht: eine Marke darauf sperrte den
   * Weg zurück aus, ohne dass es einen zweiten gäbe.
   */
  unantastbar?: true;
}

/** Was die Kurator-Sidecar je abweichendem Eintrag führt: der VOLLE Marken-Satz. */
export type MarkenListe = Marke[];

export const ID_TRENNER = ':';

export function seiteId(pluginId: string): string {
  return `seite${ID_TRENNER}${pluginId}`;
}

export function reiterId(pluginId: string, reiter: string): string {
  return `reiter${ID_TRENNER}${pluginId}/${reiter}`;
}

export function abschnittId(pluginId: string, abschnitt: string): string {
  return `abschnitt${ID_TRENNER}${pluginId}/${abschnitt}`;
}

export function widgetId(typ: string): string {
  return `widget${ID_TRENNER}${typ}`;
}
