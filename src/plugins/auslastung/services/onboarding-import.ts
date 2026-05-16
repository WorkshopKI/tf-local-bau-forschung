/**
 * Onboarding-XLSX-Import.
 *
 * Liest die XLSX-Datei aus der Standalone-Onboarding-App, validiert das
 * Kuerzel + extrahiert Profil/Bewertungen/Technologien und erstellt ein
 * Preview-Objekt fuer die UI.
 *
 * Wenn das Kuerzel in der bestehenden anonymMap auftaucht (= MA hat schon
 * historische Antraege), wird `existierterAnonId` gesetzt und der Caller
 * (OnboardingImportDialog) zeigt einen Kalibrierungs-Pfad an.
 *
 * Andernfalls wird beim `applyOnboardingImport` ein neuer anonymer MA
 * angelegt (naechste freie MAxx-Nummer).
 */
import * as XLSX from 'xlsx';
import type { StorageService } from '@/core/services/storage';
import type {
  AnonymerMitarbeiter,
  AuslastungData,
  OnboardingBewertung,
  OnboardingBewertungEintrag,
  UeberKategorie,
  VirtuellesProjekt,
} from '../types';
import { DEFAULT_JAHRESKAPAZITAET, ONBOARDING_CONFIDENCE } from '../types';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { nextFreeAnonId, normalizeKuerzel, type AnonymMap } from './anonym-map';

const SHEET_PROFIL_ALIASES = ['profil', 'profile'];
const SHEET_BEWERTUNGEN_ALIASES = ['antrags-bewertungen', 'bewertungen', 'antragsbewertungen'];
const SHEET_TECH_ALIASES = ['manuelle technologien', 'technologien'];

export interface OnboardingPreview {
  filename: string;
  /** Kuerzel aus Dateiname (`onboarding-MUE.xlsx` -> "MUE"). */
  kuerzelAusDatei?: string;
  /** Kuerzel aus Sheet 1, Zeile "Kuerzel". */
  kuerzelAusSheet?: string;
  kuerzelMatch: 'identisch' | 'abweichend' | 'fehlend';
  /** Final genutztes Kuerzel (uppercase). */
  effektivesKuerzel?: string;
  /** Wenn das Kuerzel schon in der AnonymMap ist (= bestehender MA mit hist. Antraegen). */
  existierterAnonId?: string;
  /** Falls neuer MA: die naechste freie MA-ID. */
  vorgeschlageneAnonId?: string;
  fachrichtung?: string;
  abschluss?: string;
  profilFreitext?: string;
  bewertungen: OnboardingBewertungEintrag[];
  manuelleTechnologien: string[];
  abgeleiteteUeberKategorien: string[];
  /** Counts pro Bewertungs-Typ. */
  counts: { kann_ich: number; teilweise: number; nicht_meins: number };
  errors: string[];
  warnings: string[];
}

function extractKuerzelFromFilename(filename: string): string | undefined {
  const m = filename.match(/onboarding[-_]([A-Za-zÄÖÜäöüß]{2,8})\.xlsx?$/i);
  return m ? m[1]!.toUpperCase() : undefined;
}

function findSheet(wb: XLSX.WorkBook, aliases: string[]): XLSX.WorkSheet | null {
  const names = Object.keys(wb.Sheets);
  for (const a of aliases) {
    const found = names.find(n => n.toLowerCase().trim() === a);
    if (found) return wb.Sheets[found]!;
  }
  // Substring fallback
  for (const a of aliases) {
    const found = names.find(n => n.toLowerCase().includes(a));
    if (found) return wb.Sheets[found]!;
  }
  return null;
}

