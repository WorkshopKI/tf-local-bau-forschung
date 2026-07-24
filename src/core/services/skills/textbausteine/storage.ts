/**
 * Persistenz des Textbaustein-Katalogs — Muster `registry/storage.ts`.
 *
 * Ablage: **eigene** Sidecar-Datei `_intern/skills/textbausteine.json` neben der
 * Registry, nicht in ihr. Grund: kleinere Write-Konflikt-Fläche (Baustein-Pflege und
 * Skill-Pflege sind verschiedene Tätigkeiten, oft verschiedener Personen) und
 * `registry.json` bleibt unangetastet.
 *
 * Sidecar-Profil (Pitfall #23): idempotent-overwrite mit Backup-Rotation (Default von
 * `atomicWrite`). Schreiben self-gated über `queryPermission` — nur Rollen mit
 * readwrite (Kurator/PL/dev) schreiben tatsächlich, alle anderen laufen als No-op.
 *
 * IDB-Cache im generischen `kv`-Store (Key `textbaustein-katalog:cache`) — KEIN
 * dedizierter Object-Store und kein DB-Version-Bump (ein Bump triggert unter `file://`
 * mit parallel offenen Varianten ein `onblocked`-Upgrade).
 *
 * Tolerante Normalisierung: unbekannte Felder fallen weg, fehlende bekommen Defaults,
 * kaputte Einträge werden übersprungen statt zu werfen. Ein von Hand editiertes JSON
 * darf die Werkbank nicht lahmlegen.
 */
import type { StorageService } from '@/core/services/storage';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { getDatenShareHandle, queryPermission } from '@/core/services/infrastructure/smb-handle';
import { extractPlatzhalter, type NfScope } from '../registry/nf-bausteine.seed';
import { MAX_HISTORIE } from '../registry/versioning';
import { leererKatalog, mergeFehlendeNfBausteine, NF_MIGRATION_TS } from './migration';
import type {
  BausteinArtefaktTyp, BausteinStatus, TextbausteinKatalog, TextbausteinRecord, TextbausteinSnapshot,
} from './types';

export const TEXTBAUSTEIN_PATH = '_intern/skills/textbausteine.json';
export const TEXTBAUSTEIN_CACHE_KEY = 'textbaustein-katalog:cache';

/* -------------------------------------------------------------------------- */
/* Tolerante Normalisierung                                                    */
/* -------------------------------------------------------------------------- */

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
function asArtefaktTyp(v: unknown): BausteinArtefaktTyp {
  return v === 'rne' || v === 'abl' ? v : 'nf';
}
/** Fail-safe: alles Unbekannte gilt als `entwurf` — nie versehentlich freigegeben. */
function asStatus(v: unknown): BausteinStatus {
  return v === 'freigegeben' || v === 'stillgelegt' ? v : 'entwurf';
}
function asVersion(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 1 ? Math.floor(v) : 1;
}
/** `scope` nur bei explizitem, gültigem Wert (rne/abl dürfen ohne auskommen). */
function asScope(v: unknown): NfScope | null {
  return v === 'verbund' || v === 'tv' ? v : null;
}

function normalizeSnapshot(raw: unknown): TextbausteinSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;
  const snap: TextbausteinSnapshot = {
    version: asVersion(s.version),
    thema: asString(s.thema),
    kategorie: asString(s.kategorie),
    text: asString(s.text),
    aspekte: asStringArray(s.aspekte),
    stichworte: asStringArray(s.stichworte),
    status: asStatus(s.status),
    geaendertAm: asString(s.geaendertAm, NF_MIGRATION_TS),
  };
  const von = asString(s.geaendertVon).trim();
  if (von) snap.geaendertVon = von;
  const grund = asString(s.begruendung).trim();
  if (grund) snap.begruendung = grund;
  return snap;
}

/**
 * Historie tolerant lesen + kappen. Fehlt sie, entsteht GENAU EIN Baseline-Eintrag
 * aus dem aktuellen Stand — so hält die Invariante `historie[0]` ≙ Record auch für
 * von Hand geschriebene Einträge.
 */
function normalizeHistorie(raw: unknown, current: TextbausteinRecord): TextbausteinSnapshot[] {
  if (Array.isArray(raw)) {
    const entries = raw
      .map(normalizeSnapshot)
      .filter((e): e is TextbausteinSnapshot => e !== null)
      .slice(0, MAX_HISTORIE);
    if (entries.length > 0) return entries;
  }
  return [{
    version: current.version,
    thema: current.thema,
    kategorie: current.kategorie,
    text: current.text,
    aspekte: [...current.aspekte],
    stichworte: [...current.stichworte],
    status: current.status,
    geaendertAm: current.geaendertAm,
    ...(current.geaendertVon ? { geaendertVon: current.geaendertVon } : {}),
  }];
}

/**
 * Ein Baustein. `null` bei fehlender `id` oder leerem `text` — ein Baustein ohne
 * Rechtstext ist kein Baustein, sondern ein Datenfehler.
 *
 * `platzhalter` wird IMMER neu abgeleitet und nie aus der Datei übernommen: der
 * verbatim-Text ist die einzige Quelle, alles andere wäre eine zweite, driftende.
 */
