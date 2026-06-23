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
import type {
  ArtefaktTyp, GateExpr, Pruefart, QualitaetsRegel, Reifegrad, Schweregrad, SkillModifierKey,
  SkillRecord, SkillRegistryFile, SkillVersionSnapshot, WorkflowDef, WorkflowEbene, WorkflowStep,
  WorkflowStepRolle,
} from './types';
import { normalizeStepRolle } from './workflow-steps';
import { MAX_HISTORIE } from './versioning';
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
function asReifegrad(v: unknown): Reifegrad {
  return v === 'erprobt' || v === 'empfohlen' ? v : 'entwurf';
}
/** Gültige `Pruefart` oder `null` (additiv: nur bei explizitem, gültigem Wert setzen → kein Daten-Drift). */
function asPruefart(v: unknown): Pruefart | null {
  return v === 'textlich' || v === 'fachlich' || v === 'administrativ' ? v : null;
}
/** Gültiger `ArtefaktTyp` oder `null` (nur bei explizitem Wert setzen → GA bleibt feld-frei/byte-identisch). */
function asArtefaktTyp(v: unknown): ArtefaktTyp | null {
  return v === 'ga' || v === 'nf' || v === 'abl' || v === 'rne' ? v : null;
}
/** Gültige `WorkflowEbene` oder `null` (nur bei explizitem Wert setzen). */
function asWorkflowEbene(v: unknown): WorkflowEbene | null {
  return v === 'verbund' || v === 'tv' ? v : null;
}

function normalizeRegel(raw: unknown): QualitaetsRegel | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = asString(r.id);
  if (!id) return null;
  const ts = asString(r.geaendert_am) || asString(r.erstellt_am) || SEED_REGISTRY.updated_at;
  const regel: QualitaetsRegel = {
    id,
    name: asString(r.name, id),
    typ: asString(r.typ),
    params: typeof r.params === 'object' && r.params !== null ? (r.params as Record<string, unknown>) : {},
    schweregrad: asSchweregrad(r.schweregrad),
    aktiv: asBool(r.aktiv, true),
    erstellt_am: asString(r.erstellt_am, ts),
    geaendert_am: asString(r.geaendert_am, ts),
  };
  const pruefart = asPruefart(r.pruefart);
  if (pruefart) regel.pruefart = pruefart;
  // Explizite Kurator-Kategorie tolerant durchlassen (nur nicht-leerer String);
  // der abgeleitete Default bleibt Laufzeit-Logik, wird NIE in die Daten geschrieben.
  const kategorie = asString(r.kategorie).trim();
  if (kategorie) regel.kategorie = kategorie;
  return regel;
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

function normalizeSnapshot(raw: unknown): SkillVersionSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;
  const snap: SkillVersionSnapshot = {
    version: asNumber(s.version, 1),
    promptTemplate: asString(s.promptTemplate),
    regelIds: asStringArray(s.regelIds),
    modifiers: normalizeModifiers(s.modifiers),
    geaendert_am: asString(s.geaendert_am, SEED_REGISTRY.updated_at),
  };
  if (typeof s.userId === 'string' && s.userId) snap.userId = s.userId;
  if (typeof s.begruendung === 'string' && s.begruendung) snap.begruendung = s.begruendung;
  return snap;
}

/**
 * Versions-Historie tolerant lesen + auf `MAX_HISTORIE` kappen. Fehlt/leer →
 * genau ein Baseline-Eintrag aus dem aktuellen Stand (verlustfreie Migration;
 * hält die Invariante `historie[0]` ≙ Record auch für Alt-Records).
 */
function normalizeHistorie(raw: unknown, current: SkillRecord): SkillVersionSnapshot[] {
  if (Array.isArray(raw)) {
    const entries = raw
      .map(normalizeSnapshot)
      .filter((e): e is SkillVersionSnapshot => e !== null)
      .slice(0, MAX_HISTORIE);
    if (entries.length > 0) return entries;
  }
  return [{
    version: current.version,
    promptTemplate: current.promptTemplate,
    regelIds: [...current.regelIds],
    modifiers: { ...current.modifiers },
    geaendert_am: current.geaendert_am,
  }];
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
    reifegrad: asReifegrad(s.reifegrad),
  };
  skill.historie = normalizeHistorie(s.historie, skill);
  if (typeof s.systemPrompt === 'string') skill.systemPrompt = s.systemPrompt;
  if (typeof s.maxTokens === 'number' && Number.isFinite(s.maxTokens)) skill.maxTokens = s.maxTokens;
  if (typeof s.lektorPromptTemplate === 'string') skill.lektorPromptTemplate = s.lektorPromptTemplate;
  if (typeof s.enthaeltDokumentInhalte === 'boolean') skill.enthaeltDokumentInhalte = s.enthaeltDokumentInhalte;
  return skill;
}

