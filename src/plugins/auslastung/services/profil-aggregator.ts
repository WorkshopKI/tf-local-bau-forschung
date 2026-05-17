/**
 * Aggregiert historische Antraegen-Daten in Profile-Informationen pro MA
 * + globale Deskriptoren-Statistik fuer den Admin-Setup-Wizard.
 *
 * Eingabe: Liste aller Antraege des aktiven Programms (`Antrag[]` aus
 * `listAntraegeByProgramm`).
 *
 * Output:
 *  - `aggregateMaProfile(antraege, kuerzel)`     -> deskriptoren-Set fuer 1 MA
 *  - `aggregateMaProfilesByAnon(antraege, map)`  -> Map<anonId, deskriptoren[]>
 *  - `collectAllDeskriptoren(antraege)`          -> sortierte Liste aller eindeutigen Deskriptoren
 *  - `deriveKategorienForMa(deskriptoren, kategorien)`
 *      -> Liste der Ueberkategorien-IDs, in denen der MA gearbeitet hat
 */
import type { Antrag } from '@/core/services/csv/types';
import { ALL_DESKRIPTOREN_SPALTEN, CANONICAL_TIB_KUERZ, type UeberKategorie } from '../types';
import { normalizeKuerzel, type AnonymMap } from './anonym-map';

/** Normalisiert einen Deskriptoren-Wert: trim + lowercase. Leere/non-string -> null. */
export function normalizeDeskriptor(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-' || trimmed === '0') return null;
  return trimmed.toLowerCase();
}

/** Liest alle Deskriptoren-Werte eines einzelnen Antrags (over alle Spalten, dedupliziert). */
export function readAntragDeskriptoren(antrag: Antrag): string[] {
  const set = new Set<string>();
  for (const spalte of ALL_DESKRIPTOREN_SPALTEN) {
    const val = (antrag as Record<string, unknown>)[spalte];
    const norm = normalizeDeskriptor(val);
    if (norm) set.add(norm);
  }
  return [...set];
}

