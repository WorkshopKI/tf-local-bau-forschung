/**
 * Gesamt-Breite einer Tabelle, persistiert in localStorage — zwei Zustände am
 * selben Ort, weil sie dieselbe Frage beantworten: *wie breit ist diese Tabelle?*
 *
 * Gegenstück zu `useColumnWidths` (das die EINZEL-Spaltenbreiten hält). Beide
 * Zustände steuert der Griff am rechten Tabellenrand der `SortableTable`:
 *
 * | Zustand | Geste | Bedeutung |
 * |---|---|---|
 * | `totalWidth` | Ziehen | explizite Pixelbreite der GANZEN Tabelle; die Spalten skalieren proportional (CSS `table-layout: fixed`). `null` = keine gepinnte Breite |
 * | `inhaltsBreite` | Klick | `false` (Default) = die Spalten teilen sich die verfügbare Breite; `true` = jede Spalte nimmt ihre Inhaltsbreite, die Tabelle scrollt waagerecht |
 *
 * Die beiden liegen in getrennten Schlüsseln (`<key>` und `<key>_inhalt`), damit
 * ein bestehender Pin die Umstellung überlebt und ein fehlender Umschalt-
 * Schlüssel schlicht „Standard" heißt.
 *
 * Finaler Commit on mouseup ruft `setTotalWidth(px)`; ein Klick auf den Griff
 * ruft `setTotalWidth(null)` (Pin verwerfen) bzw. `toggleInhaltsBreite()`. Die
 * Live-Mutation während des Drags läuft direkt am DOM (siehe `TotalWidthGrip`)
 * und braucht den Hook nicht pro Frame.
 */
import { useCallback, useState } from 'react';

export interface UseTotalTableWidthResult {
  /** Gepinnte Gesamtbreite in Pixeln, oder `null` für „Container füllen". */
  totalWidth: number | null;
  setTotalWidth: (width: number | null) => void;
  /** `true` = Spalten auf Inhaltsbreite + waagerechtes Scrollen (`fitContentWidth`). */
  inhaltsBreite: boolean;
  toggleInhaltsBreite: () => void;
}

/** Gepinnte Gesamtbreite lesen. Exportiert, weil auch außerhalb der Tabelle
 *  gelesen wird (Fördertabelle: ein gemerkter Reiter nimmt die Breite mit) —
 *  und dann bitte über DIESE Funktion statt über einen zweiten `getItem`. */
export function ladeGesamtBreite(storageKey: string): number | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return null;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Gegenstück zum Lesen: `null` LÖSCHT den Eintrag (siehe `setTotalWidth`). */
export function speichereGesamtBreite(storageKey: string, width: number | null): void {
  try {
    if (width === null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, String(Math.round(width)));
  } catch {
    /* ignore */
  }
}

/** Schlüssel des Umschalters. Abgeleitet, nicht als zweites Argument verlangt —
 *  sonst könnten die zwei Zustände einer Tabelle in fremden Schlüsseln landen. */
export function inhaltsBreiteKey(storageKey: string): string {
  return `${storageKey}_inhalt`;
}

export function ladeInhaltsBreite(storageKey: string): boolean {
  try {
    // Nur das ausdrückliche `'1'` schaltet um: ein fehlender oder kaputter Wert
    // heißt „Standard", nicht „irgendetwas war mal gesetzt".
    return localStorage.getItem(inhaltsBreiteKey(storageKey)) === '1';
  } catch {
    return false;
  }
}

export function speichereInhaltsBreite(storageKey: string, an: boolean): void {
  try {
    // Der Standard wird GELÖSCHT statt als `'0'` geschrieben — so bleibt
    // „kein Schlüssel" die einzige Schreibweise für „Standard".
    if (an) localStorage.setItem(inhaltsBreiteKey(storageKey), '1');
    else localStorage.removeItem(inhaltsBreiteKey(storageKey));
  } catch {
    /* ignore */
  }
}

export function useTotalTableWidth(storageKey: string): UseTotalTableWidthResult {
  const [totalWidth, setWidthState] = useState<number | null>(() => ladeGesamtBreite(storageKey));
  const [inhaltsBreite, setInhaltsBreiteState] = useState<boolean>(
    () => ladeInhaltsBreite(storageKey),
  );

  const setTotalWidth = useCallback((width: number | null): void => {
    setWidthState(width);
    speichereGesamtBreite(storageKey, width);
  }, [storageKey]);

  const toggleInhaltsBreite = useCallback((): void => {
    setInhaltsBreiteState(prev => {
      const next = !prev;
      speichereInhaltsBreite(storageKey, next);
      return next;
    });
  }, [storageKey]);

  return { totalWidth, setTotalWidth, inhaltsBreite, toggleInhaltsBreite };
}
