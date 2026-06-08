/**
 * Findet frühere, abgelehnte/zurückgezogene Einreichungen desselben Projekts
 * (gleicher VB_KURZNAM / `akronym`) für den Verbund-Detail-Hinweis.
 *
 * Hintergrund: Im Foyer-Quellsystem wird ein erneut eingereichtes Projekt unter
 * demselben Kurznamen geführt; der überholte Vorgänger trägt seinen Kurznamen in
 * **Klammern** (`(SCULPT)`), der aktive Verbund ohne (`SCULPT`), und seine TVs
 * stehen auf Status `abgelehnt/zurückgezogen`. Merger/Akronym-Index vergleichen
 * Akronyme roh → `(SCULPT)` und `SCULPT` sind getrennte Verbünde. Das Verlinken
 * passiert deshalb hier im Konsumenten über eine Klammer-tolerante Normalisierung
 * (kein Daten-Backfill nötig).
 *
 * Scope: arbeitet auf der In-Memory-Slim-Liste des aktuellen Programms
 * (`useAntraegeStore.antraege`). Re-Einreichungen liegen im selben Programm;
 * programm-übergreifende Vorgänger sind bewusst nicht abgedeckt.
 */
import type { AntragListItem } from '@/core/services/csv/types';
import { isAbgelehntZurueckgezogenStatus } from '@/core/utils/status-canonical';

/**
 * Normalisiert einen Kurznamen für den „gleicher VB_KURZNAM"-Vergleich:
 * umschließende Klammern, Groß-/Kleinschreibung und Whitespace werden ignoriert,
 * sodass `(SCULPT)` und `SCULPT` als identisch gelten. Leer/`null` → `null`.
 */
export function normalizeAkronymForMatch(s: string | null | undefined): string | null {
  if (typeof s !== 'string') return null;
  let t = s.trim();
  // Umschließende Klammern entfernen (z.B. "(SCULPT)" → "SCULPT"). Nur ein
  // vollständig geklammerter Wert wird entklammert — innere Klammern bleiben.
  while (t.startsWith('(') && t.endsWith(')') && t.length >= 2) {
    t = t.slice(1, -1).trim();
  }
  t = t.toLowerCase();
  return t.length === 0 ? null : t;
}

/** Ein früherer, abgelehnter/zurückgezogener Verbund mit demselben Kurznamen. */
export interface AbgelehnterVorgaenger {
  /** Verbund-ID des Vorgängers (für Navigation/Key). */
  verbundId: string;
  /** Kurzname so wie gespeichert — i.d.R. geklammert, z.B. „(SCULPT)". */
  akronymRaw: string;
  /** Anzahl der Teilvorhaben des Vorgängers. */
  tvCount: number;
  /** Jüngste Erstentscheidung über die TVs (roh/ISO), falls vorhanden. */
  erstentscheidung?: string;
  /** Antragsteller des ersten TVs, falls vorhanden. */
  antragsteller?: string;
  /** Ein Aktenzeichen als Beispiel (für Anzeige). */
  fkzExample: string;
  /** Alle Aktenzeichen des Vorgängers (erstes = Navigationsziel). */
  aktenzeichen: string[];
}

interface FindParams {
  /** Verbund-ID des aktuell geöffneten Verbundes (wird ausgeschlossen). */
  currentVerbundId: string;
  /** Roher Kurzname des aktuellen Verbundes (ohne verbund_id-Fallback). */
  currentAkronym: string | null;
  /** Aktenzeichen der aktuell geöffneten TVs (werden ausgeschlossen). */
  currentAktenzeichen: ReadonlySet<string>;
  /** In-Memory-Slim-Liste des Programms. */
  antraege: readonly AntragListItem[];
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/**
 * Liefert die früheren abgelehnten/zurückgezogenen Verbünde mit demselben
 * (klammer-normalisierten) Kurznamen, gruppiert pro Vorgänger-Verbund, sortiert
 * nach jüngster Erstentscheidung absteigend. Leeres/`null`-Akronym → `[]`.
 */
export function findAbgelehnteVorgaenger(params: FindParams): AbgelehnterVorgaenger[] {
  const { currentVerbundId, currentAkronym, currentAktenzeichen, antraege } = params;
  const target = normalizeAkronymForMatch(currentAkronym);
  if (target === null) return [];

  // Treffer: gleicher Kurzname (klammer-tolerant), Status abgelehnt/zurückgezogen,
  // nicht der aktuelle Verbund / nicht eines seiner TVs.
  const matches = antraege.filter(a =>
    normalizeAkronymForMatch(a.akronym) === target
    && isAbgelehntZurueckgezogenStatus(a.status)
    && !currentAktenzeichen.has(a.aktenzeichen)
    && a.verbund_id !== currentVerbundId,
  );
  if (matches.length === 0) return [];

  // Pro Vorgänger-Verbund gruppieren (Solo-Antrag ohne verbund_id → eigene
  // Gruppe über das Aktenzeichen).
  const groups = new Map<string, AntragListItem[]>();
  for (const a of matches) {
    const key = strOrNull(a.verbund_id) ?? a.aktenzeichen;
    const list = groups.get(key);
    if (list) list.push(a);
    else groups.set(key, [a]);
  }

  const out: AbgelehnterVorgaenger[] = [];
  for (const [key, tvs] of groups) {
    const akronymRaw = strOrNull(tvs.find(t => strOrNull(t.akronym))?.akronym) ?? key;
    const antragsteller = strOrNull(tvs.find(t => strOrNull(t.antragsteller))?.antragsteller) ?? undefined;
    // Jüngste Erstentscheidung (lexikografisch = chronologisch bei ISO-Daten).
    let erstentscheidung: string | undefined;
    for (const t of tvs) {
      const e = strOrNull(t.erstentscheidung);
      if (e && (erstentscheidung === undefined || e > erstentscheidung)) erstentscheidung = e;
    }
    const aktenzeichen = tvs.map(t => t.aktenzeichen).sort((x, y) => x.localeCompare(y));
    out.push({
      verbundId: key,
      akronymRaw,
      tvCount: tvs.length,
      erstentscheidung,
      antragsteller,
      fkzExample: aktenzeichen[0] ?? key,
      aktenzeichen,
    });
  }

  // Jüngster Vorgänger zuerst; Vorgänger ohne Datum ans Ende.
  out.sort((a, b) => {
    if (a.erstentscheidung && b.erstentscheidung) return b.erstentscheidung.localeCompare(a.erstentscheidung);
    if (a.erstentscheidung) return -1;
    if (b.erstentscheidung) return 1;
    return a.verbundId.localeCompare(b.verbundId);
  });
  return out;
}
