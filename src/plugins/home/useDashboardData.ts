import { useMemo } from 'react';
import { useBauantraegeStore } from '@/plugins/bauantraege/store';
import { useAntraegeStore } from '@/plugins/antraege/store';
import type { Vorgang } from '@/core/types/vorgang';
import type { Antrag } from '@/core/services/csv/types';

const CLOSED = new Set(['genehmigt', 'abgelehnt', 'archiviert', 'bewilligt', 'abgeschlossen']);

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

/** Minimal-Projektion eines Antrags auf eine Vorgang-aehnliche Shape. */
function antragToVorgangLike(a: Antrag): Vorgang & { _isAntrag: true } {
  const tags = Array.isArray(a.tags) ? (a.tags as string[]) : [];
  const notes = typeof a.notes === 'string' ? a.notes : '';
  const priority = (a.priority as Vorgang['priority']) ?? 'normal';
  const deadline = typeof a.frist_datum === 'string' ? a.frist_datum : undefined;
  const created = typeof a.antragsdatum === 'string' ? a.antragsdatum : a._updated_at;
  return {
    id: a.aktenzeichen,
    type: 'bauantrag', // Projektion: Antraege werden im Dashboard wie Vorgaenge behandelt.
    title: a.titel ?? a.aktenzeichen,
    status: (a.status as Vorgang['status']) ?? 'neu',
    priority,
    assignee: a.antragsteller ?? '',
    created,
    modified: a._updated_at,
    deadline,
    tags,
    notes,
    _isAntrag: true,
  };
}

export interface DashboardData {
  greeting: string;
  offeneVorgaenge: Vorgang[];
  dringend: Array<Vorgang & { daysLeft: number }>;
  naechsterSchritt: (Vorgang & { daysLeft: number }) | null;
  fristenDieseWoche: number;
  letzteAenderungen: Vorgang[];
  stats: { total: number; offen: number; inPruefung: number; nachforderung: number; genehmigt: number };
}

export function useDashboardData(department: 'antraege' | 'bauantraege' | 'beide' = 'beide'): DashboardData {
  const bauantraege = useBauantraegeStore(s => s.bauantraege);
  const antraege = useAntraegeStore(s => s.antraege);

  return useMemo(() => {
    const alle: Vorgang[] = [
      ...(department !== 'antraege' ? bauantraege : []),
      ...(department !== 'bauantraege' ? antraege.map(antragToVorgangLike) : []),
    ];
    const offen = alle.filter(v => !CLOSED.has(v.status));

    const mitFrist = offen
      .map(v => ({ ...v, daysLeft: daysUntil(v.deadline) }))
      .filter((v): v is Vorgang & { daysLeft: number } => v.daysLeft !== null)
      .sort((a, b) => a.daysLeft - b.daysLeft);

    const fristenDieseWoche = mitFrist.filter(v => v.daysLeft <= 7 && v.daysLeft >= 0).length;
    const naechster = mitFrist[0] ?? null;

    const letzteAenderungen = [...offen]
      .sort((a, b) => b.modified.localeCompare(a.modified))
      .slice(0, 8);

    return {
      greeting: getGreeting(),
      offeneVorgaenge: offen,
      dringend: mitFrist.filter(v => v.daysLeft <= 7),
      naechsterSchritt: naechster,
      fristenDieseWoche,
      letzteAenderungen,
      stats: {
        total: alle.length,
        offen: offen.length,
        inPruefung: alle.filter(v => (v.status as string) === 'in_pruefung' || (v.status as string) === 'in_begutachtung').length,
        nachforderung: alle.filter(v => (v.status as string) === 'nachforderung' || (v.status as string) === 'nachbesserung').length,
        genehmigt: alle.filter(v => (v.status as string) === 'genehmigt' || (v.status as string) === 'bewilligt').length,
      },
    };
  }, [bauantraege, antraege, department]);
}
