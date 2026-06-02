/**
 * auslastung.json — Load/Save auf den SMB-Share.
 *
 * Schreibt ueber `atomicWrite` (Phase-1a-Infrastruktur) auf den Daten-Share-
 * Handle aus dem `smb-handles`-IDB-Map. NICHT ueber `storage.fs` —
 * StorageService.fs ist ein Legacy-FileServerStore aus dem alten Onboarding,
 * der oft nicht gesetzt ist wenn der User den v1.9-Welcome-Flow benutzt hat.
 *
 * Concurrent-Writes-Strategie: Last-Write-Wins + atomicWrite (TMP + Rename
 * + Backup-Rotation, 1 Generation). In der Praxis schreibt nur die PL aktiv;
 * MAs schreiben nur ihre eigene `manuelleTechnologien`-Liste + ihre
 * Selbsteintragungen.
 */
import type { StorageService } from '@/core/services/storage';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
import {
  AUSLASTUNG_JSON_PATH,
  AUSLASTUNG_JSON_PATH_LEGACY,
  DEFAULT_JAHRESKAPAZITAET,
  emptyAuslastungData,
  type AnonymerMitarbeiter,
  type AspektVorschlag,
  type AuslastungData,
  type KategorieVorschlag,
  type Klassifizierung,
  type PrimaerVorschlag,
} from '../types';
import { normalizeKompetenzMatrix, normalizeKontingent } from './kompetenz-derivation';

async function readJsonAt(
  handle: FileSystemDirectoryHandle,
  path: string,
): Promise<Partial<AuslastungData> | null> {
  const text = await readText(handle, path);
  if (text == null) return null;
  try { return JSON.parse(text) as Partial<AuslastungData>; }
  catch (err) {
    console.warn(`[auslastung-store] JSON-Parse fehlgeschlagen fuer ${path}:`, err);
    return null;
  }
}

/**
 * Liest die Datei oder gibt ein leeres Default zurueck.
 *
 * Liest zuerst den aktuellen Pfad (`_intern/auslastung.json`). Wenn der
 * nicht existiert, Fallback auf den Legacy-Pfad (`_intern/auslastung/data.json`)
 * fuer pre-Mai-2026-Installationen. Beim naechsten Save wird der neue Pfad
 * geschrieben; die Legacy-Datei bleibt liegen (kein Delete-API).
 */
export async function loadAuslastungData(storage: StorageService): Promise<AuslastungData> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) {
    console.warn('[auslastung-store] kein Daten-Share-Handle — leere Daten zurueckgegeben');
    return emptyAuslastungData();
  }
  try {
    const data = await readJsonAt(handle, AUSLASTUNG_JSON_PATH);
    if (data) return normalizeAuslastungData(data);
    const legacy = await readJsonAt(handle, AUSLASTUNG_JSON_PATH_LEGACY);
    if (legacy) {
      console.info(
        '[auslastung-store] Legacy-Pfad gelesen (%s) — wird beim naechsten Save auf %s migriert.',
        AUSLASTUNG_JSON_PATH_LEGACY, AUSLASTUNG_JSON_PATH,
      );
      return normalizeAuslastungData(legacy);
    }
    return emptyAuslastungData();
  } catch (err) {
    console.warn('[auslastung-store] Load fehlgeschlagen, leere Daten zurueckgegeben:', err);
    return emptyAuslastungData();
  }
}

/** Schreibt die Datei via atomicWrite. Wirft falls Daten-Share nicht verbunden. */
export async function saveAuslastungData(
  storage: StorageService,
  data: AuslastungData,
): Promise<AuslastungData> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) throw new Error('Daten-Share nicht verbunden — bitte im Welcome-Screen einrichten.');
  const next: AuslastungData = { ...data, updatedAt: new Date().toISOString() };
  const json = JSON.stringify(next, null, 2);
  await atomicWrite(handle, AUSLASTUNG_JSON_PATH, json);
  return next;
}

/**
 * Stellt sicher dass alle Pflicht-Felder gesetzt sind. Migriert Alt-Datenstaende
 * (fehlende Felder werden mit Defaults gefuellt).
 */
