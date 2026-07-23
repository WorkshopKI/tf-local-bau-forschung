/**
 * Pausierte Teile der Antrag-Aufbereitung — die EINZIGE Stelle, an der eine Pause
 * später zurückgenommen wird.
 *
 * Alles hier ist ein reines ANZEIGE-/ZUGANGS-Gate: Prompts, Parser, Kategorien-Katalog,
 * die reinen Prüffunktionen sowie der komplette Zeitplan-, Fragen- und Abdeckungs-Code
 * bleiben unangetastet. Dadurch bleiben bestehende Baustein-Caches gültig, es entfällt
 * jede Migration, und bereits gesetzte `offenePunkte` (Zahlen-Widersprüche, Befunde,
 * Aspekt-Kandidaten) überleben im Store — sie sind nur unsichtbar und leben beim
 * Zurücknehmen wieder auf.
 *
 * Zurücknehmen = Konstante umlegen; mitzuziehen sind dann die Invarianten im Docblock
 * von `tab-gating.ts`, die Pause-Tests (`__tests__/tab-gating.test.ts`,
 * `__tests__/pausierte-module.test.ts`) sowie `docs/architecture/antrag-aufbereitung.md`
 * und `docs/feedback-kontext/antraege.md`.
 *
 * Bewusst IMPORT-FREI: die Datei wird u. a. von der reinen `tab-gating.ts` gelesen; ein
 * Import von `zahlen.ts` zöge deren Transport-/IDB-Kette dorthin (Zyklus-Risiko). Die
 * Kopplung der IDs an `ZAHL_KATEGORIEN` prüft stattdessen der Test. Aus demselben Grund
 * ERMITTELT `zeitplanVerfuegbar` nichts selbst, sondern nimmt das Ergebnis als Boolean.
 */

/**
 * Zeitplan-Modul pausiert: die Arbeitspaket-Erkennung aus den PDF-Quellen ist zu
 * unzuverlässig. Kommt zurück, sobald der Antrag als JSON vorliegt und die
 * Arbeitspakete strukturiert eingelesen werden können.
 *
 * Sperrt den Zeitplan-Tab (`deriveTabZustaende`), den „Zeitplan öffnen"-Einstieg der
 * Übersicht (`UebersichtTab`) und — weil sie alle aus der PDF-Zeitplan-Ernte stammen —
 * jeden Zeitplan-abhängigen Befund: die Zahlen-Widersprüche (`pruefeZahlWidersprueche` in
 * `ZahlenTab` + `fragen.ts`) und die `run.befunde` (Text↔Anlage-5 + Kapazität) an allen
 * sichtbaren Stellen (`fragen.ts` Aspekt H, `AbdeckungTab` — via `sichtbareZeitplanBefunde`).
 *
 * Explizit als `boolean` typisiert (nicht als Literal `true`): sonst narrowt TS die
 * `false`-Zweige der Konsumenten zu totem Code und das Zurücknehmen zieht Folgefehler nach.
 */
export const ZEITPLAN_PAUSIERT: boolean = true;

/** Grund der Zeitplan-Pause (Tab-Tooltip + Übersichts-Hinweis). */
export const ZEITPLAN_PAUSE_HINWEIS =
  'Zeitplan-Modul pausiert — die Arbeitspakete lassen sich aus den PDF-Quellen nicht verlässlich lesen. Kommt zurück, sobald der Antrag als JSON vorliegt.';

/**
 * Gesperrt ist die PDF-Ernte, nicht der Zeitplan als solcher: liegt zum Vorgang eine
 * **Einreichungs-JSON** vor (MAP-Einreichung, derselben Vorhabensbeschreibung
 * zugeordnet), stammen die Arbeitspakete aus strukturierten Feldern statt aus einer
 * zerfallenen PDF-Tabelle — dann ist der Tab wieder ehrlich benutzbar und zeigt
 * ausschliesslich die JSON-Zeilen (`map-verknuepfung.ts`).
 *
 * Nimmt das Ergebnis als Boolean entgegen, statt es selbst zu ermitteln: die Datei
 * bleibt import-frei (s. Docblock oben).
 */
export function zeitplanVerfuegbar(hatEinreichungsJson: boolean): boolean {
  return !ZEITPLAN_PAUSIERT || hatEinreichungsJson;
}

/**
 * Fragen-Modul pausiert: die automatische Fragen-Ableitung mischt zu viele nicht
 * prüfrelevante Punkte unter die echten Lücken. Sperrt den Fragen-Tab; `fragen.ts`,
 * die Aspekt-Kandidaten und die gesetzten `offenePunkte` bleiben unberührt.
 *
 * Explizit als `boolean` typisiert (nicht als Literal `true`) — sonst narrowt TS die
 * `false`-Zweige der Konsumenten zu totem Code und das Zurücknehmen zieht Folgefehler nach.
 */
export const FRAGEN_PAUSIERT: boolean = true;

/** Grund der Fragen-Pause (Tab-Tooltip + Übersichts-Hinweis). */
export const FRAGEN_PAUSE_HINWEIS =
  'Fragen-Modul pausiert — die automatische Fragen-Ableitung ist noch nicht verlässlich genug. Umsetzung folgt.';

/**
 * Abdeckungs-Modul pausiert: die Zuordnung Sektion↔Prüfaspekt trägt noch nicht.
 * Sperrt den Abdeckungs-Tab und den „Tab öffnen"-Einstieg des Aspekte-Schritts im
 * Übersichts-Stepper. Der `aspekte`-Baustein LÄUFT bewusst weiter (er füttert Caches
 * und den Steckbrief-Kontext) — Un-Pausieren ist dadurch eine reine Anzeige-Änderung.
 */
export const ABDECKUNG_PAUSIERT: boolean = true;

/** Grund der Abdeckungs-Pause (Tab-Tooltip + Übersichts-Hinweis). */
export const ABDECKUNG_PAUSE_HINWEIS =
  'Abdeckungs-Modul pausiert — die Aspekt-Abdeckung ist noch nicht verlässlich genug. Umsetzung folgt.';

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

/**
 * Die deterministischen Zeitplan-/Kapazitäts-Befunde (`run.befunde`) stammen alle aus der
 * PDF-Zeitplan-Ernte (Text↔Anlage-5-Abgleich, Kapazität) und schweigen daher an JEDER
 * sichtbaren Stelle (Fragen-Tab Aspekt H, Abdeckungs-Widersprüche + übernommene Punkte),
 * solange `ZEITPLAN_PAUSIERT` gilt. Generisch, damit diese Datei import-frei bleibt; die
 * Daten selbst bleiben unberührt (`run.befunde` trägt weiter alle Keys → `offenePunkte`
 * überleben, `store.ts` unverändert). Un-Pausieren macht alle drei Stellen automatisch
 * wieder sichtbar.
 */
export function sichtbareZeitplanBefunde<T>(befunde: readonly T[]): readonly T[] {
  return ZEITPLAN_PAUSIERT ? [] : befunde;
}
