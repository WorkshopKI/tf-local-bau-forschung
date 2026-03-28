import type { Vorgang } from '@/core/types/vorgang';
import type { HistoryEntry } from './history';

const BAU_TRANSITIONS: Record<string, string[]> = {
  neu: ['in_bearbeitung', 'abgelehnt'],
  in_bearbeitung: ['in_pruefung', 'nachforderung', 'abgelehnt'],
  nachforderung: ['in_bearbeitung'],
  in_pruefung: ['genehmigt', 'nachforderung', 'abgelehnt'],
  genehmigt: ['archiviert'],
  abgelehnt: ['archiviert', 'in_bearbeitung'],
  archiviert: [],
};

const FORSCHUNG_TRANSITIONS: Record<string, string[]> = {
  eingereicht: ['in_begutachtung', 'abgelehnt'],
  in_begutachtung: ['bewilligt', 'nachbesserung', 'abgelehnt'],
  nachbesserung: ['in_begutachtung'],
  bewilligt: ['abgeschlossen'],
  abgelehnt: ['eingereicht'],
  abgeschlossen: [],
};

export function getTransitions(type: 'bauantrag' | 'forschung'): Record<string, string[]> {
  return type === 'bauantrag' ? BAU_TRANSITIONS : FORSCHUNG_TRANSITIONS;
}

export function canTransition(current: string, target: string, type: 'bauantrag' | 'forschung'): boolean {
  const map = getTransitions(type);
  return map[current]?.includes(target) ?? false;
}

export function getAvailableTransitions(current: string, type: 'bauantrag' | 'forschung'): string[] {
  const map = getTransitions(type);
  return map[current] ?? [];
}

export function applyTransition(
  vorgang: Vorgang,
  targetStatus: string,
  user: string,
  comment?: string,
): { vorgang: Vorgang; entry: HistoryEntry } {
  const now = new Date().toISOString();
  const entry: HistoryEntry = {
    timestamp: now,
    fromStatus: vorgang.status,
    toStatus: targetStatus,
    user,
    comment,
  };

  let deadline = vorgang.deadline;

  // Automatic actions
  if (targetStatus === 'nachforderung' || targetStatus === 'nachbesserung') {
    const fourWeeks = new Date();
    fourWeeks.setDate(fourWeeks.getDate() + 28);
    deadline = fourWeeks.toISOString().slice(0, 10);
  } else if (['genehmigt', 'bewilligt', 'abgelehnt', 'archiviert', 'abgeschlossen'].includes(targetStatus)) {
    deadline = undefined;
  }

  const updated: Vorgang = {
    ...vorgang,
    status: targetStatus as Vorgang['status'],
    modified: now,
    deadline,
  };

  return { vorgang: updated, entry };
}
