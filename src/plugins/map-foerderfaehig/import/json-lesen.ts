/**
 * BOM-toleranter JSON-Einstieg für die Plattform-Einreichungen.
 *
 * Beide bekannten Exporte tragen ein UTF-8-BOM (`﻿`); `JSON.parse` wirft
 * darauf. Der Import darf an einer solchen Formalie nicht scheitern, deshalb
 * liefert `leseEinreichungJson` ein Ergebnis-Objekt statt zu werfen — der
 * Aufrufer zeigt die Meldung im Import-Report an.
 */

export type JsonLeseErgebnis =
  | { ok: true; daten: unknown; hatteBom: boolean }
  | { ok: false; fehler: string };

/** Entfernt ein führendes UTF-8-BOM. Rein. */
export function entferneBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Parst den Rohtext einer Einreichung. Toleriert BOM und umgebenden Whitespace;
 * jeder andere Fehler wird als Text zurückgegeben, nicht geworfen.
 */
export function leseEinreichungJson(rohText: string): JsonLeseErgebnis {
  const hatteBom = rohText.charCodeAt(0) === 0xfeff;
  const bereinigt = entferneBom(rohText).trim();

  if (bereinigt.length === 0) {
    return { ok: false, fehler: 'Die Datei ist leer.' };
  }

  try {
    const daten: unknown = JSON.parse(bereinigt);
    if (daten === null || typeof daten !== 'object') {
      return { ok: false, fehler: 'Die Datei enthält kein JSON-Objekt.' };
    }
    return { ok: true, daten, hatteBom };
  } catch (e) {
    const grund = e instanceof Error ? e.message : String(e);
    return { ok: false, fehler: `Die Datei ist kein gültiges JSON: ${grund}` };
  }
}
