import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { Badge, SectionHeader, ListItem, Button } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useProfile } from '@/core/hooks/useProfile';
import { useBauantraegeStore } from '@/plugins/bauantraege/store';
import { useForschungStore } from '@/plugins/forschung/store';
import { useDashboardData } from './useDashboardData';

const STATUS_VARIANTS: Record<string, 'info' | 'warning' | 'success' | 'error' | 'default'> = {
  neu: 'info', in_bearbeitung: 'warning', nachforderung: 'warning', in_pruefung: 'info',
  genehmigt: 'success', abgelehnt: 'error', archiviert: 'default',
  eingereicht: 'info', in_begutachtung: 'warning', nachbesserung: 'warning',
  bewilligt: 'success', abgeschlossen: 'default',
};

export function HomePage(): React.ReactElement {
  const storage = useStorage();
  const { navigate } = useNavigation();
  const loadBau = useBauantraegeStore(s => s.loadAll);
  const loadForsch = useForschungStore(s => s.loadAll);
  const { profile } = useProfile();

  useEffect(() => {
    loadBau(storage);
    loadForsch(storage);
  }, [storage, loadBau, loadForsch]);

  const data = useDashboardData(profile?.department);
  const name = profile?.name ?? '';
  const dept = profile?.department === 'bauantraege' ? 'Bauanträge' : profile?.department === 'forschung' ? 'Forschung' : 'Beide Abteilungen';

  if (data.stats.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-2">{data.greeting}{name ? `, ${name}` : ''}</h1>
        <p className="text-[14px] text-[var(--tf-text-secondary)] mb-6">Noch keine Vorgänge angelegt</p>
        <Button variant="secondary" icon={ArrowRight} onClick={() => navigate('bauantraege')}>Ersten Antrag erstellen</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">{data.greeting}{name ? `, ${name}` : ''}</h1>
        <p className="text-[13px] text-[var(--tf-text-secondary)]">{dept}</p>
        <p className="text-[13px] text-[var(--tf-text-tertiary)] mt-1">
          {data.stats.offen} offene Vorgänge · {data.fristenDieseWoche} Fristen diese Woche
        </p>
      </div>

      {/* Callout */}
      {data.naechsterSchritt && data.naechsterSchritt.daysLeft <= 7 && (
        <div className="flex items-center justify-between p-4 mb-6 rounded-[var(--tf-radius)]" style={{ borderLeft: '3px solid var(--tf-border-hover)' }}>
          <div>
            <p className="text-[12px] text-[var(--tf-text-tertiary)]">
              Nächster Schritt · Frist in {data.naechsterSchritt.daysLeft} Tagen
            </p>
            <p className="text-[14px] font-medium text-[var(--tf-text)]">
              <span className="text-[var(--tf-text-tertiary)] font-mono">{data.naechsterSchritt.id}</span> — {data.naechsterSchritt.title}
            </p>
          </div>
          <Button variant="secondary" size="sm" icon={ArrowRight}
            onClick={() => navigate(data.naechsterSchritt!.type === 'bauantrag' ? 'bauantraege' : 'forschung', { selectedId: data.naechsterSchritt!.id })}>
            Öffnen
          </Button>
        </div>
      )}

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8">
        {/* Main */}
        <div>
          <SectionHeader label="Aktuelle Vorgänge"
            action={<button onClick={() => navigate('bauantraege')} className="text-[11px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer">Alle →</button>} />
          {data.letzteAenderungen.map((v, i) => (
            <ListItem key={v.id}
              icon={<span className="text-[11px] font-medium text-[var(--tf-text-secondary)]">{v.type === 'bauantrag' ? 'B' : 'F'}</span>}
              title={v.title}
              subtitle={v.id}
              meta={<Badge variant={STATUS_VARIANTS[v.status] ?? 'default'}>{v.status.replace(/_/g, ' ')}</Badge>}
              onClick={() => navigate(v.type === 'bauantrag' ? 'bauantraege' : 'forschung', { selectedId: v.id })}
              last={i === data.letzteAenderungen.length - 1}
            />
          ))}
        </div>

        {/* Sidebar cards */}
        <div className="space-y-4">
          {/* Fristen */}
          <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-4">
            <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-3 uppercase tracking-[0.08em]">Offene Fristen</p>
            {data.dringend.length === 0 ? (
              <p className="text-[13px] text-[var(--tf-text-secondary)]">Keine dringenden Fristen</p>
            ) : (
              data.dringend.slice(0, 5).map(v => (
                <div key={v.id} className="flex items-center gap-2 py-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${v.daysLeft < 0 ? 'bg-[var(--tf-danger-text)]' : v.daysLeft < 3 ? 'bg-[var(--tf-danger-text)]' : 'bg-[var(--tf-warning-text)]'}`} />
                  <span className="text-[12px] text-[var(--tf-text)] flex-1 truncate">{v.id}</span>
                  <span className="text-[11px] text-[var(--tf-text-tertiary)]">
                    {v.daysLeft < 0 ? `${Math.abs(v.daysLeft)}d überfällig` : `in ${v.daysLeft}d`}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* AI Status */}
          <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-4">
            <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-3 uppercase tracking-[0.08em]">AI-Assistent</p>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tf-text-tertiary)]" />
              <span className="text-[13px] text-[var(--tf-text-secondary)]">Nicht verbunden</span>
            </div>
            <button onClick={() => navigate('chat')} className="text-[12px] text-[var(--tf-primary)] hover:underline cursor-pointer">Chat öffnen →</button>
          </div>

          {/* Search Index */}
          <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-4">
            <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-3 uppercase tracking-[0.08em]">Suchindex</p>
            <p className="text-[13px] text-[var(--tf-text-secondary)]">{data.stats.total} Vorgänge indexiert</p>
          </div>
        </div>
      </div>
    </div>
  );
}
