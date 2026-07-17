/**
 * Pausierte Teile der Antrag-Aufbereitung — die EINZIGE Stelle, an der die Pause
 * später zurückgenommen wird.
 *
 * Beides hier ist ein reines ANZEIGE-/ZUGANGS-Gate: Prompt (`buildZahlenPrompt`),
 * Parser (`normalisiereKategorie`), Kategorien-Katalog (`ZAHL_KATEGORIEN`), die reine
 * Prüffunktion (`pruefeZahlWidersprueche`) und der komplette Zeitplan-Code bleiben
 * unangetastet. Dadurch bleiben bestehende Baustein-Caches gültig, es entfällt jede
 * Migration, und bereits gesetzte `zahl-widerspruch:*`-`offenePunkte` überleben im
 * Store (sie sind nur unsichtbar und leben beim Zurücknehmen wieder auf).
 *
 * Zurücknehmen = Konstante umlegen; mitzuziehen sind dann die Invarianten im Docblock
 * von `tab-gating.ts`, die Pause-Tests (`__tests__/tab-gating.test.ts`,
 * `__tests__/pausierte-module.test.ts`) sowie `docs/architecture/antrag-aufbereitung.md`
 * und `docs/feedback-kontext/antraege.md`.
 *
 * Bewusst IMPORT-FREI: die Datei wird u. a. von der reinen `tab-gating.ts` gelesen; ein
 * Import von `zahlen.ts` zöge deren Transport-/IDB-Kette dorthin (Zyklus-Risiko). Die
 * Kopplung der IDs an `ZAHL_KATEGORIEN` prüft stattdessen der Test.
 */

/**
 * Zeitplan-Modul pausiert: die Arbeitspaket-Erkennung aus den PDF-Quellen ist zu
 * unzuverlässig. Kommt zurück, sobald der Antrag als JSON vorliegt und die
 * Arbeitspakete strukturiert eingelesen werden können.
 *
 * Sperrt den Zeitplan-Tab (`deriveTabZustaende`), den „Zeitplan öffnen"-Einstieg der
 * Übersicht (`UebersichtTab`) und — weil sie ausschließlich gegen den Zeitplan
 * vergleichen (Laufzeit-Horizont, Anlage-5-PM-Summe) und ohne ihn selbst unzuverlässig
 * wären — die Zahlen-Widersprüche in `ZahlenTab` + `fragen.ts`.
 *
 * Explizit als `boolean` typisiert (nicht als Literal `true`): sonst narrowt TS die
 * `false`-Zweige der Konsumenten zu totem Code und das Zurücknehmen zieht Folgefehler nach.
 */
export const ZEITPLAN_PAUSIERT: boolean = true;

/** Grund der Zeitplan-Pause (Tab-Tooltip + Übersichts-Hinweis). */
export const ZEITPLAN_PAUSE_HINWEIS =
  'Zeitplan-Modul pausiert — die Arbeitspakete lassen sich aus den PDF-Quellen nicht verlässlich lesen. Kommt zurück, sobald der Antrag als JSON vorliegt.';

/**
 * Derzeit prüfrelevante Zahlen-Kategorien. Die übrigen Kategorien des Katalogs
 * (`zeit`/`personal`/`kosten`/`sonstig`) liefern aus den PDF-Quellen sehr viele nicht
 * prüfrelevante Zahlen und erscheinen im Zahlen-Tab nur noch als ausgegraute,
 * zugeklappte Gruppe — der Zähler bleibt sichtbar, die Claims bleiben aufklappbar.
 *
 * IDs stammen aus `ZAHL_KATEGORIEN`; ein Tippfehler würde alle Gruppen sperren und wird
 * darum von `__tests__/pausierte-module.test.ts` gegen `ZAHL_KATEGORIE_IDS` geprüft.
 */
export const ZAHL_KATEGORIEN_PRUEFRELEVANT: ReadonlySet<string> = new Set(['leistung', 'markt']);

/** Grund der Kategorie-Sperre (Gruppen-Kopf + Tooltip im Zahlen-Tab). */
export const ZAHL_KATEGORIE_PAUSE_HINWEIS = 'derzeit nicht prüfrelevant';

/** True, wenn die Kategorie im Zahlen-Tab ausgegraut + zugeklappt dargestellt wird. */
export function istZahlKategorieGesperrt(kategorieId: string): boolean {
  return !ZAHL_KATEGORIEN_PRUEFRELEVANT.has(kategorieId);
}
