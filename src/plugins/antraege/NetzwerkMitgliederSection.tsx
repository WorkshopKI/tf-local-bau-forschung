/**
 * Section auf der Antrag-Detail-Seite, die alle anderen Anträge desselben
 * Netzwerks (gleiche 4-Ziffer-ID im 16KN-FKZ) auflistet. Wird nur gerendert,
 * wenn:
 *   1. das aktuelle aktenzeichen ein 16KN-FKZ ist (`extractNetzwerkId !== null`)
 *   2. mindestens 1 weiteres Mitglied im aktiven Programm vorhanden ist
 *
 * Cross-Programm-Mitglieder sind out of scope (Liste arbeitet auf dem
 * RAM-Snapshot des aktiven Programms aus `useAntraegeStore`).
 */
import { useMemo } from 'react';
import { CollapsibleSection, Badge } from '@/ui';
import { getStatusLabel, getStatusVariant } from '@/core/utils/status-mappings';
import { getVbPhaseLabel, getVbPhaseVariant } from '@/core/utils/vb-phase-mappings';
import { useAntraegeStore } from './store';
import {
  extractNetzwerkId,
  isNetzwerkLead,
  compareNetzwerkOrder,
  collectPhases,
  formatNetzwerkLabel,
} from './netzwerk';

interface Props {
  aktenzeichen: string;
  onOpenAntrag: (aktenzeichen: string) => void;
}

function strOrEmpty(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.trim();
}

export function NetzwerkMitgliederSection({
  aktenzeichen,
  onOpenAntrag,
}: Props): React.ReactElement | null {
  const antraege = useAntraegeStore(s => s.antraege);

  const data = useMemo(() => {
    const netzwerkId = extractNetzwerkId(aktenzeichen);
    if (netzwerkId === null) return null;
    const mitglieder = antraege
      .filter(a => extractNetzwerkId(a.aktenzeichen) === netzwerkId)
      .sort(compareNetzwerkOrder);
    if (mitglieder.length <= 1) return null;
    const phases = collectPhases(mitglieder);
    return {
      netzwerkId,
      mitglieder,
      phases,
      label: formatNetzwerkLabel(netzwerkId, phases),
    };
  }, [aktenzeichen, antraege]);

  if (!data) return null;

  const count = data.mitglieder.length;
  const subtitle = `${count} Mitglieder${data.phases.size > 0 ? ` · Phase ${[...data.phases].sort().join(' + ')}` : ''}`;

  return (
    <CollapsibleSection label={data.label} subtitle={subtitle} defaultOpen={false}>
      <div className="overflow-hidden" style={{ border: '0.5px solid var(--tf-border)', borderRadius: 8 }}>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
              <th className="px-3 py-2 font-medium">Aktenzeichen</th>
              <th className="px-3 py-2 font-medium">Akronym</th>
              <th className="px-3 py-2 font-medium">Antragsteller</th>
              <th className="px-3 py-2 font-medium">Phase</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.mitglieder.map(m => {
              const isCurrent = m.aktenzeichen === aktenzeichen;
              const isLead = isNetzwerkLead(m);
              const akronym = strOrEmpty(m.akronym);
              const antragsteller = strOrEmpty(m.antragsteller);
              const status = strOrEmpty(m.status);
              const phaseLabel = getVbPhaseLabel(m.vb_phase);
              return (
                <tr
                  key={m.aktenzeichen}
                  className={isCurrent ? '' : 'cursor-pointer hover:bg-[var(--tf-bg-secondary)]'}
                  style={{
                    borderTop: '0.5px solid var(--tf-border)',
                    background: isCurrent ? 'var(--tf-bg-secondary)' : undefined,
                  }}
                  onClick={isCurrent ? undefined : () => onOpenAntrag(m.aktenzeichen)}
                >
                  <td className="px-3 py-2 font-mono text-[11.5px] whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <span>{m.aktenzeichen}</span>
                      {isLead ? (
                        <span
                          className="inline-flex items-center rounded-full text-[9.5px] font-medium uppercase tracking-wider"
                          style={{
                            padding: '1px 5px',
                            color: 'var(--tf-primary)',
                            border: '0.5px solid var(--tf-primary)',
                          }}
                          title="Netzwerk-Lead"
                        >
                          Lead
                        </span>
                      ) : null}
                      {isCurrent ? (
                        <span className="text-[10px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
                          aktuell
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 py-2 truncate max-w-[160px]" title={akronym}>{akronym || '—'}</td>
                  <td className="px-3 py-2 truncate max-w-[260px]" title={antragsteller}>
                    {antragsteller || '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {phaseLabel ? (
                      <Badge variant={getVbPhaseVariant(m.vb_phase)} className="min-w-[44px] justify-center">
                        {phaseLabel}
                      </Badge>
                    ) : (
                      <span className="text-[var(--tf-text-tertiary)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {status ? (
                      <Badge variant={getStatusVariant(status)}>
                        {getStatusLabel(status)}
                      </Badge>
                    ) : (
                      <span className="text-[var(--tf-text-tertiary)]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  );
}
