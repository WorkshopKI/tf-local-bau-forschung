import type { Vorgang } from '@/core/types/vorgang';

export function getDaysUntilDeadline(vorgang: Vorgang): number | null {
  if (!vorgang.deadline) return null;
  const diff = new Date(vorgang.deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isUrgent(vorgang: Vorgang): boolean {
  const days = getDaysUntilDeadline(vorgang);
  return days !== null && days < 3;
}

export function isWarning(vorgang: Vorgang): boolean {
  const days = getDaysUntilDeadline(vorgang);
  return days !== null && days >= 3 && days < 7;
}

export function isOverdue(vorgang: Vorgang): boolean {
  const days = getDaysUntilDeadline(vorgang);
  return days !== null && days < 0;
}

export function getDeadlineDotColor(vorgang: Vorgang): 'danger' | 'warning' | 'default' | null {
  const days = getDaysUntilDeadline(vorgang);
  if (days === null) return null;
  if (days < 3) return 'danger';
  if (days < 7) return 'warning';
  return 'default';
}