function readProfilSheet(sheet: XLSX.WorkSheet): { kuerzel?: string; fachrichtung?: string; abschluss?: string; freitext?: string; ueberKategorien?: string } {
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, raw: false });
  const result: Record<string, string> = {};
  for (const row of rows) {
    const key = String(row[0] ?? '').toLowerCase().trim();
    const val = String(row[1] ?? '').trim();
    if (!key || !val) continue;
    if (key.includes('kürzel') || key.includes('kuerzel')) result.kuerzel = val.toUpperCase();
    else if (key.includes('fachrichtung')) result.fachrichtung = val;
    else if (key.includes('abschluss')) result.abschluss = val;
    else if (key.includes('freitext') || key.includes('schwerpunkt')) result.freitext = val;
    else if (key.includes('überkategorien') || key.includes('ueberkategorien') || key.includes('kategorien')) result.ueberKategorien = val;
  }
  return result;
}

function normalizeBewertung(raw: string): OnboardingBewertung | null {
  const v = raw.toLowerCase().trim();
  if (v.includes('kann') || v === 'ja' || v === 'yes') return 'kann_ich';
  if (v.includes('teilweise') || v.includes('teilw')) return 'teilweise';
  if (v.includes('nicht') || v === 'nein' || v === 'no') return 'nicht_meins';
  return null;
}

function readBewertungenSheet(sheet: XLSX.WorkSheet): OnboardingBewertungEintrag[] {
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, raw: false });
  if (rows.length === 0) return [];
  const header = rows[0]!.map(h => String(h ?? '').toLowerCase().trim());
  const iAz = header.findIndex(h => h.includes('aktenzeichen') || h === 'az' || h === 'fkz');
  const iKat = header.findIndex(h => h === 'kategorie' || h.includes('deskript'));
  const iUe = header.findIndex(h => h.includes('überkategorie') || h.includes('ueberkategorie'));
  const iTitel = header.findIndex(h => h.includes('titel'));
  const iBew = header.findIndex(h => h.includes('bewertung') || h.includes('antwort'));
  const out: OnboardingBewertungEintrag[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    const az = iAz >= 0 ? String(row[iAz] ?? '').trim() : '';
    if (!az) continue;
    const bew = iBew >= 0 ? normalizeBewertung(String(row[iBew] ?? '')) : null;
    if (!bew) continue;
    out.push({
      aktenzeichen: az,
      kategorie: iKat >= 0 ? String(row[iKat] ?? '').trim() : '',
      ueberKategorie: iUe >= 0 ? String(row[iUe] ?? '').trim() || undefined : undefined,
      vbTitel: iTitel >= 0 ? String(row[iTitel] ?? '').trim() || undefined : undefined,
      bewertung: bew,
    });
  }
  return out;
}

function readTechSheet(sheet: XLSX.WorkSheet): string[] {
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, raw: false });
  if (rows.length === 0) return [];
  // Single-column oder mehrspaltig
  const out = new Set<string>();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    for (const cell of row) {
      const v = String(cell ?? '').trim();
      if (v) out.add(v);
    }
  }
  return [...out];
}

/**
 * Leitet die Ueberkategorien aus den "Kann ich"-Antworten ab.
 *
 * Logik: pro Bewertung mit `kann_ich` zaehlen wir die Ueberkategorie
 * (entweder direkt aus `bewertung.ueberKategorie` oder via
 * Deskriptoren-Mapping aus `bewertung.kategorie`). Alle mit count >= 3
 * landen in der Liste.
 */
export function deriveUeberKategorien(
  bewertungen: OnboardingBewertungEintrag[],
  kategorien: UeberKategorie[],
  threshold = 3,
): string[] {
  const count = new Map<string, number>();
  const descLookup = new Map<string, string[]>();
  for (const k of kategorien) {
    for (const d of k.deskriptorenMapping) {
      const key = d.toLowerCase();
      const existing = descLookup.get(key) ?? [];
      existing.push(k.id);
      descLookup.set(key, existing);
    }
  }
  for (const b of bewertungen) {
    if (b.bewertung !== 'kann_ich') continue;
    if (b.ueberKategorie) {
      count.set(b.ueberKategorie, (count.get(b.ueberKategorie) ?? 0) + 1);
    } else if (b.kategorie) {
      const mapped = descLookup.get(b.kategorie.toLowerCase()) ?? [];
      for (const id of mapped) {
        count.set(id, (count.get(id) ?? 0) + 1);
      }
    }
  }
  return [...count.entries()]
    .filter(([, c]) => c >= threshold)
    .map(([id]) => id);
}

