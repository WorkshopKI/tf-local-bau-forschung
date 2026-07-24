/**
 * Status-Detailsektion (`#status`) der Verbund-Detailseite (Phase 5). Komponiert
 * Timeline + „Warum?"-Panel + Nächste-Schritte aus dem gerätelokalen,
 * read-only `useStatusVerlauf`. Rendert nichts, solange Katalog/Ableitung fehlen
 * (Flag aus oder noch nicht initialisiert).
 */
import { useStatusVerlauf } from './useStatusVerlauf';
import { StatusTimeline } from './StatusTimeline';
import { StatusWarum } from './StatusWarum';
import { WERKZEUG_LABEL } from './labels';

export function StatusDetailSection({ verbundId }: { verbundId: string }): React.ReactElement | null {
  const v = useStatusVerlauf(verbundId);

  if (v.laden) {
    return <div className="text-[13px] text-[var(--tf-text-tertiary)]">Lädt …</div>;
  }
  if (!v.version || !v.ableitung) return null;
  const version = v.version;
  const ableitung = v.ableitung;

  return (
    <div>
      <h2 className="text-[16px] font-medium text-[var(--tf-text)] mb-4">Status &amp; Verlauf</h2>

      <StatusTimeline events={v.events} version={version} grenze={v.grenze} />

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <div className="text-[12px] font-medium text-[var(--tf-text-secondary)] mb-2">Warum dieser Status?</div>
          <StatusWarum ableitung={ableitung} version={version} />
        </div>
        <div>
          <div className="text-[12px] font-medium text-[var(--tf-text-secondary)] mb-2">Nächste Schritte</div>
          {ableitung.naechsteSchritte.length === 0 ? (
            <div className="text-[12px] text-[var(--tf-text-tertiary)]">Keine offenen Schritte abgeleitet.</div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {ableitung.naechsteSchritte.map((s, i) => (
                <li
                  key={`${s.regelId}:${i}`}
                  className="flex items-center gap-2 text-[12px] text-[var(--tf-text)]"
                >
                  <span>{s.label}</span>
                  {s.werkzeug ? (
                    <span className="text-[10.5px] px-1.5 py-[1px] rounded-full bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
                      {WERKZEUG_LABEL[s.werkzeug]}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