function normalizeGateExpr(v: unknown): GateExpr {
  return v === 'hat_teilvorhaben' ? 'hat_teilvorhaben' : 'immer';
}

function normalizeRolle(v: unknown): WorkflowStepRolle {
  return v === 'llm_qs' ? 'llm_qs' : 'generierung';
}

function normalizeWorkflowStep(raw: unknown): WorkflowStep | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;
  const id = asString(s.id);
  if (!id) return null;
  const step: WorkflowStep = {
    id,
    nr: asString(s.nr, id),
    label: asString(s.label, id),
    kurz: asString(s.kurz, id),
    skillId: asString(s.skillId),
    gateExpr: normalizeGateExpr(s.gateExpr),
  };
  if (typeof s.parentStepId === 'string' && s.parentStepId) step.parentStepId = s.parentStepId;
  if (typeof s.ankerKey === 'string' && s.ankerKey) step.ankerKey = s.ankerKey;
  const rq = asStringArray(s.retrievalQueries);
  if (rq.length > 0) step.retrievalQueries = rq;
  // Rolle + Auto-Retry tolerant lesen; `normalizeStepRolle` setzt Defaults/Klemmung
  // und entfernt rollen-fremde Felder (eine Quelle für die Invarianten).
  step.rolle = normalizeRolle(s.rolle);
  if (typeof s.qsZielStepId === 'string' && s.qsZielStepId) step.qsZielStepId = s.qsZielStepId;
  if (typeof s.autoRetry === 'boolean') step.autoRetry = s.autoRetry;
  if (typeof s.maxRetries === 'number' && Number.isFinite(s.maxRetries)) step.maxRetries = s.maxRetries;
  return normalizeStepRolle(step);
}

/**
 * Normalisiert eine Workflow-Def: Schritte tolerant lesen, dann `parentStepId`
 * auf GENAU eine Ebene klemmen. Ein Parent-Verweis wird entfernt (Schritt wird
 * Top-Level), wenn er auf sich selbst zeigt, ins Leere zeigt ODER auf einen
 * Schritt zeigt, der SELBST einen Parent hat (Tiefe >1). So kann nie ein „5a1"
 * entstehen — weder beim Speichern noch beim defensiven Laden.
 */
function normalizeWorkflowDef(raw: unknown): WorkflowDef | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const d = raw as Record<string, unknown>;
  const id = asString(d.id);
  if (!id) return null;
  const steps = Array.isArray(d.steps)
    ? d.steps.map(normalizeWorkflowStep).filter((s): s is WorkflowStep => s !== null)
    : [];
  const ids = new Set(steps.map(s => s.id));
  const hatParent = new Set(steps.filter(s => s.parentStepId).map(s => s.id));
  const clamped = steps.map((s): WorkflowStep => {
    const p = s.parentStepId;
    if (p && (p === s.id || !ids.has(p) || hatParent.has(p))) {
      const { parentStepId: _drop, ...rest } = s;
      return rest;
    }
    return s;
  });
  const def: WorkflowDef = {
    id,
    name: asString(d.name, id),
    version: asNumber(d.version, 1),
    steps: clamped,
  };
  if (typeof d.aktiv === 'boolean') def.aktiv = d.aktiv;
  const artefaktTyp = asArtefaktTyp(d.artefaktTyp);
  if (artefaktTyp) def.artefaktTyp = artefaktTyp;
  const ebene = asWorkflowEbene(d.ebene);
  if (ebene) def.ebene = ebene;
  return def;
}

function normalizeWorkflows(raw: unknown): WorkflowDef[] {
  return Array.isArray(raw)
    ? raw.map(normalizeWorkflowDef).filter((d): d is WorkflowDef => d !== null)
    : [];
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
    workflows: normalizeWorkflows(f.workflows),
  };
}

/* -------------------------------------------------------------------------- */
/* Additiver Seed-Merge (ergänzt fehlende Skills/Regeln, überschreibt NIE)      */
/* -------------------------------------------------------------------------- */

