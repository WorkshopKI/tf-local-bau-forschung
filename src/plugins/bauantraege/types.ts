import { STATUS_LABELS, STATUS_VARIANTS } from '@/core/utils/status-mappings';
import type { BadgeVariant } from '@/core/utils/status-mappings';
import type { VorgangStatus } from '@/core/types/vorgang';

const BAU_STATUSES: VorgangStatus[] = ['neu', 'in_bearbeitung', 'nachforderung', 'in_pruefung', 'genehmigt', 'abgelehnt', 'archiviert'];

export const BAUANTRAG_STATUS_LABELS: Record<string, string> =
  Object.fromEntries(BAU_STATUSES.map(s => [s, STATUS_LABELS[s] ?? s]));

export const BAUANTRAG_STATUS_VARIANTS: Record<string, BadgeVariant> =
  Object.fromEntries(BAU_STATUSES.map(s => [s, STATUS_VARIANTS[s] ?? 'default']));

export const PRIORITY_LABELS: Record<string, string> = {
  niedrig: 'Niedrig',
  normal: 'Normal',
  hoch: 'Hoch',
  dringend: 'Dringend',
};
