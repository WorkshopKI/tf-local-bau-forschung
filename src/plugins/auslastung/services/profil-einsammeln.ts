/**
 * PL-Einsammel-Schritt fuer MA-Selbst-Profile (v2.6).
 *
 * Liest `ZAH/auslastung-profil.json` aus allen User-Ordnern unter dem
 * User-Folders-Root (Kurator/PL-Pfad, nur `read` noetig) und merged die
 * MA-pflegbaren Felder in die `auslastung.json`-Mitarbeiter — ohne PL-only-
 * Felder zu ueberschreiben.
 *
 * Iterations-Muster gespiegelt von `FeedbackInboxTab.loadInbox` (Feedback-
 * Outbox-Einsammeln). Merge ist pure → testbar ohne FS.
 */
import { readAuslastungProfilFromShare } from './persoenliches-profil';
import { normalizeKuerzel, nextFreeAnonId, type AnonymMap } from './anonym-map';
import {
  DEFAULT_JAHRESKAPAZITAET,
  type AnonymerMitarbeiter,
  type PersoenlichesAuslastungProfil,
} from '../types';

/**
 * Liest alle MA-Selbst-Profile unter dem User-Folders-Root ein. User-Ordner
 * ohne `ZAH/auslastung-profil.json` werden uebersprungen.
 *
 * `entry.name` (User-Ordner) ist selbst der User-Home-Root, daher liest
 * `readAuslastungProfilFromShare(userDir)` direkt `ZAH/auslastung-profil.json`.
 */
export async function collectUserProfiles(
  root: FileSystemDirectoryHandle,
): Promise<PersoenlichesAuslastungProfil[]> {
  const out: PersoenlichesAuslastungProfil[] = [];
  for await (const entry of (root as FileSystemDirectoryHandle & {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }).values()) {
    if (entry.kind !== 'directory') continue;
    try {
      const userDir = await root.getDirectoryHandle(entry.name);
      const profil = await readAuslastungProfilFromShare(userDir);
      if (profil) out.push(profil);
    } catch {
      // User-Ordner ohne ZAH/-Struktur oder ohne Profil → ignorieren.
    }
  }
  return out;
}

/** Nur die MA-pflegbaren Felder aus einem Profil (PL-only-Felder bleiben aussen vor). */
function selfFields(p: PersoenlichesAuslastungProfil): Pick<
  AnonymerMitarbeiter,
  'manuelleTechnologien' | 'ausgeblendeteAutoTags' | 'hauptKategorie' | 'nebenKategorien' | 'antragstypBevorzugt'
> {
  return {
    manuelleTechnologien: p.manuelleTechnologien ?? [],
    ausgeblendeteAutoTags: p.ausgeblendeteAutoTags ?? [],
    hauptKategorie: p.hauptKategorie ?? '',
    nebenKategorien: p.nebenKategorien ?? [],
    antragstypBevorzugt: p.antragstypBevorzugt ?? [],
  };
}

/** Default-Record fuer einen neu angelegten MA (analog `syncMitarbeiterFromAntraege`). */
function defaultMitarbeiter(anonId: string): AnonymerMitarbeiter {
  return {
    anonId,
    jahresKapazitaet: DEFAULT_JAHRESKAPAZITAET,
    abgemeldet: [],
    manuelleTechnologien: [],
    ausgeblendeteAutoTags: [],
    hauptKategorie: '',
    nebenKategorien: [],
    abschlagProzent: 0,
    virtuelleProjekte: [],
    onboardingAbgeschlossen: true,
    aktiv: true,
  };
}

/**
 * Berechnet den "effektiven" MA-Record fuer die EIGENE Self-Ansicht (Home
 * „Neue Anträge für dich"). Das persoenliche Profil ist autoritativ fuer die
 * MA-pflegbaren Felder; PL-only-Felder (`jahresKapazitaet`, `abschlagProzent`,
 * `antragstypUeberschreibung`, …) bleiben aus dem `auslastung.json`-Store-Record.
 *
 * - Kein Store-Record + kein persoenliches Profil → `undefined`.
 * - Nur Store-Record → unveraendert (Back-Compat: User ohne persoenliches Profil).
 * - Persoenliches Profil vorhanden → Store-Record (bzw. Default-Base wenn keiner
 *   existiert) mit den Self-Feldern ueberschrieben. `hauptKategorie` faellt bei
 *   leerem persoenlichem Wert auf den Store-/Auto-Wert zurueck.
 *
 * Pure — kein FS, kein Store.
 */
export function mergeSelfProfile(
  storeRecord: AnonymerMitarbeiter | undefined,
  personal: PersoenlichesAuslastungProfil | null,
  anonId: string | null,
): AnonymerMitarbeiter | undefined {
  if (!personal) return storeRecord;
  const base = storeRecord ?? defaultMitarbeiter(anonId ?? 'ME');
  const self = selfFields(personal);
  return {
    ...base,
    ...self,
    // Leeres persoenliches Haupt nicht ueber einen vorhandenen (auto-abgeleiteten)
    // Store-Wert schreiben.
    hauptKategorie: self.hauptKategorie || base.hauptKategorie,
  };
}

export interface MergeProfilesResult {
  next: Record<string, AnonymerMitarbeiter>;
  /** anonIds bestehender MAs, deren Selbst-Felder aktualisiert wurden. */
  aktualisiert: string[];
  /** anonIds neu angelegter MAs (Kuerzel war noch nicht in der AnonymMap). */
  neu: string[];
}

/**
 * Merged die Selbst-Profile in die Mitarbeiter-Map.
 *
 * - `kuerzel → anonId` ueber die AnonymMap (NFC-normalisiert, Pitfall #22).
 * - Bestehender MA: nur die MA-pflegbaren Felder werden ueberschrieben, alle
 *   PL-only-Felder (`jahresKapazitaet`, `abschlagProzent`, `aktiv`,
 *   `abgemeldet`, `antragstypUeberschreibung`, …) bleiben erhalten.
 * - Unbekanntes Kuerzel: neuer MA mit naechster freier anonId + Default-Werten.
 * - Konflikt-Regel: das Selbst-Profil ist autoritativ fuer seine Felder.
 *
 * Pure — kein FS, kein Store. Aufrufer persistiert das Ergebnis.
 */
export function mergeProfilesIntoMitarbeiter(
  current: Record<string, AnonymerMitarbeiter>,
  profile: PersoenlichesAuslastungProfil[],
  anonymMap: AnonymMap,
): MergeProfilesResult {
  const next: Record<string, AnonymerMitarbeiter> = { ...current };
  const aktualisiert: string[] = [];
  const neu: string[] = [];

  for (const p of profile) {
    const k = normalizeKuerzel(p.kuerzel);
    if (!k) continue;

    const mappedId = anonymMap.toAnon.get(k);
    if (mappedId && next[mappedId]) {
      next[mappedId] = { ...next[mappedId]!, ...selfFields(p) };
      aktualisiert.push(mappedId);
    } else {
      // Kuerzel ohne (noch) existierenden MA-Record: neue anonId vergeben.
      // `nextFreeAnonId` gegen die wachsende `next`-Map, damit mehrere neue
      // Profile in einem Lauf disjunkte IDs bekommen.
      const anonId = mappedId ?? nextFreeAnonId(Object.keys(next));
      next[anonId] = { ...defaultMitarbeiter(anonId), ...selfFields(p) };
      neu.push(anonId);
    }
  }

  return { next, aktualisiert, neu };
}
