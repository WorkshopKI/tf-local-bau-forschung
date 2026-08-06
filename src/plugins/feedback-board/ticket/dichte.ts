/**
 * Anzeige-Dichte des Boards (v3.12): drei Stufen statt der bisherigen zwei.
 * „Sehr kompakt" lässt Thumbnail und Fußzeile weg und kürzt den Titel auf eine
 * Zeile — bei 500 Tickets der Unterschied zwischen sechs und fünfzehn sichtbaren
 * Karten je Spalte.
 *
 * Der leere String ist die komfortable Stufe: er wird als CSS-Klasse angehängt,
 * und „keine Zusatzklasse" ist der Normalfall.
 */
export type Dichte = '' | 'dicht' | 'ultra';

export const DICHTE_OPTIONEN: ReadonlyArray<{ key: Dichte; label: string }> = [
  { key: '', label: 'Komfortabel' },
  { key: 'dicht', label: 'Kompakt' },
  { key: 'ultra', label: 'Sehr kompakt' },
];

export function istDichte(v: unknown): v is Dichte {
  return v === '' || v === 'dicht' || v === 'ultra';
}

export function dichteLabel(d: Dichte): string {
  return DICHTE_OPTIONEN.find(o => o.key === d)?.label ?? 'Komfortabel';
}
