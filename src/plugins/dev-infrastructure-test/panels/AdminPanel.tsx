import { useCallback, useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { getRecentAudits } from '@/core/services/infrastructure/audit-log';
import type { AuditEntry } from '@/core/services/infrastructure/types';
import { Button } from '@/components/ui/button';
import { Field, SectionCaption } from './shared';

const TTL_OPTIONS: Array<{ label: string; ms: number }> = [
  { label: '30 s', ms: 30_000 },
  { label: '5 min', ms: 5 * 60_000 },
  { label: '12 h', ms: 12 * 60 * 60_000 },
];

export function AdminPanel(): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const smbStatus = useSmbStatus();
  const [audits, setAudits] = useState<AuditEntry[]>([]);

  const refresh = useCallback(async () => {
    setAudits(await getRecentAudits(storage.idb, 10));
  }, [storage.idb]);

  useEffect(() => { void refresh(); }, [refresh, session.isActive, smbStatus.status, smbStatus.lastCheck]);

  return (
    <div className="px-8 py-6 max-w-[760px]">
      <h2 className="text-[18px] font-medium text-[var(--tf-text)]">Kurator-Modus</h2>
      <p className="text-[13px] text-[var(--tf-text-secondary)] leading-relaxed mt-1.5 mb-5 max-w-[620px]">
        Eine Session, in der schreibende Aktionen erlaubt sind und das Audit-Log konsistent geführt wird.
      </p>

      {/* v3.0: Der frühere KuratorSessionPanel verifizierte gegen
          `kurator-config.enc` auf dem Share. Die Datei gibt es nicht mehr — im
          dev-Build trägt die Config ohnehin kein Schloss, die Session lässt sich
          also direkt öffnen. */}
      <Field label="Session">
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-[var(--tf-text-secondary)]">
            {session.isActive ? `aktiv als „${session.kuratorName ?? '—'}"` : 'inaktiv'}
          </span>
          <Button
            type="button"
            variant={session.isActive ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => void (session.isActive
              ? session.deactivate(storage.idb)
              : session.aktiviere(storage.idb, 'Dev'))}
          >
            {session.isActive ? 'Beenden' : 'Starten'}
          </Button>
        </div>
      </Field>

      <Field label="Session-Dauer (TTL)">
        <div className="flex flex-wrap gap-1.5">
          {TTL_OPTIONS.map(opt => {
            const on = session.ttlMs === opt.ms;
            return (
              <button
                key={opt.ms}
                type="button"
                onClick={() => session.setTtl(opt.ms)}
                className={`px-3 py-1 rounded-full text-[12px] cursor-pointer transition-colors ${
                  on
                    ? 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)]'
                    : 'bg-[var(--tf-bg)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                }`}
                style={on ? undefined : { border: '0.5px solid var(--tf-border)' }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>

      <SectionCaption right={
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-[11px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
        >
          ↻ neu laden
        </button>
      }>
        Audit-Log
      </SectionCaption>
      <div
        className="rounded-[var(--tf-radius)] p-3 bg-[var(--tf-bg-secondary)] font-mono text-[11.5px] leading-[1.7]"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        {audits.length === 0 ? (
          <span className="text-[var(--tf-text-tertiary)]">Keine Einträge.</span>
        ) : (
          audits.slice().reverse().map((a, i) => (
            <div key={i}>
              <span className="text-[var(--tf-text-tertiary)]">{a.ts.slice(11, 19)}</span>
              <span className="ml-3 text-[var(--tf-text-secondary)]">{a.user}</span>
              <span className="ml-3 text-[var(--tf-text)]">{a.action}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
