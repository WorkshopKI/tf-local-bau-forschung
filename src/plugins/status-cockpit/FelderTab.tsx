/**
 * Felder-Tab — die Statusfelder kuratieren.
 *
 * Volle Tabelle der Feld-Einträge des Entwurfs mit Inline-Bearbeitung von Label,
 * Prominenz-Default und aktiv. Typ und Ebene sind strukturelle Herkunft und
 * werden nur angezeigt. Hier setzt der Kurator z.B. ein „Termin"-Feld auf
 * Prominenz „Ignoriert". Rein darstellend — Änderungen über `api.setFeld`.
 */
import { Badge } from '@/components/ui/badge';
import type { StatusCockpitApi } from './useStatusCockpit';
import type { StatusFeldEintrag, Prominenz } from '@/core/status';
import { PROMINENZ_LABEL, PROMINENZ_WERTE, feldKlasse, feldStil } from './labels';

const thKlasse = 'text-left font-medium text-[11px] text-[var(--tf-text-tertiary)] px-2 py-1.5 whitespace-nowrap';
const tdKlasse = 'px-2 py-1.5 align-middle';

const TYP_LABEL: Record<StatusFeldEintrag['typ'], string> = { wert: 'Wert', datum: 'Datum' };
const EBENE_LABEL: Record<StatusFeldEintrag['ebene'], string> = { verbund: 'Verbund', tv: 'Teilvorhaben' };

function FeldZeile({ f, csvSpalte, api }: {
  f: StatusFeldEintrag; csvSpalte: string; api: StatusCockpitApi;
}): React.ReactElement {
  return (
    <tr className="border-b border-[var(--tf-border)] hover:bg-[var(--tf-hover)]">
      <td className={`${tdKlasse} text-[12px] text-[var(--tf-text-secondary)] font-mono whitespace-nowrap`}>
        <div className="flex items-center gap-1.5">
          <span>{f.feldId}</span>
          {f.unkuratiert && <Badge variant="warning">unkuratiert</Badge>}
        </div>
      </td>
      {/* Herkunft: aus welcher CSV-Spalte das Feld gefüllt wird. */}
      <td className={`${tdKlasse} text-[12px] text-[var(--tf-text-tertiary)] font-mono whitespace-nowrap`}>
        {csvSpalte}
      </td>
      <td className={`${tdKlasse} min-w-[180px]`}>
        <input
          value={f.label} placeholder={f.feldId} className={feldKlasse} style={feldStil}
          onChange={e => api.setFeld(f.feldId, { label: e.target.value })}
        />
      </td>
      <td className={`${tdKlasse} text-[12px] text-[var(--tf-text-secondary)]`}>{TYP_LABEL[f.typ]}</td>
      <td className={`${tdKlasse} text-[12px] text-[var(--tf-text-secondary)]`}>{EBENE_LABEL[f.ebene]}</td>
      <td className={`${tdKlasse} min-w-[140px]`}>
        <select
          value={f.prominenzDefault} className={feldKlasse} style={feldStil}
          onChange={e => api.setFeld(f.feldId, { prominenzDefault: e.target.value as Prominenz })}
        >
          {PROMINENZ_WERTE.map(p => <option key={p} value={p}>{PROMINENZ_LABEL[p]}</option>)}
        </select>
      </td>
      <td className={`${tdKlasse} text-center`}>
        <input
          type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer" checked={f.aktiv}
          onChange={e => api.setFeld(f.feldId, { aktiv: e.target.checked })}
        />
      </td>
    </tr>
  );
}

export function FelderTab({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const felder = api.entwurf?.felder ?? [];
  if (!api.entwurf) return null;

  const inaktiv = felder.filter(f => !f.aktiv).length;

  return (
    <div className="flex flex-col gap-3 pt-3">
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
        {felder.length} Felder{inaktiv > 0 ? ` · ${inaktiv} stillgelegt` : ''}. Ein Feld auf Prominenz
        „Ignoriert" zu setzen blendet es aus Timeline/Warum aus (Events werden weiter erfasst).
      </p>

      <div className="overflow-x-auto rounded" style={feldStil}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--tf-border)] bg-[var(--tf-bg-secondary)]">
              <th className={thKlasse}>Feld</th>
              <th className={thKlasse}>CSV-Spalte</th>
              <th className={thKlasse}>Label</th>
              <th className={thKlasse}>Typ</th>
              <th className={thKlasse}>Ebene</th>
              <th className={thKlasse}>Prominenz-Default</th>
              <th className={`${thKlasse} text-center`}>aktiv</th>
            </tr>
          </thead>
          <tbody>
            {felder.map(f => (
              <FeldZeile
                key={f.feldId} f={f} api={api}
                csvSpalte={api.csvSpalten.get(f.feldId)?.join(', ') ?? '—'}
              />
            ))}
          </tbody>
        </table>
        {felder.length === 0 && (
          <p className="text-[12.5px] text-[var(--tf-text-tertiary)] px-3 py-4">
            Der Entwurf enthält keine Felder.
          </p>
        )}
      </div>
    </div>
  );
}
