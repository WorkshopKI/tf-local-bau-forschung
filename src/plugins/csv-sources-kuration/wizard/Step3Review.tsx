import type { WizardApi } from './useCsvWizardState';

interface Step3Props {
  api: WizardApi;
}

export function Step3Review({ api }: Step3Props): React.ReactElement {
  const { state } = api;
  const decisions = Object.entries(state.decisions);
  const mapped = decisions.filter(([, d]) => d.mode !== 'ignore');
  const historyCount = decisions.filter(([, d]) => d.trackHistory).length;

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">Metadaten</div>
        <div className="grid grid-cols-[120px_1fr] gap-y-1">
          <div className="text-[var(--tf-text-secondary)]">Anzeigename</div><div>{state.displayName}</div>
          <div className="text-[var(--tf-text-secondary)]">Schema-ID</div><div className="font-mono text-[12px]">{state.schemaId}</div>
          <div className="text-[var(--tf-text-secondary)]">Join-Key</div><div>{state.joinKey}</div>
          <div className="text-[var(--tf-text-secondary)]">Master</div><div>{state.isMaster ? 'ja' : 'nein'}</div>
          <div className="text-[var(--tf-text-secondary)]">Priority</div><div>{state.priority}</div>
          <div className="text-[var(--tf-text-secondary)]">Zeilen</div><div>{state.preview?.totalLines ?? 0}</div>
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">
          Mappings ({mapped.length} aktiv, {decisions.length - mapped.length} ignoriert, {historyCount} mit Historie)
        </div>
        <div className="overflow-hidden" style={{ border: '0.5px solid var(--tf-border)', borderRadius: 8 }}>
          <table className="w-full text-[12.5px]">
            <tbody>
              {decisions.map(([col, d]) => (
                <tr key={col} style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                  <td className="p-2 font-mono text-[11.5px]">{col}</td>
                  <td className="p-2 text-[var(--tf-text-secondary)]">
                    {d.mode === 'ignore' ? 'ignoriert' :
                      d.mode === 'canonical' ? `→ ${d.canonical} (${d.type ?? 'string'})` :
                      `→ ${d.custom ?? col.toLowerCase()} (${d.type ?? 'string'})`}
                    {d.trackHistory ? <span className="ml-2 text-[11px] text-amber-700">🕒 Historie</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
