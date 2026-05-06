import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type { WizardApi } from './useCsvWizardState';

interface Props {
  api: WizardApi;
}

export function Step3Unterprogramme({ api }: Props): React.ReactElement {
  const { state, toggleUpSelection, setAllUpSelections } = api;

  const totals = useMemo(() => {
    if (!state.upScan) return { total: 0, active: 0, newEntries: 0 };
    let active = 0;
    let newEntries = 0;
    for (const e of state.upScan) {
      if (e.aktiv) active++;
      if (!e.existing) newEntries++;
    }
    return { total: state.upScan.length, active, newEntries };
  }, [state.upScan]);

  if (state.upScanLoading) {
    return (
      <div className="py-10 text-center text-[13px] text-[var(--tf-text-secondary)]">
        Scanne Unterprogramme …
        <div className="mt-1 text-[11.5px] text-[var(--tf-text-tertiary)]">
          Dauert bei großen Master-CSVs 1–2 Sekunden.
        </div>
      </div>
    );
  }

  if (!state.upScan || state.upScan.length === 0) {
    return (
      <div className="py-10 text-center text-[13px] text-[var(--tf-text-tertiary)]">
        Keine Unterprogramm-Werte in der Datei gefunden. Bitte prüfen, ob die
        Spalte korrekt auf <span className="font-mono">unterprogramm_id</span> gemappt ist.
      </div>
    );
  }

  // Sortierung: erst nach Count absteigend, dann nach Code
  const sorted = [...state.upScan].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.code.localeCompare(b.code);
  });

  return (
    <div>
      <div className="text-[12px] text-[var(--tf-text-secondary)] mb-3">
        {totals.total} Unterprogramme in der CSV gefunden · {totals.active} aktiv
        {totals.newEntries > 0 ? ` · ${totals.newEntries} neu` : ''}.
        Beim Import werden nur Anträge aus aktiven Unterprogrammen übernommen.
        Zuvor aktive, jetzt deaktivierte werden aus der Datenbank gelöscht.
      </div>

      <div className="flex gap-1.5 mb-3">
        <Button size="xs" variant="outline" onClick={() => setAllUpSelections('all')}>
          Alle auswählen
        </Button>
        <Button size="xs" variant="outline" onClick={() => setAllUpSelections('none')}>
          Keine auswählen
        </Button>
        {totals.newEntries > 0 ? (
          <Button size="xs" variant="outline" onClick={() => setAllUpSelections('onlyNew')}>
            Nur neue auswählen
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto" style={{ border: '0.5px solid var(--tf-border)', borderRadius: 8 }}>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
              <th className="p-2 w-[40px]"></th>
              <th className="p-2">Code</th>
              <th className="p-2">Label</th>
              <th className="p-2">Zeitraum</th>
              <th className="p-2 text-right">Zeilen</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => (
              <tr key={e.code} style={{ borderTop: i === 0 ? undefined : '0.5px solid var(--tf-border)' }}>
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={e.aktiv}
                    onChange={(ev) => toggleUpSelection(e.code, ev.target.checked)}
                    className="accent-[var(--tf-primary)]"
                  />
                </td>
                <td className="p-2 font-mono">{e.code}</td>
                <td className="p-2">
                  {e.name ?? <span className="text-[var(--tf-text-tertiary)]">—</span>}
                </td>
                <td className="p-2 text-[var(--tf-text-secondary)]">
                  {e.zeitraum_von || e.zeitraum_bis
                    ? `${e.zeitraum_von ?? '?'} – ${e.zeitraum_bis ?? '?'}`
                    : <span className="text-[var(--tf-text-tertiary)]">—</span>}
                </td>
                <td className="p-2 text-right tabular-nums">{e.count.toLocaleString('de-DE')}</td>
                <td className="p-2">
                  {e.existing ? (
                    <span className="text-[11px] text-[var(--tf-text-tertiary)]">bereits registriert</span>
                  ) : (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-800">neu</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[11px] text-[var(--tf-text-tertiary)]">
        Labels und Zeiträume können unter <span className="font-mono">Kuration → Unterprogramme</span> nachgepflegt werden.
      </div>
    </div>
  );
}
