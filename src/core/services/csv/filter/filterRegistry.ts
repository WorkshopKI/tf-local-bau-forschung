import type { IDBStore } from '../../storage/idb-store';
import { atomicWrite, readText } from '../../infrastructure/atomic-write';
import { getProgrammHandle, getSmbHandle } from '../../infrastructure/smb-handle';
import { logAudit } from '../../infrastructure/audit-log';
import type { FilterDefinition, UserPreset, FilterScope } from './types';
import type { CsvSchema } from '../types';
import { FILTER_DEFINITIONS_PATH, SYSTEM_FILTERS_SEED } from './constants';
import {
  putFilter,
  getFilter,
  listFiltersByProgramm,
  listFiltersByScope,
  deleteFilterDef,
  getUserPresets,
  setUserPresets,
} from './idb-filter';
import { listSchemas } from '../schemaRegistry';

export async function seedSystemFilters(idb: IDBStore, programmId: string): Promise<void> {
  const existing = await listFiltersByScope(idb, programmId, 'system');
  const existingIds = new Set(existing.map(f => f.id));
  const schemas = await listSchemas(idb, programmId);
  const now = new Date().toISOString();
  for (const seed of SYSTEM_FILTERS_SEED) {
    if (existingIds.has(seed.id)) continue;
    const displayGroup = findDisplayGroup(schemas, seed.feld);
    const def: FilterDefinition = {
      ...seed,
      programm_id: programmId,
      ...(displayGroup ? { display_group: displayGroup } : {}),
      erstellt_am: now,
      aktualisiert_am: now,
    };
    await putFilter(idb, def);
  }
}

/**
 * Liefert den group_path aus dem dominanten Schema (Master > höchste Priority)
 * für ein gegebenes Feld — für Filter-Panel-Gruppierung.
 */
function findDisplayGroup(schemas: CsvSchema[], feld: string): string[] | null {
  const ranked = [...schemas].sort((a, b) => {
    if (a.is_master !== b.is_master) return a.is_master ? -1 : 1;
    return (b.priority ?? 0) - (a.priority ?? 0);
  });
  for (const s of ranked) {
    if (!s.column_mapping) continue;
    for (const entry of Object.values(s.column_mapping)) {
      if (entry.canonical === feld || entry.custom === feld) {
        if (entry.group_path && entry.group_path.length > 0) return entry.group_path;
      }
    }
  }
  return null;
}

export async function listFilters(idb: IDBStore, programmId: string): Promise<FilterDefinition[]> {
  return listFiltersByProgramm(idb, programmId);
}

export async function listFiltersScoped(
  idb: IDBStore,
  programmId: string,
  scope: FilterScope,
): Promise<FilterDefinition[]> {
  return listFiltersByScope(idb, programmId, scope);
}

export async function loadFilter(idb: IDBStore, id: string): Promise<FilterDefinition | null> {
  return getFilter(idb, id);
}

/**
 * Speichert einen Filter. Kurator-Filter werden zusätzlich auf SMB persistiert
 * (alle Kurator-Filter eines Programms als eine JSON-Datei).
 */
export async function saveFilter(
  idb: IDBStore,
  filter: FilterDefinition,
  kuratorName?: string,
): Promise<void> {
  // display_group aus Schema übernehmen, falls nicht explizit gesetzt
  let enriched: FilterDefinition = filter;
  if (!filter.display_group) {
    const schemas = await listSchemas(idb, filter.programm_id);
    const displayGroup = findDisplayGroup(schemas, filter.feld);
    if (displayGroup) {
      enriched = { ...filter, display_group: displayGroup };
    }
  }
  await putFilter(idb, enriched);

  if (enriched.scope === 'admin') {
    await persistAdminFiltersToSmb(idb, enriched.programm_id);
    await logAudit(idb, {
      action: 'filter_saved',
      user: kuratorName,
      details: { filterId: enriched.id, feld: enriched.feld, typ: enriched.typ },
    });
  } else if (enriched.scope === 'system') {
    // System-Filter: nur Persistenz, kein Audit (nicht user-getriggert beim Seeding;
    // bei späteren Edits wie "versteckt"-Toggle loggt der Caller separat).
  }
}

export async function updateSystemFilterVisibility(
  idb: IDBStore,
  filterId: string,
  versteckt: boolean,
  kuratorName?: string,
): Promise<void> {
  const f = await getFilter(idb, filterId);
  if (!f || f.scope !== 'system') return;
  const updated: FilterDefinition = {
    ...f,
    versteckt,
    aktualisiert_am: new Date().toISOString(),
  };
  await putFilter(idb, updated);
  await logAudit(idb, {
    action: 'filter_visibility_changed',
    user: kuratorName,
    details: { filterId, versteckt },
  });
}

export async function removeFilter(
  idb: IDBStore,
  id: string,
  kuratorName?: string,
): Promise<void> {
  const f = await getFilter(idb, id);
  if (!f) return;
  if (f.scope === 'system') throw new Error('System-Filter können nicht gelöscht werden.');
  await deleteFilterDef(idb, id);
  if (f.scope === 'admin') {
    await persistAdminFiltersToSmb(idb, f.programm_id);
    await logAudit(idb, {
      action: 'filter_deleted',
      user: kuratorName,
      details: { filterId: id, feld: f.feld },
    });
  }
}

async function persistAdminFiltersToSmb(idb: IDBStore, programmId: string): Promise<void> {
  const parent = await getSmbHandle(idb);
  if (!parent) return;
  try {
    const programm = await getProgrammHandle(parent);
    const adminFilters = await listFiltersByScope(idb, programmId, 'admin');
    await atomicWrite(programm, FILTER_DEFINITIONS_PATH, JSON.stringify(adminFilters, null, 2));
  } catch {
    // Best-effort — IDB ist primary
  }
}

/**
 * Lädt Admin-Filter von SMB (z.B. beim ersten Start auf einem neuen Rechner).
 * Merged mit bereits in IDB vorhandenen Admin-Filtern (SMB ist Quelle).
 */
export async function hydrateAdminFiltersFromSmb(idb: IDBStore, programmId: string): Promise<number> {
  const parent = await getSmbHandle(idb);
  if (!parent) return 0;
  try {
    const programm = await getProgrammHandle(parent);
    const raw = await readText(programm, FILTER_DEFINITIONS_PATH);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as FilterDefinition[];
    let count = 0;
    for (const f of parsed) {
      if (f.programm_id !== programmId) continue;
      await putFilter(idb, f);
      count++;
    }
    return count;
  } catch {
    return 0;
  }
}

// User-Presets

export async function listUserPresets(idb: IDBStore, programmId: string): Promise<UserPreset[]> {
  return getUserPresets(idb, programmId);
}

export async function addUserPreset(idb: IDBStore, preset: UserPreset): Promise<void> {
  const existing = await getUserPresets(idb, preset.programm_id);
  const next = [...existing.filter(p => p.id !== preset.id), preset];
  await setUserPresets(idb, preset.programm_id, next);
}

export async function removeUserPreset(
  idb: IDBStore,
  programmId: string,
  presetId: string,
): Promise<void> {
  const existing = await getUserPresets(idb, programmId);
  const next = existing.filter(p => p.id !== presetId);
  await setUserPresets(idb, programmId, next);
}
