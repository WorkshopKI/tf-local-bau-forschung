/**
 * Reine Widerspruchs-Logik (UI-frei, testbar): Zustands-Mutationen + das Antwort-Tor.
 */
import type { WiderspruchPunkt, WiderspruchRecord, WiderspruchZustand } from './types';

/** Setzt den Zustand eines Punkts (legt ihn an, falls neu). Rein. */
export function setzeZustand(
  punkte: readonly WiderspruchPunkt[], punktKey: string, zustand: WiderspruchZustand,
): WiderspruchPunkt[] {
  const idx = punkte.findIndex(p => p.punktKey === punktKey);
  if (idx < 0) return [...punkte, { punktKey, zustand, notiz: '' }];
  return punkte.map((p, i) => (i === idx ? { ...p, zustand } : p));
}

/** Setzt die Notiz eines Punkts (legt ihn an, falls neu). Rein. */
export function setzeNotiz(
  punkte: readonly WiderspruchPunkt[], punktKey: string, notiz: string,
): WiderspruchPunkt[] {
  const idx = punkte.findIndex(p => p.punktKey === punktKey);
  if (idx < 0) return [...punkte, { punktKey, zustand: 'offen', notiz }];
  return punkte.map((p, i) => (i === idx ? { ...p, notiz } : p));
}

/** Zustand eines Punkts (Default `offen`, wenn noch nicht bewertet). Rein. */
export function zustandVon(record: WiderspruchRecord | null, punktKey: string): WiderspruchZustand {
  return record?.punkte.find(p => p.punktKey === punktKey)?.zustand ?? 'offen';
}

/** Notiz eines Punkts. Rein. */
export function notizVon(record: WiderspruchRecord | null, punktKey: string): string {
  return record?.punkte.find(p => p.punktKey === punktKey)?.notiz ?? '';
}

/**
 * Die noch NICHT (vollständig) ausgeräumten tragenden Gründe — sie müssen in der
 * Antwort adressiert werden. `offen`/`teilweise`/`nicht_ausgeraeumt` zählen dazu,
 * nur `ausgeraeumt` fällt heraus. Rein.
 */
export function offeneWiderspruchKeys(
  record: WiderspruchRecord | null, alleKeys: readonly string[],
): string[] {
  return alleKeys.filter(k => zustandVon(record, k) !== 'ausgeraeumt');
}

/**
 * Antwort-Tor: jeder noch offene Grund muss in der Werkbank adressiert (angekreuzt)
 * sein. Rein.
 */
export function antwortTorErfuellt(
  offeneKeys: readonly string[], adressierteKeys: ReadonlySet<string>,
): boolean {
  return offeneKeys.every(k => adressierteKeys.has(k));
}
