import type { AntragListItem } from '@/core/services/csv/types';
import { isOpenStatus } from '@/core/utils/status-canonical';

/**
 * Eingangs-Ampel basierend auf dem Datum Antragseingang (`antragsdatum`).
 *
 * Schwellen (Wahl des Users):
 * - ≤ 30 Tage  → grün   (frisch)
 * - 31–60 Tage → gelb   (Vorwarnung)
 * - 61–90 Tage → orange (kritisch)
 * - > 90 Tage  → rot    (überfällig)
 *
 * Ampel zeigt NUR fuer fachlich offene Antraege:
 * - bewilligt / abgelehnt / abgeschlossen → null
 * - `bewilligung_datum` gesetzt → null (zusaetzliche Sicherheits-Bedingung,
 *   greift auch bei Datensaetzen ohne sauberen Status)
 *
 * Bei fehlendem oder ungültigem `antragsdatum` → null (keine Ampel zeigen).
 */

export type EingangAmpel = 'gruen' | 'gelb' | 'orange' | 'rot';

function trimmed(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export function daysSinceEingang(a: AntragListItem): number | null {
  const d = trimmed(a.antragsdatum);
  if (!d) return null;
  const ms = new Date(d).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
}

export function getEingangAmpel(a: AntragListItem): EingangAmpel | null {
  if (trimmed(a.bewilligung_datum)) return null;
  if (!isOpenStatus(a.status)) return null;
  const days = daysSinceEingang(a);
  if (days === null || days < 0) return null;
  if (days <= 30) return 'gruen';
  if (days <= 60) return 'gelb';
  if (days <= 90) return 'orange';
  return 'rot';
}

export const AMPEL_COLOR: Record<EingangAmpel, string> = {
  gruen: 'var(--tf-success-text)',
  gelb: 'var(--tf-warning-text)',
  orange: 'var(--tf-orange-text)',
  rot: 'var(--tf-danger-text)',
};

export const AMPEL_TOOLTIP: Record<EingangAmpel, string> = {
  gruen: 'Eingangsalter ≤ 30 Tage',
  gelb: 'Eingangsalter 31–60 Tage',
  orange: 'Eingangsalter 61–90 Tage',
  rot: 'Eingangsalter > 90 Tage',
};