export function normalizeBaustein(raw: unknown): TextbausteinRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  const id = asString(b.id).trim();
  const text = asString(b.text);
  if (!id || !text) return null;

  const rec: TextbausteinRecord = {
    id,
    artefaktTyp: asArtefaktTyp(b.artefaktTyp),
    thema: asString(b.thema, id),
    kategorie: asString(b.kategorie),
    aspekte: asStringArray(b.aspekte),
    stichworte: asStringArray(b.stichworte),
    text,
    platzhalter: extractPlatzhalter(text),
    status: asStatus(b.status),
    version: asVersion(b.version),
    historie: [],
    geaendertAm: asString(b.geaendertAm, NF_MIGRATION_TS),
  };
  const scope = asScope(b.scope);
  if (scope) rec.scope = scope;
  const von = asString(b.geaendertVon).trim();
  if (von) rec.geaendertVon = von;
  rec.historie = normalizeHistorie(b.historie, rec);
  return rec;
}

/** Validiert + normalisiert einen rohen Datei-Inhalt; `null` bei Strukturfehler. */
export function normalizeKatalog(raw: unknown): TextbausteinKatalog | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const f = raw as Record<string, unknown>;
  if (f.version !== 1) return null;
  if (!Array.isArray(f.bausteine)) return null;
  return {
    version: 1,
    updated_at: asString(f.updated_at, NF_MIGRATION_TS),
    bausteine: f.bausteine.map(normalizeBaustein).filter((b): b is TextbausteinRecord => b !== null),
  };
}

/* -------------------------------------------------------------------------- */
/* Share-IO + IDB-Cache                                                        */
/* -------------------------------------------------------------------------- */

/** Liest den Katalog vom Daten-Share (`null` wenn fehlend/offline/kaputt). */
export async function readTextbausteinKatalog(storage: StorageService): Promise<TextbausteinKatalog | null> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) return null;
  const text = await readText(handle, TEXTBAUSTEIN_PATH);
  if (text == null) return null;
  try {
    return normalizeKatalog(JSON.parse(text));
  } catch (err) {
    console.warn('[textbausteine] readTextbausteinKatalog parse failed:', err);
    return null;
  }
}

/**
 * Schreibt den Katalog atomar auf den Share. Self-gated: nur Clients mit
 * readwrite-Berechtigung schreiben tatsächlich (sonst No-op → `false`).
 * Audit-Logging übernimmt der Aufrufer (kennt die Identität).
 */
export async function writeTextbausteinKatalog(
  storage: StorageService, katalog: TextbausteinKatalog,
): Promise<boolean> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) return false;
  if ((await queryPermission(handle)) !== 'granted') return false;
  try {
    const payload: TextbausteinKatalog = { ...katalog, version: 1, updated_at: new Date().toISOString() };
    await atomicWrite(handle, TEXTBAUSTEIN_PATH, JSON.stringify(payload, null, 2));
    await cacheTextbausteinKatalog(storage.idb, payload);
    return true;
  } catch (err) {
    console.error('[textbausteine] writeTextbausteinKatalog failed:', err);
    return false;
  }
}

export async function cacheTextbausteinKatalog(idb: IDBStore, katalog: TextbausteinKatalog): Promise<void> {
  await idb.set(TEXTBAUSTEIN_CACHE_KEY, katalog);
}

export async function readCachedTextbausteinKatalog(idb: IDBStore): Promise<TextbausteinKatalog | null> {
  const cached = await idb.get<TextbausteinKatalog>(TEXTBAUSTEIN_CACHE_KEY);
  return cached ? normalizeKatalog(cached) : null;
}

export interface GeladenerKatalog {
  katalog: TextbausteinKatalog;
  /** Woher der Stand kommt — steuert Rückschreiben + Stale-Hinweis. */
  quelle: 'share' | 'cache' | 'seed';
  /** True, wenn der Stand aus dem IDB-Cache stammt (Share nicht erreichbar). */
  stale: boolean;
  /**
   * Durch die NF-Seed-Migration ergänzte IDs (leer = nichts ergänzt). Bei
   * `quelle === 'share'` + Schreibrecht sollte der Aufrufer zurückschreiben.
   */
  ergaenzt: string[];
}

/**
 * Lädt den Katalog: Share → bei Treffer cachen; sonst IDB-Cache (stale); sonst ein
 * leerer Katalog. Auf JEDEM Pfad werden fehlende NF-Seed-Bausteine additiv ergänzt —
 * eine fehlende Datei heilt sich damit selbst, ohne je etwas zu überschreiben.
 */
export async function loadTextbausteinKatalog(storage: StorageService): Promise<GeladenerKatalog> {
  const share = await readTextbausteinKatalog(storage);
  if (share) {
    const { katalog, ergaenzt } = mergeFehlendeNfBausteine(share);
    await cacheTextbausteinKatalog(storage.idb, katalog);
    return { katalog, quelle: 'share', stale: false, ergaenzt };
  }
  const cached = await readCachedTextbausteinKatalog(storage.idb);
  if (cached) {
    const { katalog, ergaenzt } = mergeFehlendeNfBausteine(cached);
    return { katalog, quelle: 'cache', stale: true, ergaenzt };
  }
  const { katalog, ergaenzt } = mergeFehlendeNfBausteine(leererKatalog());
  return { katalog, quelle: 'seed', stale: false, ergaenzt };
}