/** Aggregiert alle Deskriptoren des Programms (fuer den Admin-Setup-Mapping). */
export function collectAllDeskriptoren(antraege: Antrag[]): string[] {
  const counts = new Map<string, number>();
  for (const a of antraege) {
    for (const d of readAntragDeskriptoren(a)) {
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
    .map(([d]) => d);
}

/** Variante mit Counts — fuer Admin-UI ("Wie oft kommt dieser Deskriptor vor?"). */
export function collectAllDeskriptorenMitCount(antraege: Antrag[]): Array<{ wert: string; count: number }> {
  const counts = new Map<string, number>();
  for (const a of antraege) {
    for (const d of readAntragDeskriptoren(a)) {
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
    .map(([wert, count]) => ({ wert, count }));
}

/** Sammelt alle Deskriptoren EINES Bearbeiter-Kuerzels. */
export function aggregateMaProfile(antraege: Antrag[], kuerzel: string): string[] {
  const key = normalizeKuerzel(kuerzel);
  if (!key) return [];
  const set = new Set<string>();
  for (const a of antraege) {
    const tib = normalizeKuerzel((a as Record<string, unknown>)[CANONICAL_TIB_KUERZ]);
    if (tib !== key) continue;
    for (const d of readAntragDeskriptoren(a)) set.add(d);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'de'));
}

/**
 * Aggregiert pro anonId (alle bekannten MAs aus der AnonymMap).
 *
 * Single-pass-Implementation: O(Antraege × Spalten) statt naiv
 * O(MAs × Antraege × Spalten). Bei 79 MAs × 5000 Antraegen × 12 Spalten
 * waeren das ~4.7M Iterationen — single-pass bringt das auf ~60k runter.
 */
export function aggregateMaProfilesByAnon(
  antraege: Antrag[],
  map: AnonymMap,
): Map<string, string[]> {
  const collector = new Map<string, Set<string>>();
  // Stelle sicher dass alle bekannten anonIds einen Eintrag haben (auch wenn
  // sie keine Deskriptoren-Werte ableiten — z.B. tib_kuerz gesetzt, aber alle
  // techn_/branche_-Spalten leer).
  for (const anonId of map.toAnon.values()) {
    collector.set(anonId, new Set());
  }
  for (const a of antraege) {
    const raw = (a as Record<string, unknown>)[CANONICAL_TIB_KUERZ];
    const k = normalizeKuerzel(raw);
    if (!k) continue;
    const anonId = map.toAnon.get(k);
    if (!anonId) continue;
    const set = collector.get(anonId)!;
    for (const d of readAntragDeskriptoren(a)) set.add(d);
  }
  const out = new Map<string, string[]>();
  for (const [anonId, set] of collector.entries()) {
    out.set(anonId, [...set].sort((x, y) => x.localeCompare(y, 'de')));
  }
  return out;
}

/** Sammelt die Aktenzeichen aller Antraege EINES MAs (per anonId). */
export function aktenzeichenForAnon(
  antraege: Antrag[],
  anonId: string,
  map: AnonymMap,
): string[] {
  const kuerzel = map.toReal.get(anonId);
  if (!kuerzel) return [];
  const out: string[] = [];
  for (const a of antraege) {
    const tib = normalizeKuerzel((a as Record<string, unknown>)[CANONICAL_TIB_KUERZ]);
    if (tib === kuerzel) out.push(a.aktenzeichen);
  }
  return out;
}

/**
 * Leitet die Liste der Ueberkategorien ab, in denen ein MA bisher gearbeitet hat.
 * Logik: Fuer jeden Deskriptor des MAs schauen, in welche Kategorie(n) er gemapt
 * ist — Union ueber alle.
 */
export function deriveKategorienForMa(
  deskriptoren: string[],
  kategorien: UeberKategorie[],
): string[] {
  const result = new Set<string>();
  const lower = deskriptoren.map(d => d.toLowerCase());
  for (const k of kategorien) {
    for (const map of k.deskriptorenMapping) {
      if (lower.includes(map.toLowerCase())) {
        result.add(k.id);
        break;
      }
    }
  }
  return [...result];
}

/**
 * Pflegt die Mitarbeiter-Liste in `auslastung.json` aus den aktuellen Antraegen
 * auf — fuegt fehlende MAs an (mit Default-Kapazitaet) und aktualisiert die
 * abgeleiteten `ueberKategorien`-Listen (nur fuer MAs, die keine manuelle
 * Override durch die PL haben).
 *
 * NICHT genutzt: profilEmbeddingText, virtuelleProjekte, onboardingAbgeschlossen
 * (kommen in Prompt 2).
 *
 * Default-Kapazitaet: siehe `DEFAULT_JAHRESKAPAZITAET` (`~Halbzeit-Aequivalent`
 * — PL geht im Auslastungs-Modul davon aus, dass MAs nur einen Teil ihrer
 * Zeit fuer Antragsbearbeitung haben). Pro MA im Admin ueberschreibbar.
 */
import { DEFAULT_JAHRESKAPAZITAET, type AnonymerMitarbeiter } from '../types';

export interface SyncMitarbeiterOptions {
  /** Default-Kapazitaet fuer neu erkannte MAs (Stunden/Jahr). */
  defaultJahresKapazitaet?: number;
  /** Wenn true, ueberschreibt auch vorhandene ueberKategorien-Listen. */
  overrideKategorien?: boolean;
}

export interface SyncMitarbeiterResult {
  next: Record<string, AnonymerMitarbeiter>;
  hinzugefuegt: string[];   // anonIds
  aktualisiert: string[];   // anonIds
}

export function syncMitarbeiterFromAntraege(
  current: Record<string, AnonymerMitarbeiter>,
  antraege: Antrag[],
  map: AnonymMap,
  kategorien: UeberKategorie[],
  opts: SyncMitarbeiterOptions = {},
): SyncMitarbeiterResult {
  const defaultJK = opts.defaultJahresKapazitaet ?? DEFAULT_JAHRESKAPAZITAET;
  const result: Record<string, AnonymerMitarbeiter> = { ...current };
  const hinzugefuegt: string[] = [];
  const aktualisiert: string[] = [];

  const profiles = aggregateMaProfilesByAnon(antraege, map);
  for (const [anonId, deskriptoren] of profiles.entries()) {
    const derivedKategorien = deriveKategorienForMa(deskriptoren, kategorien);
    const existing = result[anonId];
    if (!existing) {
      result[anonId] = {
        anonId,
        jahresKapazitaet: defaultJK,
        abgemeldet: [],
        manuelleTechnologien: [],
        ueberKategorien: derivedKategorien,
        virtuelleProjekte: [],
        onboardingAbgeschlossen: true,   // hat hist. Antraege -> kein Onboarding noetig
        aktiv: true,                     // Default: aktiv; PL deaktiviert ggf. via Banner/Admin
      };
      hinzugefuegt.push(anonId);
    } else if (opts.overrideKategorien) {
      result[anonId] = { ...existing, ueberKategorien: derivedKategorien };
      aktualisiert.push(anonId);
    }
  }

  return { next: result, hinzugefuegt, aktualisiert };
}
