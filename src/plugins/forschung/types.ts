import { STATUS_LABELS, STATUS_VARIANTS } from '@/core/utils/status-mappings';
import type { BadgeVariant } from '@/core/utils/status-mappings';
import type { Vorgang } from '@/core/types/vorgang';

export interface ForschungsantragMeta {
  foerderprogramm: string;
  foerdersumme: number;
  laufzeit: string;
  projektleiter: string;
  institution: string;
  forschungsgebiet: string;
}

export type ForschungsVorgang = Vorgang & ForschungsantragMeta;

export type ForschungStatus = 'eingereicht' | 'in_begutachtung' | 'nachbesserung' | 'bewilligt' | 'abgelehnt' | 'abgeschlossen';

const FORSCHUNG_STATUSES: ForschungStatus[] = ['eingereicht', 'in_begutachtung', 'nachbesserung', 'bewilligt', 'abgelehnt', 'abgeschlossen'];

export const FORSCHUNG_STATUS_LABELS: Record<string, string> =
  Object.fromEntries(FORSCHUNG_STATUSES.map(s => [s, STATUS_LABELS[s] ?? s]));

export const FORSCHUNG_STATUS_VARIANTS: Record<string, BadgeVariant> =
  Object.fromEntries(FORSCHUNG_STATUSES.map(s => [s, STATUS_VARIANTS[s] ?? 'default']));
