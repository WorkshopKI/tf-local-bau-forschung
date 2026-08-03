/**
 * Reine Anzeige-Hilfsfunktionen für Profilname, Kürzel und Avatar.
 *
 * Kein Import aus dem Rest der App — so entstehen keine Zyklen.
 * Alle Funktionen sind pure (kein State, kein DOM).
 */

/**
 * Initialen aus einem Anzeigenamen.
 *
 * Regel: erstes Zeichen des ersten Worts + erstes Zeichen des letzten Worts
 * (sofern verschieden), uppercase, max 2 Zeichen.
 * Leerer/unbrauchbarer Name → `'?'`.
 *
 * Gleiche Regel wie `avatarInitials` in FeedbackAvatar.tsx — eine Wahrheit.
 */
export function initialenVon(name: string | undefined): string {
  const n = (name ?? '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/);
  const a = parts[0]?.[0] ?? '';
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (a + b).toUpperCase() || '?';
}

/**
 * Bereinigtes Kürzel für die Avatar-Anzeige.
 *
 * - `undefined`, `''`, `'alle'` (case-insensitive) → `undefined` (kein Filter aktiv,
 *   gleiche Semantik wie `istEchtesKuerzel` in update-author.ts und
 *   `parseBearbeiterFilter`).
 * - Bei Komma-getrennter Vertretungs-Schreibweise (`"MUE, SCH"`) → erstes Token.
 * - NFC-Normalisierung (Pitfall #22, Umlaut-Kürzel wie THÜ/BIB/ZTP).
 * - Uppercase, max 4 Zeichen (THÜ = 3 Zeichen, passt in den 36-px-Kreis).
 */
export function kuerzelFuerAnzeige(kuerzel: string | undefined): string | undefined {
  if (!kuerzel) return undefined;
  const first = kuerzel.split(',')[0] ?? '';
  const t = first.trim().normalize('NFC').toUpperCase();
  if (!t || t === 'ALLE') return undefined;
  return t.slice(0, 4);
}

/**
 * Text im Profil-Avatar: Kürzel wenn gesetzt, sonst Initialen aus Name.
 */
export function profilAvatarText(
  kuerzel: string | undefined,
  name: string | undefined,
): string {
  return kuerzelFuerAnzeige(kuerzel) ?? initialenVon(name);
}

/**
 * Vorname: erstes Whitespace-Token des Profilnamens.
 * Leerer/fehlender Name → `''`.
 */
export function vornameVon(name: string | undefined): string {
  const n = (name ?? '').trim();
  if (!n) return '';
  return n.split(/\s+/)[0] ?? '';
}
