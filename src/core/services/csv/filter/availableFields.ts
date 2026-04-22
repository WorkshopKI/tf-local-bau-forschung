import type { IDBStore } from '../../storage/idb-store';
import { listSchemas } from '../schemaRegistry';
import { CANONICAL_FIELDS } from '../constants';
import type { CanonicalField, FieldType } from '../types';

export interface AvailableField {
  key: string;
  label: string;
  type: FieldType;
  origin: 'canonical' | 'custom';
  sources: string[]; // csv_schema_ids, die dieses Feld liefern
}

/**
 * Sammelt alle Felder, die im gegebenen Programm als Filter definierbar sind:
 * - Alle kanonischen Felder (auch ohne Mapping)
 * - Alle Custom-Felder aus registrierten CSV-Schemas
 */
export async function listAvailableFields(
  idb: IDBStore,
  programmId: string,
): Promise<AvailableField[]> {
  const schemas = await listSchemas(idb, programmId);
  const byKey = new Map<string, AvailableField>();

  for (const cf of CANONICAL_FIELDS) {
    byKey.set(cf.key, {
      key: cf.key,
      label: cf.label,
      type: cf.type,
      origin: 'canonical',
      sources: [],
    });
  }

  for (const s of schemas) {
    for (const entry of Object.values(s.column_mapping)) {
      if (entry.ignore) continue;
      const fieldKey = entry.canonical ?? entry.custom;
      if (!fieldKey) continue;
      const type = (entry.type ?? 'string') as FieldType;
      const existing = byKey.get(fieldKey);
      if (existing) {
        if (!existing.sources.includes(s.id)) existing.sources.push(s.id);
      } else {
        byKey.set(fieldKey, {
          key: fieldKey,
          label: humanizeFieldKey(fieldKey),
          type,
          origin: entry.canonical ? 'canonical' : 'custom',
          sources: [s.id],
        });
      }
    }
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (a.origin !== b.origin) return a.origin === 'canonical' ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

export function humanizeFieldKey(key: string): string {
  const cf = CANONICAL_FIELDS.find(f => f.key === (key as CanonicalField));
  if (cf) return cf.label;
  return key
    .split(/[_-]/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
