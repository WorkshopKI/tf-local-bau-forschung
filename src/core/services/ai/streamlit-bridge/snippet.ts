/**
 * AitisiGPT-Bridge-Bookmarklet als String (Single Source of Truth:
 * bridge-snippet.source.js — eigener Basename, damit `import '.../snippet'`
 * eindeutig diese .ts trifft, nicht die .js).
 *
 * `?raw` inlined den Quelltext zur BUILD-Zeit in das Bundle — kein Runtime-
 * `fetch`, läuft damit unter `file://` (Pitfall #1/#2). Aus `BRIDGE_SNIPPET`
 * baut die Verbindungs-Gruppe das `javascript:`-Bookmarklet.
 */
import snippet from './bridge-snippet.source.js?raw';

export const BRIDGE_SNIPPET: string = snippet;

/** Fertiges `javascript:`-Bookmarklet (URL-encodiert) zum Ziehen/Kopieren. */
export const BRIDGE_BOOKMARKLET: string = 'javascript:' + encodeURIComponent(BRIDGE_SNIPPET);

/**
 * Die Revision, die DIESER Build ausliefert — aus dem Snippet gelesen, nicht
 * danebengeschrieben. Eine zweite Konstante hier wäre eine zweite Wahrheit, und
 * sie würde beim nächsten Bump vergessen.
 *
 * Leerer String, falls der Marker nicht gefunden wird; die Veraltet-Prüfung
 * schweigt dann (sie darf nie aufgrund eines eigenen Lesefehlers warnen).
 */
export const BRIDGE_REV: string = /var BRIDGE_REV = '([^']+)'/.exec(snippet)?.[1] ?? '';

/**
 * Läuft im KI-Tab ein Bookmarklet, das nicht zu diesem Build gehört?
 *
 * `gemeldet === null` heißt „noch kein Handschlag" — dann wird nicht gewarnt,
 * denn wir wissen schlicht nichts. Ein leerer String dagegen ist eine Aussage:
 * das Bookmarklet hat geantwortet, ohne eine Revision zu nennen, und das können
 * nur Fassungen von vor dem AitisiGPT-Umbau.
 *
 * Warum das überhaupt gemeldet werden muss: bis zum Umbau war ein altes Snippet
 * harmlos — es ignorierte unbekannte Felder und lief sonst weiter. Jetzt trägt
 * das Feld die Modellwahl. Ein Snippet, das sie ignoriert, antwortet aus einem
 * anderen Modell mit einem anderen Kontextfenster, als die App annimmt — und
 * zwar ohne jedes Anzeichen.
 */
export function istBookmarkletVeraltet(gemeldet: string | null): boolean {
  if (gemeldet === null) return false;   // nie gesehen → nichts behaupten
  if (!BRIDGE_REV) return false;         // eigener Marker unlesbar → nicht warnen
  return gemeldet !== BRIDGE_REV;
}
