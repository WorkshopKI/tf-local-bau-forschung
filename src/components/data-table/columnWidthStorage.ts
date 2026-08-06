/**
 * Laden, Speichern und Entfernen der Spalten-Pixelbreiten — pur, damit es ohne
 * React prüfbar ist. Der Hook daneben (`useColumnWidths`) hält nur den State.
 *
 * Beim Lesen wird bewusst großzügig gefiltert: eine kaputte oder von Hand
 * bearbeitete localStorage-Zeile darf die Tabelle nicht lahmlegen, sie fällt auf
 * die Defaults zurück.
 */

export function ladeBreiten(
  storageKey: string,
  defaults: Record<string, number>,
): Record<string, number> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...defaults };
    }
    const out: Record<string, number> = { ...defaults };
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return { ...defaults };
  }
}

export function speichereBreiten(storageKey: string, widths: Record<string, number>): void {
  try { localStorage.setItem(storageKey, JSON.stringify(widths)); } catch { /* ignore */ }
}

/**
 * Eine Breite ENTFERNEN, nicht überschreiben.
 *
 * Das ist der Unterschied, an dem der Doppelklick hängt: die gemessene
 * Inhaltsbreite festzuschreiben ließe die Spalte bei der Breite von damals
 * erstarren. Ohne Eintrag folgt sie weiter dem Inhalt.
 */
export function entferneBreite(
  widths: Record<string, number>,
  key: string,
): Record<string, number> {
  if (!(key in widths)) return widths;
  const next = { ...widths };
  delete next[key];
  return next;
}
