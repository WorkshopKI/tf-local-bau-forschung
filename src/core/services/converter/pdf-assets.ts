/**
 * Erkennt, dass ein PDF ein Bild- oder Schriftformat enthält, das die App nicht
 * lesen kann.
 *
 * **Warum das nicht einfach ein `try/catch` ist.** pdf.js lädt für CJK-CMaps,
 * Standardschriften und JBIG2/JPX-Bilder Zusatzdateien nach. Wir liefern sie
 * nicht mit — sie sind groß, und der Single-File-Build unter `file://` kann sie
 * ohnehin nicht per URL holen. Die Bibliothek wirft dafür einen
 * deterministischen Fehler („Ensure that the `cMapUrl` … are provided."), aber
 * **beide Aufrufer laufen mit `ignoreErrors: true`** (weil `stopAtErrors` nicht
 * gesetzt ist). Der Evaluator macht daraus intern ein `warn(...)`, und
 * `getTextContent()` liefert brav ein Ergebnis — nur eben ohne den betroffenen
 * Text. Der reale Fehlerfall ist also **stiller Textverlust**, kein Wurf.
 *
 * `stopAtErrors: true` wäre die naheliegende Antwort und ist die falsche: eine
 * einzige kaputte Schrift ließe damit die Extraktion des ganzen Dokuments
 * abbrechen — für alle guten PDFs eine Verschlechterung.
 *
 * Deshalb zwei Griffe, beide hier:
 * 1. {@link istFehlendesPdfAsset} für den Fall, dass der Fehler doch bis zum
 *    Aufrufer durchschlägt (Vorbild: `isWorkerRaceError` in `pdf-extract.ts`).
 * 2. {@link sammlePdfWarnungen} klammert den Konvertierungslauf ein und fischt
 *    die Meldungen aus `console.warn` — den einzigen Kanal, den pdf.js dafür
 *    anbietet (`warn()` schreibt dorthin, einen Callback gibt es nicht).
 *
 * Rein bis auf die Konsolen-Klammer; keine Libs, node-testbar.
 */

/**
 * Die Signatur, mit der pdf.js eine fehlende **Zeichentabelle** meldet.
 *
 * **Nur `cMapUrl` — an echten Dokumenten gemessen.** Die erste Fassung fing
 * auch `standardFontDataUrl` und `wasmUrl`; ein Testlauf gegen drei echte
 * Förder-PDFs zeigte sofort, warum das falsch ist: `GMN9PQ01.pdf` extrahiert
 * 1 498 Zeichen völlig korrekt und warnt trotzdem über die Standardschrift.
 * Die Erklärung liegt in der Aufgabenteilung von pdf.js:
 *
 * - `standardFontDataUrl` liefert die **Glyphen** der 14 Standardschriften. Sie
 *   werden zum ZEICHNEN gebraucht; die Zeichen selbst stehen im Content-Stream
 *   und kommen bei `getTextContent()` unabhängig davon an. Nicht eingebettete
 *   Standardschriften sind der Normalfall — diese Signatur hätte bei fast jedem
 *   PDF Fehlalarm ausgelöst.
 * - `wasmUrl` betrifft die JBIG2-/JPX-**Bilddekodierung**. Bilder tragen ohnehin
 *   keinen extrahierbaren Text, und pdf.js fällt dort auf einen JS-Decoder
 *   zurück.
 * - `cMapUrl` dagegen liefert die **Zeichentabelle** für CJK-Codierungen. Ohne
 *   sie kann pdf.js die Bytes nicht auf Unicode abbilden — der Text fehlt
 *   wirklich.
 *
 * Die englische Originalzeichenkette, weil sie stabil über Minor-Versionen ist
 * und so in `pdf.mjs` steht; eine lose Suche nach „cMap" finge Info-Zeilen mit.
 */
const ASSET_SIGNATUREN: readonly string[] = [
  'Ensure that the `cMapUrl`',
];

/** Trägt dieser Text die CMap-Signatur? */
function nenntFehlendeCMap(text: string): boolean {
  return ASSET_SIGNATUREN.some(sig => text.includes(sig));
}

/**
 * Ist dieser Fehler eine fehlende CMap?
 *
 * Nimmt `unknown`, weil er aus einem `catch` kommt — und liest nur die Message,
 * nie den Stack: der trägt Bundler-Pfade, die sich mit jedem Build ändern.
 */
export function istFehlendesPdfAsset(err: unknown): boolean {
  const nachricht = err instanceof Error ? err.message : String(err ?? '');
  return nenntFehlendeCMap(nachricht);
}

/**
 * Der Satz, den der Bearbeiter lesen soll. Eine Handlungsanweisung, keine
 * Fehlermeldung — die Datei ist nicht kaputt, wir können sie nur nicht lesen.
 */
export const PDF_ASSET_MELDUNG =
  'Dieses PDF benutzt eine Zeichentabelle, die die App nicht lesen kann (typisch '
  + 'bei ostasiatischen Schriften). Der Text fehlt deshalb ganz oder teilweise — '
  + 'es ist KEIN gescanntes Dokument, OCR hilft hier nicht. Bitte die Datei '
  + 'außerhalb der App öffnen und als DOCX oder als PDF mit eingebetteten '
  + 'Schriften erneut hochladen.';

/**
 * Führt `lauf` aus und meldet, ob pdf.js dabei ein fehlendes Asset gewarnt hat.
 *
 * **Klammert `console.warn` ein.** Das ist ein Eingriff, und er ist eng
 * begrenzt: nur um diesen einen Aufruf, jede Zeile wird unverändert
 * weitergereicht, und im `finally` steht der Originalwert wieder da — auch wenn
 * `lauf` wirft. pdf.js bietet keinen Warnungs-Callback; `setVerbosityLevel`
 * schaltet nur stumm, und stumm ist das Gegenteil von dem, was wir wollen.
 */
export async function sammlePdfWarnungen<T>(
  lauf: () => Promise<T>,
): Promise<{ ergebnis: T; cmapFehlt: boolean }> {
  const original = console.warn;
  let cmapFehlt = false;
  console.warn = (...args: unknown[]): void => {
    if (!cmapFehlt && nenntFehlendeCMap(args.map(a => String(a)).join(' '))) {
      cmapFehlt = true;
    }
    original(...args);
  };
  try {
    return { ergebnis: await lauf(), cmapFehlt };
  } finally {
    console.warn = original;
  }
}
