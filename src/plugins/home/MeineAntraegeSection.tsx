import { Badge, SectionHeader, ListItem } from '@/ui';
import { useNavigation } from '@/core/hooks/useNavigation';
import { getVbPhaseLabel, getVbPhaseVariant } from '@/core/utils/vb-phase-mappings';
import { getStatusLabel, getStatusVariant } from '@/core/utils/status-mappings';
import type { AntragVorgang } from './useDashboardData';

interface Props {
  /** Top-5 offene eigene Förderanträge, bereits sortiert (vb_phase asc → Frist asc). */
  antraege: AntragVorgang[];
}

function formatDaysShort(deadline: string | undefined): string | null {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (Number.isNaN(diff)) return null;
  if (diff < 0) return `${diff}d`;
  return `+${diff}d`;
}

/**
 * Eigene Sektion auf der Home-Page, die ausschließlich die offenen Förderanträge
 * des Profils zeigt — gruppiert nach VB-Phase (badge prominent als Icon).
 *
 * Sichtbarkeit:
 * - Wird durch HomePage nur eingebunden, wenn `department !== 'bauantraege'`.
 * - Gibt `null` zurück, wenn keine Anträge anliegen — z.B. wenn der Bearbeiter-
 *   Filter aktiv ist und niemand der eigenen Anträge offen ist.
 */
export function MeineAntraegeSection({ antraege }: Props): React.ReactElement | null {
  const { navigate } = useNavigation();
  if (antraege.length === 0) return null;

  return (
    <div className="mb-6">
      <SectionHeader
        label="Meine Anträge"
        action={
          <button
            onClick={() => navigate('antraege')}
            className="text-[11px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
          >
            Alle →
          </button>
        }
      />
      {antraege.map((v, i) => {
        const phaseLabel = getVbPhaseLabel(v.vb_phase);
        const daysFmt = formatDaysShort(v.deadline);
        return (
          <ListItem
            key={v.id}
            iconBare
            icon={
              phaseLabel ? (
                <Badge variant={getVbPhaseVariant(v.vb_phase)}>{phaseLabel}</Badge>
              ) : (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--tf-text-tertiary)] opacity-40" />
              )
            }
            title={v.title}
            titleClassName="text-[13px] font-medium text-[var(--tf-text)] truncate"
            subtitle={v.id}
            subtitleClassName="text-[11px] font-mono text-[var(--tf-text-tertiary)] truncate"
            meta={
              <>
                {daysFmt ? (
                  <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums font-mono">
                    {daysFmt}
                  </span>
                ) : null}
                <Badge variant={getStatusVariant(v.status)}>{getStatusLabel(v.status)}</Badge>
              </>
            }
            onClick={() => navigate('antraege', { selectedId: v.id })}
            last={i === antraege.length - 1}
          />
        );
      })}
    </div>
  );
}