/** Hauptpfad: Datei parsen + Preview bauen. */
export async function parseOnboardingXlsx(
  file: File,
  ctx: { anonymMap: AnonymMap; data: AuslastungData },
): Promise<OnboardingPreview> {
  const buf = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    wb = XLSX.read(buf, { type: 'array' });
  } catch (err) {
    errors.push(`Datei kann nicht gelesen werden: ${err instanceof Error ? err.message : String(err)}`);
    return {
      filename: file.name,
      kuerzelMatch: 'fehlend',
      bewertungen: [],
      manuelleTechnologien: [],
      abgeleiteteUeberKategorien: [],
      counts: { kann_ich: 0, teilweise: 0, nicht_meins: 0 },
      errors,
      warnings,
    };
  }

  const kuerzelAusDatei = extractKuerzelFromFilename(file.name);
  const profilSheet = findSheet(wb, SHEET_PROFIL_ALIASES);
  const bewSheet = findSheet(wb, SHEET_BEWERTUNGEN_ALIASES);
  const techSheet = findSheet(wb, SHEET_TECH_ALIASES);

  if (!profilSheet) errors.push('Sheet "Profil" fehlt');
  if (!bewSheet) errors.push('Sheet "Antrags-Bewertungen" fehlt');

  const profil = profilSheet ? readProfilSheet(profilSheet) : {};
  const kuerzelAusSheet = profil.kuerzel;
  const bewertungen = bewSheet ? readBewertungenSheet(bewSheet) : [];
  const manuelleTechnologien = techSheet ? readTechSheet(techSheet) : [];

  // Kuerzel-Match
  let kuerzelMatch: OnboardingPreview['kuerzelMatch'];
  let effektivesKuerzel: string | undefined;
  if (kuerzelAusDatei && kuerzelAusSheet) {
    if (kuerzelAusDatei === kuerzelAusSheet) {
      kuerzelMatch = 'identisch';
      effektivesKuerzel = kuerzelAusDatei;
    } else {
      kuerzelMatch = 'abweichend';
      warnings.push(`Kuerzel aus Dateiname ("${kuerzelAusDatei}") und Sheet ("${kuerzelAusSheet}") stimmen nicht ueberein.`);
      effektivesKuerzel = kuerzelAusSheet;   // Sheet hat Prioritaet
    }
  } else if (kuerzelAusDatei) {
    kuerzelMatch = 'fehlend';
    warnings.push('Kein Kuerzel im Profil-Sheet gefunden — Dateiname wird verwendet.');
    effektivesKuerzel = kuerzelAusDatei;
  } else if (kuerzelAusSheet) {
    kuerzelMatch = 'fehlend';
    warnings.push('Kuerzel im Dateinamen fehlt — Sheet-Wert wird verwendet.');
    effektivesKuerzel = kuerzelAusSheet;
  } else {
    kuerzelMatch = 'fehlend';
    errors.push('Kein Kuerzel gefunden — weder im Dateinamen noch im Profil-Sheet.');
  }

  // AnonId aufloesen
  let existierterAnonId: string | undefined;
  let vorgeschlageneAnonId: string | undefined;
  if (effektivesKuerzel) {
    const norm = normalizeKuerzel(effektivesKuerzel) ?? undefined;
    if (norm) {
      const existing = ctx.anonymMap.toAnon.get(norm);
      if (existing) existierterAnonId = existing;
      else vorgeschlageneAnonId = nextFreeAnonId(Object.keys(ctx.data.mitarbeiter));
    }
  }

  const counts = {
    kann_ich: bewertungen.filter(b => b.bewertung === 'kann_ich').length,
    teilweise: bewertungen.filter(b => b.bewertung === 'teilweise').length,
    nicht_meins: bewertungen.filter(b => b.bewertung === 'nicht_meins').length,
  };
  const abgeleitet = deriveUeberKategorien(bewertungen, ctx.data.config.ueberKategorien);

  // Auf "ueberKategorien" aus Profil-Sheet auch achten
  if (profil.ueberKategorien) {
    for (const raw of profil.ueberKategorien.split(/[,;]/)) {
      const id = raw.trim();
      if (id && !abgeleitet.includes(id)) abgeleitet.push(id);
    }
  }

  return {
    filename: file.name,
    kuerzelAusDatei,
    kuerzelAusSheet,
    kuerzelMatch,
    effektivesKuerzel,
    existierterAnonId,
    vorgeschlageneAnonId,
    fachrichtung: profil.fachrichtung,
    abschluss: profil.abschluss,
    profilFreitext: profil.freitext,
    bewertungen,
    manuelleTechnologien,
    abgeleiteteUeberKategorien: abgeleitet,
    counts,
    errors,
    warnings,
  };
}

