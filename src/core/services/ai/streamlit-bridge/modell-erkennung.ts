/**
 * Modell-Zuordnung und Kontextfenster-Ablesung an der AitisiGPT-Oberfläche.
 *
 * Die Modellwahl der internen KI ist ein natives `<select name="model">`. Seine
 * `value` trägt den Dateinamen samt Quantisierung
 * (`Qwen3.6-35B-A3B-UD-Q4_K_M.gguf`) und wandert bei jedem Modell-Update; der
 * sichtbare Optionstext (`Qwen3.6-35B`) ist die stabilere Kennung. Wir prüfen
 * beide, Text zuerst.
 *
 * **Der VL-Ausschluss ist kein Detail.** `Qwen3-VL-30B (multimodal)` hat 62k —
 * dasselbe kleine Fenster wie gpt-oss. Eine tolerante `/qwen3/i`-Regel landete
 * damit genau in dem Fenster, dem der Auto-Wechsel entkommen soll, und die
 * Eskalation wäre wirkungslos, ohne dass es auffiele.
 *
 * Wie `tab-titel.ts` ist die Kern-Logik im Bookmarklet
 * `bridge-snippet.source.js` **gespiegelt** (zwischen den
 * `<modell-erkennung-core>`-Markern; `?raw`-Inlining → kein Import). Der
 * Drift-Test (`__tests__/modell-erkennung.test.ts`) extrahiert die JS-Fassung
 * und lässt beide gegen dieselben Fixtures laufen.
 */

/** Die Modelle, die diese App über die Bridge ansteuert. */
export type ModellKennung = 'gpt-oss' | 'qwen35';

/**
 * Passt der Options-Text (oder die `value`) zum gewünschten Modell?
 *
 * Multimodale Optionen werden **immer** abgelehnt, egal welches Ziel gefragt
 * ist — sie sind nicht angebunden, und ihr Fenster ist das kleine.
 */
export function passtZuModell(ziel: string, text: string): boolean {
  const s = String(text || '').toLowerCase();
  if (!s) return false;
  if (/multimodal|-vl-|\bvl\b/.test(s)) return false; // Qwen3-VL: nie automatisch
  if (ziel === 'gpt-oss') return /gpt[ _-]?oss/.test(s);
  if (ziel === 'qwen35') return /qwen\s*3[._]6/.test(s);
  return false;
}

/**
 * Kontextfenster aus der Chatlängen-Anzeige lesen
 * („Chatlänge [Token]: 0k von 62k" → 62000).
 *
 * Gelesen statt verdrahtet, weil unsere Konstanten still gedriftet sind (262k im
 * Code gegen 259k in der Seite) und ein zu groß angesetztes Fenster nicht
 * auffällt: das Modell schiebt dann den Anfang des Prompts heraus, das Ergebnis
 * ist still falsch statt sichtbar gekürzt.
 *
 * `0` heißt „nicht lesbar" — der Aufrufer bleibt dann bei seinem Rückfallwert.
 */
export function leseKontextTokens(text: string): number {
  const m = /von\s*([\d.,]+)\s*(k|m)?\b/i.exec(String(text || ''));
  if (!m || !m[1]) return 0;
  let zahl = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
  if (!isFinite(zahl) || zahl <= 0) return 0;
  const einheit = (m[2] || '').toLowerCase();
  if (einheit === 'k') zahl *= 1000;
  else if (einheit === 'm') zahl *= 1000000;
  return Math.round(zahl);
}
