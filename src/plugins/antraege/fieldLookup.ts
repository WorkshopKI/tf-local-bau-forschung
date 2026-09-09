import type { Antrag } from '@/core/services/csv/types';

/**
 * Normalisiert Feld-Bezeichner fuer robustes Lookup: lowercase + alle Trenner raus.
 *
 * Klammern und Schraegstriche gehoeren zu den Trennern, seit v4.124: der Importer
 * wirft sie beim Ableiten des Custom-Keys weg (`beantragte Kosten (Deckblatt
 * Mantelbogen)` → `beantragte_kosten_deckblatt_mantelbogen`), die Alias-Listen
 * schreiben aber die SPALTENUEBERSCHRIFT mit Klammern. Blieben sie stehen, traf
 * kein Alias den Record-Schluessel — gemessen 0 von 14 225 Treffern, obwohl der
 * Wert in 8 105 Saetzen steht.
 */
export function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[\s_\-.()[\]{}/\\,;:]/g, '');
}

/**
 * Ein Feldwert als nicht-leerer, **getrimmter** String — oder `null`.
 *
 * Die eine Heimat fuer eine Frage, die in `src/plugins/antraege/` zehnmal
 * privat beantwortet wurde (v6.45). Unter demselben Namen `strOrNull` standen
 * dabei VIER verschiedene Verhalten:
 *
 * - siebenmal genau dies hier,
 * - einmal dieselbe Semantik in anderer Schreibweise (`kurzfassung/context-builder`),
 * - einmal zusaetzlich `number` → `String(v)` (`EckdatenCard`) — an seinen drei
 *   Aufrufstellen (`antragsteller`/`branche`/`foerdergeber`, alle `string?`)
 *   unerreichbar, also toter Zweig,
 * - einmal pruefend getrimmt, aber den Wert UNGETRIMMT zurueckgebend
 *   (`spaltenAufloesung`).
 *
 * Der letzte Fall blieb folgenlos, weil jeder Abnehmer sich selbst wehrt
 * (`naechsterSchritt` trimmt, `statusLabel`/`statusRang` normalisieren ueber
 * `status-canonical`). Folgenlos ist aber nicht harmlos: die Funktion verspricht
 * im Namen einen Wert-oder-nichts und liefert je nach Datei etwas anderes — die
 * naechste Aufrufstelle ohne eigene Abwehr haette den Unterschied getragen.
 */
export function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/**
 * Findet einen Wert auf dem Antrag fuer einen oder mehrere Kandidaten-Bezeichner.
 *
 * Hintergrund: CSV-Spalten landen im Antrag-Objekt entweder als snake_case-Custom-Key
 * (`vb_inhalt`), als lowercase mit Leerzeichen (`vb inhalt`) oder als canonical-Key
 * (`titel`, `branche`). Der genaue Schluessel haengt vom CSV-Schema und Column-Mapping ab.
 *
 * Diese Helper-Funktion vergleicht case-insensitive und ohne Trenner — `findFieldValue(a,
 * ['vb_inhalt'])` matcht `a['vb inhalt']`, `a['Vb_Inhalt']`, `a['vbinhalt']` etc.
 */
export function findFieldValue(antrag: Antrag, candidates: string[]): unknown {
  const targets = new Set(candidates.map(normalizeKey));
  for (const [key, value] of Object.entries(antrag)) {
    if (key.startsWith('_')) continue;
    if (targets.has(normalizeKey(key))) return value;
  }
  return undefined;
}

/**
 * Wie `findFieldValue`, aber ueber mehrere Antraege (TVs): liefert den ERSTEN
 * nicht-leeren Treffer.
 *
 * Hintergrund: manche Felder (z.B. VB_INHALT / Kurzzusammenfassung) sind auf
 * Verbund-Ebene gedacht, im CSV aber nur an EINEM Teilvorhaben gefuellt — der
 * Lead-TV kann leer sein, ein Partner-TV den Wert tragen. Nur den Lead zu lesen
 * verschluckt die Beschreibung dann still.
 */
export function findFieldValueAcross(antraege: Antrag[], candidates: string[]): unknown {
  for (const a of antraege) {
    const v = findFieldValue(a, candidates);
    if (typeof v === 'string' ? v.trim().length > 0 : v != null) return v;
  }
  return undefined;
}

/**
 * Wie `findFieldValueAcross`, liefert aber ALLE verschiedenen nicht-leeren Werte
 * in Vorkommens-Reihenfolge. Fuer Verbund-Kacheln, die aus TV-Feldern gefuellt
 * werden: eine Kachel, die genau EINEN von mehreren abweichenden TV-Werten
 * zeigt, muss das kennzeichnen koennen statt stillschweigend den Lead zu nehmen.
 */
export function findFieldValuesAcross(antraege: Antrag[], candidates: string[]): string[] {
  const out: string[] = [];
  const gesehen = new Set<string>();
  for (const a of antraege) {
    const v = findFieldValue(a, candidates);
    const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
    if (s.length === 0 || gesehen.has(s)) continue;
    gesehen.add(s);
    out.push(s);
  }
  return out;
}
