/**
 * Reine Helfer des Zuweisungs-Cockpits (Screen 1b) — Split-Persistenz,
 * Datums-/Zeit-Formatierung und die verbund-weite Status-Aggregation.
 * Aus ZuweisungsCockpit.tsx ausgelagert (Kohäsion vor Zeilenzahl), Verhalten
 * unverändert.
 */
import type { Zuweisung } from '../types';

/** Status-Filter der Verbund-Liste. `selbst` = „Übernahme-Wunsch" (v2.9).
 *  `offen` und `selbst` überlappen bewusst: ein Wunsch ist eine Bewerbung,
 *  keine Zuweisung (siehe `verbundStatusFlags`). */
export type StatusFilter = 'offen' | 'selbst' | 'zugewiesen' | 'alle';

/** Labels der Status-Filter-Pills. `selbst` heisst nutzerseitig „Übernahme-
 *  Wunsch" (v2.9) — so filtert die PL gezielt Anträge, die jemand haben will. */
export const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  offen: 'offen',
  selbst: 'Übernahme-Wunsch',
  zugewiesen: 'zugewiesen',
  alle: 'alle',
};

// ─── Resizable Split (linke Liste vs. Detail) ───────────────────────────
// Der User kann die linke Antragsliste breiter ziehen, um lange VB-Titel zu
// lesen. Breite (linke Spalte in %) wird in localStorage gehalten — laut
// CLAUDE.md fuer User-Preferences erlaubt.
export const SPLIT_STORAGE_KEY = 'tf-auslastung-zuweisung-split';
export const SPLIT_MIN = 25;
export const SPLIT_MAX = 75;
export const SPLIT_DEFAULT = 50;

/** Klemmt einen Prozentwert auf den erlaubten Split-Bereich. */
export function clampSplitPct(n: number): number {
  if (!Number.isFinite(n)) return SPLIT_DEFAULT;
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, n));
}

/** Liest die gespeicherte Split-Breite (linke Spalte in %) aus localStorage. */
export function readSplitPct(): number {
  try {
    const raw = localStorage.getItem(SPLIT_STORAGE_KEY);
    return raw === null ? SPLIT_DEFAULT : clampSplitPct(parseFloat(raw));
  } catch {
    return SPLIT_DEFAULT;
  }
}

/** Persistiert die Split-Breite (best-effort — localStorage kann fehlen). */
export function persistSplitPct(pct: number): void {
  try {
    localStorage.setItem(SPLIT_STORAGE_KEY, String(Math.round(pct)));
  } catch {
    /* localStorage nicht verfuegbar — Breite bleibt nur fuer die Session */
  }
}

/** Formatiert das Antragsdatum (ISO `YYYY-MM-DD`) als de-DE-Datum (DD.MM.YYYY).
 *  Leeres/ungültiges Datum → „—" (Spalte bleibt konsistent gefüllt). */
export function formatAntragsdatum(iso: string | undefined): string {
  if (iso && /^\d{4}-\d{2}-\d{2}/.test(iso)) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  }
  return '—';
}

/** Formatiert den Klick-Zeitpunkt einer Vormerkung kompakt (de-DE). */
export function formatKlickZeit(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/** Aggregierter Status eines Verbundes ueber alle seine TVs. Geteilt von der
 *  Filterung und der Count-Berechnung (eine Quelle statt Duplizierung).
 *
 *  `offen` heisst „niemandem zugewiesen": ein Übernahme-Wunsch (`selbst`) ist
 *  eine Bewerbung, keine Zuweisung — der Verbund bleibt offen, bis die PL
 *  freigibt. `offen` und `selbst` schliessen sich daher nicht aus (die
 *  Pill-Counts überlappen bewusst). Nicht an `selbstEingetragen` festmachen:
 *  das Flag überlebt die Freigabe. */
export function verbundStatusFlags(
  tvAktenzeichen: string[],
  zuweisungen: Zuweisung[],
): { offen: boolean; selbst: boolean; zug: boolean } {
  const ze = zuweisungen.filter(z => tvAktenzeichen.includes(z.antragId));
  return {
    offen: !ze.some(z => z.status === 'freigegeben' || z.status === 'vorgeschlagen'),
    selbst: ze.some(z => z.status === 'selbst' || z.selbstEingetragen),
    zug: ze.some(z => z.status === 'freigegeben'),
  };
}

/** Klick-Zeitpunkt einer Vormerkung als Timestamp (Fallback `freigegebenAm`
 *  fuer Pre-v2.9-Eintraege, ohne Datum ans Ende sortiert). */
export function wunschKlickTs(z: Zuweisung): number {
  const iso = z.selbstEingetragenAm ?? z.freigegebenAm;
  return iso ? Date.parse(iso) : Number.POSITIVE_INFINITY;
}

/** Interessenten (Übernahme-Wünsche) eines Verbundes: pro MA genau EIN Eintrag
 *  (früheste Vormerkung, falls er mehrere TVs vorgemerkt hat), sortiert nach
 *  Klick-Zeit aufsteigend → der zuerst Wollende steht vorne. Geteilt von der
 *  Verbund-Liste (Kürzel-Badges) und dem Detail-Panel (Auswahl-Liste). */
export function interessentenNachWunschzeit(zuweisungen: Zuweisung[]): Zuweisung[] {
  const byAnon = new Map<string, Zuweisung>();
  for (const z of zuweisungen) {
    if (z.status !== 'selbst' && !z.selbstEingetragen) continue;
    const prev = byAnon.get(z.anonId);
    if (!prev || wunschKlickTs(z) < wunschKlickTs(prev)) byAnon.set(z.anonId, z);
  }
  return Array.from(byAnon.values()).sort((a, b) => wunschKlickTs(a) - wunschKlickTs(b));
}