function normalizeAuslastungData(raw: Partial<AuslastungData> | null | undefined): AuslastungData {
  const empty = emptyAuslastungData();
  if (!raw || typeof raw !== 'object') return empty;
  const mergedConfig = { ...empty.config, ...(raw.config ?? {}) };
  // Migration: stage2Aktiv ist seit Mai 2026 immer an (kein User-Toggle mehr).
  // Pre-Migration-Stände mit `false` werden hier hochgezogen.
  mergedConfig.stage2Aktiv = true;
  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : empty.updatedAt,
    config: mergedConfig,
    mitarbeiter: normalizeMitarbeiterRecord(raw.mitarbeiter),
    klassifizierungen: normalizeKlassifizierungArray(raw.klassifizierungen),
    zuweisungen: Array.isArray(raw.zuweisungen) ? raw.zuweisungen : [],
  };
}

/**
 * Migration 1.16 → 1.17 fuer Klassifizierungen: pro Eintrag wird die
 * Multi-Label-Liste (`vorgeschlageneKategorien`/`freigegebeneKategorien`,
 * nur noch im Roh-JSON auf dem SMB-Share — die Interface-Felder sind seit
 * v2.3 entfernt) in die neue Primaer+Aspekte-Struktur transformiert. Bereits
 * migrierte Eintraege werden unveraendert durchgereicht (Idempotenz).
 *
 * Exportiert fuer Unit-Tests.
 */
export function normalizeKlassifizierungArray(raw: unknown): Klassifizierung[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((k: unknown): Klassifizierung | null => {
    if (!k || typeof k !== 'object') return null;
    const obj = k as Partial<Klassifizierung> & {
      vorgeschlageneKategorien?: KategorieVorschlag[];
      freigegebeneKategorien?: string[];
    };
    const altVorgeschlagen = Array.isArray(obj.vorgeschlageneKategorien)
      ? obj.vorgeschlageneKategorien
      : [];
    const altFreigegeben = Array.isArray(obj.freigegebeneKategorien)
      ? obj.freigegebeneKategorien
      : [];

    // Primaer-Vorschlag bestimmen: explizit gesetzt > erstes Element der Alt-Liste.
    let primaer: PrimaerVorschlag | null;
    if (obj.vorgeschlagenePrimaer !== undefined) {
      primaer = obj.vorgeschlagenePrimaer;
    } else if (altVorgeschlagen.length > 0) {
      const top = altVorgeschlagen[0]!;
      primaer = {
        kategorieId: top.kategorieId,
        confidence: top.confidence,
        methode: top.methode,
      };
    } else {
      primaer = null;
    }

    // Aspekte bestimmen: explizit gesetzt > Rest der Alt-Liste.
    let aspekte: AspektVorschlag[];
    if (Array.isArray(obj.vorgeschlageneAspekte)) {
      aspekte = obj.vorgeschlageneAspekte;
    } else if (altVorgeschlagen.length > 1) {
      aspekte = altVorgeschlagen.slice(1).map(v => ({
        kategorieId: v.kategorieId,
        confidence: v.confidence,
      }));
    } else {
      aspekte = [];
    }

    // Freigabe: erste Kategorie = primaer, Rest = aspekte (sofern nicht
    // bereits explizit gesetzt).
    const freiPrimaer = obj.freigegebenePrimaer !== undefined
      ? obj.freigegebenePrimaer
      : (altFreigegeben[0] ?? '');
    const freiAspekte = Array.isArray(obj.freigegebeneAspekte)
      ? obj.freigegebeneAspekte
      : altFreigegeben.slice(1);

    return {
      antragId: typeof obj.antragId === 'string' ? obj.antragId : '',
      vorgeschlagenePrimaer: primaer,
      vorgeschlageneAspekte: aspekte,
      freigegebenePrimaer: freiPrimaer,
      freigegebeneAspekte: freiAspekte,
      status: obj.status === 'freigegeben' ? 'freigegeben' : 'vorgeschlagen',
      freigegebenAm: typeof obj.freigegebenAm === 'string' ? obj.freigegebenAm : undefined,
    };
  }).filter((k): k is Klassifizierung => k !== null && k.antragId.length > 0);
}

