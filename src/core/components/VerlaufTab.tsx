import { Badge, SectionHeader } from '@/ui';
import type { HistoryEntry } from '@/core/services/workflow/history';

const ALL_STATUS_LABELS: Record<string, string> = {
  neu: 'Neu', in_bearbeitung: 'In Bearbeitung', nachforderung: 'Nachforderung',
  in_pruefung: 'In Prüfung', genehmigt: 'Genehmigt', abgelehnt: 'Abgelehnt', archiviert: 'Archiviert',
  eingereicht: 'Eingereicht', in_begutachtung: 'In Begutachtung', nachbesserung: 'Nachbesserung',
  bewilligt: 'Bewilligt', abgeschlossen: 'Abgeschlossen',
};

interface VerlaufTabProps {
  history: HistoryEntry[];
}

export function VerlaufTab({ history }: VerlaufTabProps): React.ReactElement {
  return (
    <div>
      <SectionHeader label="Änderungshistorie" />
      {history.length === 0 ? (
        <p className="text-[13px] text-[var(--tf-text-secondary)] mt-3">Noch keine Statusänderungen</p>
      ) : (
        <div className="mt-3 space-y-4">
          {history.map((e, i) => (
            <div key={i}>
              <p className="text-[12px] text-[var(--tf-text-tertiary)]">{new Date(e.timestamp).toLocaleString('de-DE')}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="default">{ALL_STATUS_LABELS[e.fromStatus] ?? e.fromStatus}</Badge>
                <span className="text-[var(--tf-text-tertiary)]">→</span>
                <Badge variant="info">{ALL_STATUS_LABELS[e.toStatus] ?? e.toStatus}</Badge>
              </div>
              {e.comment && <p className="text-[13px] text-[var(--tf-text-secondary)] italic mt-1">{e.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
