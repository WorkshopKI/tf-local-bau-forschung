/**
 * Pausierte Teile der Antrag-Aufbereitung — die EINZIGE Stelle, an der eine Pause
 * später zurückgenommen wird.
 *
 * Alles hier ist ein reines ANZEIGE-/ZUGANGS-Gate: Prompts, Parser, Kategorien-Katalog,
 * die reinen Prüffunktionen sowie der komplette Fragen- und Abdeckungs-Code bleiben
 * unangetastet. Dadurch bleiben bestehende Baustein-Caches gültig, es entfällt jede
 * Migration, und bereits gesetzte `offenePunkte` (Befunde, Aspekt-Kandidaten) überleben
 * im Store — sie sind nur unsichtbar und leben beim Zurücknehmen wieder auf.
 *
 * Zurücknehmen = Konstante umlegen; mitzuziehen sind dann die Invarianten im Docblock
 * von `tab-gating.ts`, die Pause-Tests (`__tests__/tab-gating.test.ts`,
 * `__tests__/pausierte-module.test.ts`) sowie `docs/architecture/antrag-aufbereitung.md`
 * und `docs/feedback-kontext/antraege.md`.
 *
 * Bewusst IMPORT-FREI: die Datei wird u. a. von der reinen `tab-gating.ts` gelesen; ein
 * Import von `zahlen.ts` zöge deren Transport-/IDB-Kette dorthin (Zyklus-Risiko). Die
 * Kopplung der IDs an `ZAHL_KATEGORIEN` prüft stattdessen der Test.
 *
 * Die **Zeitplan-Pause ist mit v6.29 aufgehoben** (Messung am Bestand: die
 * Arbeitspaket-Ernte trägt, seit der Konverter den PDF-Tag-Baum liest, v6.28) — der Tab,
 * der „Zeitplan öffnen"-Einstieg und die Zahlen-Quervergleiche sind wieder offen. Ein
 * Antrag ohne lesbaren Arbeitsplan bekommt den Leerzustand des Tabs, keine Sperre.
 */

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
 * (`zeit`/`personal`/`kosten`/`sonstig`) liefern sehr viele nicht prüfrelevante Zahlen
 * und erscheinen im Zahlen-Tab nur noch als ausgegraute, zugeklappte Gruppe — der Zähler
 * bleibt sichtbar, die Claims bleiben aufklappbar. Eigene Entscheidung, unabhängig von
 * der (aufgehobenen) Zeitplan-Pause: hier geht es um Rauschen, nicht um Lesbarkeit.
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
