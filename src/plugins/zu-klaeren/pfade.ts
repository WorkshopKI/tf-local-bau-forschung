/**
 * Wo die Antworten einer Klärung liegen — und warum je Autor eine eigene Datei.
 *
 * **Eine Datei je Person, nicht eine je Klärung.** `appendToFile` ist
 * read-modify-write: ganze Datei lesen, anhängen, ganze Datei schreiben. Auf einer
 * gemeinsamen Datei überschreibt bei zwei gleichzeitigen Antworten der zweite
 * Write den ersten — die Zeile ist weg, `haengeAnSidecar` meldet trotzdem `true`,
 * und der Verlierer sieht seine Antwort weiter auf seinem Bildschirm. Über SMB ist
 * dieses Fenster zehner- bis hunderter Millisekunden breit; in einer Sitzung, in
 * der mehrere Leute gleichzeitig Zeilen anklicken, trifft das mehrfach. Für ein
 * Werkzeug, dessen einzige Aufgabe das Einsammeln fremder Antworten ist, ist das
 * der Fehler, der das Vertrauen kostet.
 *
 * Mit einer Datei je Autor schreiben zwei Personen nie dieselbe Datei — das Rennen
 * verschwindet konstruktiv statt per Abmilderung. Nachlesen-und-Wiederholen wäre
 * echt schlechter: ein zweiter Voll-Read je Antwort, und das Fenster wird kleiner,
 * ohne je zu schließen. Der Faltungsschlüssel ist ohnehin (Autor, Punkt), die
 * Aufteilung berührt die Auswertung also gar nicht.
 *
 * Das Journal (`_intern/vorgangssystem/journal/`) kommt mit einer Datei aus, weil
 * es genau einen Schreiber hat: den Nachtlauf.
 *
 * Rein: keine IO.
 */

/**
 * Wurzel aller Klärungs-Ablagen. Steht **nur hier** — ein Pfad an zwei Stellen
 * driftet beim ersten Umbenennen auseinander, und die zweite Stelle schriebe dann
 * leise ins Nirgendwo (Guard `jeder Sidecar-Pfad steht genau einmal im Code`).
 */
export const KLAERUNG_DIR = '_intern/klaerung';

/** Das Verzeichnis einer Klärung; darin liegt je Autor eine JSONL-Datei. */
export function klaerungDir(klaerungId: string): string {
  return `${KLAERUNG_DIR}/${klaerungId}`;
}

/**
 * Der Dateiname eines Autors — abgeleitet aus seinem **Namen** (`UserProfile.name`),
 * nicht aus einem Bearbeiter-Kürzel: „Thomas Hübsch" → `THOMAS_HUEBSCH.jsonl`.
 *
 * Umlaute werden transliteriert (Hübsch → HUEBSCH), bevor der Rest auf `[A-Z0-9]`
 * reduziert wird. Ein bloßes Ersetzen aller Nicht-ASCII-Zeichen durch `_` ließe
 * `Hübsch` und `Hu-bsch` auf denselben Namen fallen — zwei Personen teilten sich
 * dann eine Datei und hätten genau das Schreib-Rennen zurück, das die Aufteilung
 * beseitigt. Vorher NFC (Pitfall #22), sonst zerfällt `ü` in u + Kombizeichen und
 * die Transliteration greift nicht.
 */
export function autorDateiName(autor: string): string {
  const gross = autor.normalize('NFC').trim().toUpperCase();
  const lesbar = gross
    .replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS');
  return `${lesbar.replace(/[^A-Z0-9]/g, '_')}.jsonl`;
}

/** Der volle Share-Pfad der Antwortdatei eines Autors. */
export function klaerungAutorPfad(klaerungId: string, autor: string): string {
  return `${klaerungDir(klaerungId)}/${autorDateiName(autor)}`;
}
