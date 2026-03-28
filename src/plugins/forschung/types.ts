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

export const FORSCHUNG_STATUS_LABELS: Record<string, string> = {
  eingereicht: 'Eingereicht',
  in_begutachtung: 'In Begutachtung',
  nachbesserung: 'Nachbesserung',
  bewilligt: 'Bewilligt',
  abgelehnt: 'Abgelehnt',
  abgeschlossen: 'Abgeschlossen',
};

export const FORSCHUNG_STATUS_VARIANTS: Record<string, 'info' | 'warning' | 'success' | 'error' | 'default'> = {
  eingereicht: 'info',
  in_begutachtung: 'warning',
  nachbesserung: 'warning',
  bewilligt: 'success',
  abgelehnt: 'error',
  abgeschlossen: 'default',
};