export interface SeedMergeResult {
  file: SkillRegistryFile;
  /** IDs der durch den Seed ergänzten Skills (für den Kurator-Hinweis). */
  ergaenzteSkills: string[];
  /** IDs der durch den Seed ergänzten Regeln. */
  ergaenzteRegeln: string[];
  /** IDs der durch den Seed ergänzten Workflow-Definitionen. */
  ergaenzteWorkflows: string[];
}

/**
 * Ergänzt eine geladene (kuratierte) Registry um Seed-Skills/-Regeln, deren `id`
 * fehlt — kuratierte Einträge werden NIE überschrieben. Idempotent (zweiter Lauf
 * ergänzt nichts mehr). So wachsen neue Abschnitte (B–G) additiv in Bestands-
 * Installationen hinein, ohne die Kuration zu verlieren.
 */
export function mergeMissingSeeds(
  loaded: SkillRegistryFile,
  seed: SkillRegistryFile = SEED_REGISTRY,
): SeedMergeResult {
  const skillIds = new Set(loaded.skills.map(s => s.id));
  const regelIds = new Set(loaded.regeln.map(r => r.id));
  const loadedWorkflows = loaded.workflows ?? [];
  const workflowIds = new Set(loadedWorkflows.map(w => w.id));
  const fehlendeSkills = seed.skills.filter(s => !skillIds.has(s.id));
  const fehlendeRegeln = seed.regeln.filter(r => !regelIds.has(r.id));
  const fehlendeWorkflows = (seed.workflows ?? []).filter(w => !workflowIds.has(w.id));
  if (fehlendeSkills.length === 0 && fehlendeRegeln.length === 0 && fehlendeWorkflows.length === 0) {
    return { file: loaded, ergaenzteSkills: [], ergaenzteRegeln: [], ergaenzteWorkflows: [] };
  }
  return {
    file: {
      ...loaded,
      skills: [...loaded.skills, ...fehlendeSkills],
      regeln: [...loaded.regeln, ...fehlendeRegeln],
      workflows: [...loadedWorkflows, ...fehlendeWorkflows],
    },
    ergaenzteSkills: fehlendeSkills.map(s => s.id),
    ergaenzteRegeln: fehlendeRegeln.map(r => r.id),
    ergaenzteWorkflows: fehlendeWorkflows.map(w => w.id),
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
  /**
   * Durch den additiven Seed-Merge ergänzte IDs (leer, wenn nichts ergänzt
   * wurde). Bei `source === 'share'` + Schreibrecht sollte der Aufrufer den
   * ergänzten Stand zurückschreiben und den Kurator informieren.
   */
  ergaenzt?: { skills: string[]; regeln: string[]; workflows: string[] };
}

/**
 * Lädt die Registry: Share → bei Treffer cachen; sonst IDB-Cache (stale);
 * sonst der In-Memory-Seed (read-only, „noch nicht kuratiert"). Auf dem Share-/
 * Cache-Pfad werden fehlende Seed-Skills/-Regeln additiv ergänzt (B–G in Bestands-
 * Installationen). Der Aufrufer persistiert den Seed bei `source === 'seed'` ODER
 * bei nicht-leerem `ergaenzt` (jeweils mit Schreibrecht).
 */
export async function loadSkillRegistry(storage: StorageService): Promise<LoadedRegistry> {
  const share = await readSkillRegistry(storage);
  if (share) {
    const merged = mergeMissingSeeds(share);
    await cacheSkillRegistry(storage.idb, merged.file);
    return { file: merged.file, source: 'share', stale: false, ...ergaenztInfo(merged) };
  }
  const cached = await readCachedSkillRegistry(storage.idb);
  if (cached) {
    const merged = mergeMissingSeeds(cached);
    return { file: merged.file, source: 'cache', stale: true, ...ergaenztInfo(merged) };
  }
  return { file: SEED_REGISTRY, source: 'seed', stale: false };
}

function ergaenztInfo(merged: SeedMergeResult): Pick<LoadedRegistry, 'ergaenzt'> {
  if (
    merged.ergaenzteSkills.length === 0
    && merged.ergaenzteRegeln.length === 0
    && merged.ergaenzteWorkflows.length === 0
  ) return {};
  return {
    ergaenzt: {
      skills: merged.ergaenzteSkills,
      regeln: merged.ergaenzteRegeln,
      workflows: merged.ergaenzteWorkflows,
    },
  };
}