/**
 * Migration: setzt Default-Werte fuer Felder die vor Mai 2026 nicht
 * existierten. Konkret aktuell: `aktiv: true` fuer alle bestehenden MAs.
 * PL deaktiviert anschliessend manuell via Admin-Tab oder ueber den
 * Auto-Vorschlag-Banner (`detectAktiveMAs`-Heuristik).
 *
 * Workflow-Revision 1.17: zusaetzlich `hauptKategorie`/`nebenKategorien`/
 * `abschlagProzent` aus dem deprecated `ueberKategorien`-Feld ableiten
 * (nur noch im Roh-JSON auf dem SMB-Share — das Interface-Feld ist seit
 * v2.3 entfernt). Idempotent.
 *  - `ueberKategorien: ['IT','DT']` → haupt='IT', neben=['DT']
 *  - `ueberKategorien: []` oder fehlt → haupt='', neben=[]
 *  - bereits migrierter Datensatz (`hauptKategorie` gesetzt) → unveraendert
 *
 * Exportiert fuer Unit-Tests — Produktiv-Aufrufer gehen ueber
 * `loadAuslastungData()`.
 */
export function normalizeMitarbeiterRecord(
  raw: unknown,
): Record<string, AnonymerMitarbeiter> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, AnonymerMitarbeiter> = {};
  for (const [id, m] of Object.entries(raw as Record<string, Partial<AnonymerMitarbeiter> & { ueberKategorien?: string[] }>)) {
    if (!m || typeof m !== 'object') continue;

    const altKategorien = Array.isArray(m.ueberKategorien) ? m.ueberKategorien : [];

    // Haupt-/Nebenkategorien:
    //  - bevorzugt explizit gesetzte neue Felder (idempotent)
    //  - sonst aus altKategorien[0]/[1..]
    const hauptKategorie = typeof m.hauptKategorie === 'string' && m.hauptKategorie
      ? m.hauptKategorie
      : (altKategorien[0] ?? '');
    const nebenKategorien = Array.isArray(m.nebenKategorien)
      ? m.nebenKategorien
      : altKategorien.slice(1);
    const abschlagProzent = typeof m.abschlagProzent === 'number'
      ? m.abschlagProzent
      : 0;

    out[id] = {
      anonId: typeof m.anonId === 'string' ? m.anonId : id,
      jahresKapazitaet: typeof m.jahresKapazitaet === 'number' ? m.jahresKapazitaet : DEFAULT_JAHRESKAPAZITAET,
      abgemeldet: Array.isArray(m.abgemeldet) ? m.abgemeldet : [],
      manuelleTechnologien: Array.isArray(m.manuelleTechnologien) ? m.manuelleTechnologien : [],
      ausgeblendeteAutoTags: Array.isArray(m.ausgeblendeteAutoTags) ? m.ausgeblendeteAutoTags : [],
      hauptKategorie,
      nebenKategorien,
      abschlagProzent,
      virtuelleProjekte: Array.isArray(m.virtuelleProjekte) ? m.virtuelleProjekte : [],
      profilEmbeddingText: typeof m.profilEmbeddingText === 'string' ? m.profilEmbeddingText : undefined,
      onboardingAbgeschlossen: typeof m.onboardingAbgeschlossen === 'boolean' ? m.onboardingAbgeschlossen : false,
      aktiv: typeof m.aktiv === 'boolean' ? m.aktiv : true,
      // v2.15: PL-Kompetenz-Vorbelegung — additive optionale Felder, nur
      // durchgereicht wenn valide (sonst undefined = wie vor v2.15).
      kompetenzMatrix: normalizeKompetenzMatrix(m.kompetenzMatrix),
      jahresKapazitaetProTyp: normalizeKontingent(m.jahresKapazitaetProTyp),
      kompetenzQuelle: m.kompetenzQuelle === 'pl-upload' ? 'pl-upload' : undefined,
      technologienQuelle: m.technologienQuelle === 'pl' || m.technologienQuelle === 'ma'
        ? m.technologienQuelle
        : undefined,
    };
  }
  return out;
}
