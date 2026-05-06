import { useMemo } from 'react';
import type { Antrag } from '@/core/services/csv/types';

/** Heuristik-Whitelist: Feldnamen die kategorisch klingen. Vergleich case-insensitive. */
const TAG_FIELD_HINTS = [
  'branche',
  'kategorie',
  'klassifikation',
  'thema',
  'themen',
  'bereich',
  'gebiet',
  'forschungsgebiet',
  'technologie',
  'technologien',
  'tag',
  'tags',
  'schwerpunkt',
  'fachgebiet',
];

/** Felder, die NIEMALS als Tags interpretiert werden sollen, auch wenn der Wert kurz ist. */
const TAG_FIELD_DENY = new Set([
  'titel',
  'antragsteller',
  'aktenzeichen',
  'akronym',
  'verbund_id',
  'verbund_titel',
  'foerdergeber',
  'unterprogramm_id',
  'status',
  'verbund_status',
]);

interface Props {
  antrag: Antrag;
}

interface TagGroup {
  field: string;
  values: string[];
}

function looksTagLike(field: string, value: unknown): TagGroup | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return null;
  if (TAG_FIELD_DENY.has(field)) return null;
  if (field.startsWith('_')) return null;
  if (field.endsWith('_datum')) return null;

  const fieldLow = field.toLowerCase();
  const matchesHint = TAG_FIELD_HINTS.some(h => fieldLow.includes(h));
  if (!matchesHint) return null;

  const parts = trimmed
    .split(/[,;]/)
    .map(p => p.trim())
    .filter(p => p.length > 0 && p.length <= 80);
  if (parts.length === 0) return null;

  return { field, values: parts };
}

export function KlassifikationPills({ antrag }: Props): React.ReactElement | null {
  const groups = useMemo(() => {
    const result: TagGroup[] = [];
    for (const [key, value] of Object.entries(antrag)) {
      const tag = looksTagLike(key, value);
      if (tag) result.push(tag);
    }
    return result;
  }, [antrag]);

  if (groups.length === 0) return null;

  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">Klassifikation</h3>
      <div className="flex flex-wrap gap-1.5">
        {groups.flatMap(g =>
          g.values.map((v, i) => (
            <span
              key={`${g.field}-${i}`}
              className="px-2.5 py-1 rounded-full text-[11.5px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]"
            >
              {v}
            </span>
          )),
        )}
      </div>
    </div>
  );
}
