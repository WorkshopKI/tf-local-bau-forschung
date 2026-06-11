/**
 * Persistenz der Skill-Registry (Muster: `feedbackSharedFile.ts`).
 *
 * Ablage: `_intern/skills/registry.json` auf dem Daten-Share (Skills + Regeln
 * gemeinsam). Schreiben self-gated über `queryPermission` (nur Rollen mit
 * readwrite: Kurator/PL/dev). Sidecar-Profil (Pitfall #23): idempotent-
 * overwrite mit Backup-Rotation (Default von `atomicWrite`).
 *
 * IDB-Cache im generischen `kv`-Store (Key `skill-registry:cache`) — KEIN
 * dedizierter Object-Store/Version-Bump (vgl. `kurzfassung-store.ts`: ein Bump
 * triggert unter file:// mit parallel offenen Varianten ein `onblocked`-Upgrade).
 */
import type { StorageService } from '@/core/services/storage';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { getDatenShareHandle, queryPermission } from '@/core/services/infrastructure/smb-handle';
import type { QualitaetsRegel, Schweregrad, SkillModifierKey, SkillRecord, SkillRegistryFile } from './types';
import { SEED_REGISTRY } from './seed';

export const SKILL_REGISTRY_PATH = '_intern/skills/registry.json';
export const SKILL_REGISTRY_CACHE_KEY = 'skill-registry:cache';

/* -------------------------------------------------------------------------- */
/* Tolerante Normalisierung (unbekannte Felder ignorieren, fehlende defaulten) */
/* -------------------------------------------------------------------------- */

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}
function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
function asSchweregrad(v: unknown): Schweregrad {
  return v === 'fehler' ? 'fehler' : 'hinweis';
}

function normalizeRegel(raw: unknown): QualitaetsRegel | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = asString(r.id);
  if (!id) return null;
  const ts = asString(r.geaendert_am) || asString(r.erstellt_am) || SEED_REGISTRY.updated_at;
  return {
    id,
    name: asString(r.name, id),
    typ: asString(r.typ),
    params: typeof r.params === 'object' && r.params !== null ? (r.params as Record<string, unknown>) : {},
    schweregrad: asSchweregrad(r.schweregrad),
    aktiv: asBool(r.aktiv, true),
    erstellt_am: asString(r.erstellt_am, ts),
    geaendert_am: asString(r.geaendert_am, ts),
  };
}

const EMPTY_MODIFIERS: Record<SkillModifierKey, string> = { neu: '', kuerzer: '', laenger: '' };

function normalizeModifiers(raw: unknown): Record<SkillModifierKey, string> {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY_MODIFIERS };
  const m = raw as Record<string, unknown>;
  return {
    neu: asString(m.neu),
    kuerzer: asString(m.kuerzer),
    laenger: asString(m.laenger),
  };
}

function normalizeSkill(raw: unknown): SkillRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;
  const id = asString(s.id);
  if (!id) return null;
  const skill: SkillRecord = {
    id,
    name: asString(s.name, id),
    beschreibung: asString(s.beschreibung),
    version: asNumber(s.version, 1),
    promptTemplate: asString(s.promptTemplate),
    modifiers: normalizeModifiers(s.modifiers),
    regelIds: asStringArray(s.regelIds),
    slots: asStringArray(s.slots),
    geaendert_am: asString(s.geaendert_am, SEED_REGISTRY.updated_at),
  };
  if (typeof s.systemPrompt === 'string') skill.systemPrompt = s.systemPrompt;
  if (typeof s.maxTokens === 'number' && Number.isFinite(s.maxTokens)) skill.maxTokens = s.maxTokens;
  return skill;
}

/** Validiert + normalisiert einen rohen Datei-Inhalt; `null` bei Strukturfehler. */
export function normalizeRegistryFile(raw: unknown): SkillRegistryFile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const f = raw as Record<string, unknown>;
  if (f.version !== 1) return null;
  if (!Array.isArray(f.skills) || !Array.isArray(f.regeln)) return null;
  return {
    version: 1,
    updated_at: asString(f.updated_at, SEED_REGISTRY.updated_at),
    skills: f.skills.map(normalizeSkill).filter((s): s is SkillRecord => s !== null),
    regeln: f.regeln.map(normalizeRegel).filter((r): r is QualitaetsRegel => r !== null),
  };
}

/* -------------------------------------------------------------------------- */
/* Share-IO + IDB-Cache                                                        */
/* -------------------------------------------------------------------------- */

/** Liest die Registry vom Daten-Share (`null` wenn fehlend/offline/kaputt). */
export async function readSkillRegistry(storage: StorageService): Promise<SkillRegistryFile | null> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) return null;
  const text = await readText(handle, SKILL_REGISTRY_PATH);
  if (text == null) return null;
  try {
    return normalizeRegistryFile(JSON.parse(text));
  } catch (err) {
    console.warn('[skill-registry] readSkillRegistry parse failed:', err);
    return null;
  }
}

/**
 * Schreibt die Registry atomar auf den Share. Self-gated: nur Clients mit
 * readwrite-Berechtigung schreiben tatsächlich (sonst No-op → `false`).
 * Audit-Logging übernimmt der Aufrufer (kennt die Identität).
 */
export async function writeSkillRegistry(storage: StorageService, file: SkillRegistryFile): Promise<boolean> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) return false;
  if ((await queryPermission(handle)) !== 'granted') return false;
  try {
    const payload: SkillRegistryFile = { ...file, version: 1, updated_at: new Date().toISOString() };
    await atomicWrite(handle, SKILL_REGISTRY_PATH, JSON.stringify(payload, null, 2));
    await cacheSkillRegistry(storage.idb, payload);
    return true;
  } catch (err) {
    console.error('[skill-registry] writeSkillRegistry failed:', err);
    return false;
  }
}

export async function cacheSkillRegistry(idb: IDBStore, file: SkillRegistryFile): Promise<void> {
  await idb.set(SKILL_REGISTRY_CACHE_KEY, file);
}

export async function readCachedSkillRegistry(idb: IDBStore): Promise<SkillRegistryFile | null> {
  const cached = await idb.get<SkillRegistryFile>(SKILL_REGISTRY_CACHE_KEY);
  return cached ? normalizeRegistryFile(cached) : null;
}

export interface LoadedRegistry {
  file: SkillRegistryFile;
  /** Woher der aktuelle Stand kommt — steuert Seed-on-open + Stale-Hinweis. */
  source: 'share' | 'cache' | 'seed';
  /** True, wenn der Stand aus dem IDB-Cache stammt (Share nicht erreichbar). */
  stale: boolean;
}

/**
 * Lädt die Registry: Share → bei Treffer cachen; sonst IDB-Cache (stale);
 * sonst der In-Memory-Seed (read-only, „noch nicht kuratiert"). Der Aufrufer
 * persistiert den Seed nur bei `source === 'seed'` und Schreibrecht.
 */
export async function loadSkillRegistry(storage: StorageService): Promise<LoadedRegistry> {
  const share = await readSkillRegistry(storage);
  if (share) {
    await cacheSkillRegistry(storage.idb, share);
    return { file: share, source: 'share', stale: false };
  }
  const cached = await readCachedSkillRegistry(storage.idb);
  if (cached) return { file: cached, source: 'cache', stale: true };
  return { file: SEED_REGISTRY, source: 'seed', stale: false };
}
