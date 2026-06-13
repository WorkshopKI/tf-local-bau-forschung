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
import { readAuslastungProfilFromShare } from '../identitaet/persoenliches-profil';
import { resolveAnonIdForUser, type AnonymMap } from '../identitaet/anonym-map';
import {
  DEFAULT_JAHRESKAPAZITAET,
  type AnonymerMitarbeiter,
  type PersoenlichesAuslastungProfil,
} from '../../types';

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
    // Dito: leeres MA-antragstypBevorzugt laesst die PL-Vorbelegung stehen.
    antragstypBevorzugt: self.antragstypBevorzugt?.length
      ? self.antragstypBevorzugt
      : base.antragstypBevorzugt,
    // MA pflegt seine Technologien selbst → Herkunft 'ma' (normales Gewicht;
    // hebt einen vorherigen PL-Boost auf).
    technologienQuelle: 'ma',
  };
}

export interface MergeProfilesResult {
  next: Record<string, AnonymerMitarbeiter>;
  /** anonIds bestehender MAs, deren Selbst-Felder aktualisiert wurden. */
  aktualisiert: string[];
  /** anonIds neu materialisierter MAs — Kuerzel IST in der Map, hatte aber noch
   *  keinen `mitarbeiter`-Record (selten, da Auto-Create i.d.R. vorausläuft). */
  neu: string[];
  /** Rohe Kuerzel von Profilen, die KEINEM bekannten MA zugeordnet werden
   *  konnten (Tippfehler, Nicht-TIB-/Admin-Kuerzel, neue Person ohne CSV).
   *  Werden NICHT als Phantom-MA angelegt (das war die Ursache der MA80/MA81-
   *  Geister) — die PL bekommt sie gemeldet und entscheidet selbst. */
  unzuordenbar: string[];
}

/**
 * Merged die Selbst-Profile in die Mitarbeiter-Map.
 *
 * - `kuerzel → anonId` ueber `resolveAnonIdForUser` (NFC-normalisiert +
 *   Mehrfach-Kuerzel-Split "MUE,SCH" + "alle"→null, Pitfall #22).
 * - Bestehender MA: nur die MA-pflegbaren Felder werden ueberschrieben, alle
 *   PL-only-Felder (`jahresKapazitaet`, `abschlagProzent`, `aktiv`,
 *   `abgemeldet`, `antragstypUeberschreibung`, …) bleiben erhalten.
 * - Kuerzel aufloesbar, aber (noch) kein Record: Record am AUFGELOESTEN (Map-)
 *   anonId materialisieren — nie eine frische `nextFreeAnonId` vergeben.
 * - **Unauflösbares Kuerzel: KEIN neuer MA** — gemeldet via `unzuordenbar`.
 *   Ein Self-Service-Profil darf keine neue MA-Identität erzeugen; der
 *   MA-Bestand ergibt sich aus der tib_kuerz-Map (Pitfall #17). Genau dieses
 *   Auto-Anlegen erzeugte zuvor die Geister-MAs (MA80/MA81).
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
  const unzuordenbar: string[] = [];

  for (const p of profile) {
    const mappedId = resolveAnonIdForUser(p.kuerzel, anonymMap);
    if (!mappedId) {
      // Keinem bekannten MA zuzuordnen → NICHT als Phantom-MA anlegen, melden.
      const raw = typeof p.kuerzel === 'string' ? p.kuerzel.trim() : '';
      if (raw) unzuordenbar.push(raw);
      continue;
    }
    const existed = next[mappedId] != null;
    const base = next[mappedId] ?? defaultMitarbeiter(mappedId);
    const self = selfFields(p);
    // MA-Selbst-Profil ist autoritativ → Technologie-Herkunft auf 'ma' setzen
    // (hebt einen vorherigen PL-Boost auf, siehe bm25-matcher).
    next[mappedId] = {
      ...base,
      ...self,
      // Leeres MA-antragstypBevorzugt = "nicht gesetzt" → PL-Vorbelegung
      // erhalten (analog hauptKategorie). Ersetzt wird erst bei nicht-leerem
      // MA-Wert ("Wird ersetzt, sobald der MA seine Antragstypen setzt").
      antragstypBevorzugt: self.antragstypBevorzugt?.length
        ? self.antragstypBevorzugt
        : base.antragstypBevorzugt,
      technologienQuelle: 'ma',
    };
    (existed ? aktualisiert : neu).push(mappedId);
  }

  return { next, aktualisiert, neu, unzuordenbar };
}