/**
 * Wendet einen Preview an: schreibt MA-Profil in `auslastung.json`.
 *
 * Wenn `preview.existierterAnonId` gesetzt ist, wird der bestehende MA
 * mit virtuellen Projekten ergaenzt — sein Profil bleibt aber erhalten
 * (PL kann manuell entscheiden).
 */
export async function applyOnboardingImport(
  storage: StorageService,
  preview: OnboardingPreview,
  overrideUeberKategorien?: string[],
): Promise<{ anonId: string; neu: boolean }> {
  if (preview.errors.length > 0) {
    throw new Error('Preview hat Fehler: ' + preview.errors.join('; '));
  }
  const state = useAuslastungData.getState();
  const data = state.data;
  const anonId = preview.existierterAnonId ?? preview.vorgeschlageneAnonId;
  if (!anonId) throw new Error('Keine anonId aufloesbar');

  const virtuelleProjekte: VirtuellesProjekt[] = [];
  for (const b of preview.bewertungen) {
    if (b.bewertung === 'nicht_meins') continue;
    const confidence = ONBOARDING_CONFIDENCE[b.bewertung];
    virtuelleProjekte.push({ antragId: b.aktenzeichen, confidence });
  }

  const ueberKategorien = overrideUeberKategorien ?? preview.abgeleiteteUeberKategorien;
  const existing = data.mitarbeiter[anonId];

  const next: AnonymerMitarbeiter = existing ? {
    ...existing,
    virtuelleProjekte,
    profilEmbeddingText: preview.profilFreitext ?? existing.profilEmbeddingText,
    manuelleTechnologien: mergeTags(existing.manuelleTechnologien, preview.manuelleTechnologien),
    // Bestehende ueberKategorien NICHT ueberschreiben (PL hat ggf. manuell justiert)
    ueberKategorien: existing.ueberKategorien.length > 0 ? existing.ueberKategorien : ueberKategorien,
    onboardingAbgeschlossen: true,
  } : {
    anonId,
    jahresKapazitaet: DEFAULT_JAHRESKAPAZITAET,
    abgemeldet: [],
    manuelleTechnologien: preview.manuelleTechnologien,
    ueberKategorien,
    virtuelleProjekte,
    profilEmbeddingText: preview.profilFreitext,
    onboardingAbgeschlossen: true,
  };

  await state.upsertMitarbeiter(storage, next);
  return { anonId, neu: !existing };
}

function mergeTags(a: string[], b: string[]): string[] {
  const set = new Set<string>();
  for (const v of [...a, ...b]) {
    const t = v.trim();
    if (t) set.add(t);
  }
  return [...set];
}
