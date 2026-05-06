import type { Antrag } from '@/core/services/csv/types';
import { findFieldValue } from './fieldLookup';

interface Props {
  antrag: Antrag;
}

function strOrNull(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length === 0 ? null : t;
  }
  if (typeof v === 'number') return String(v);
  return null;
}

function formatGermanDate(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  }
  return iso;
}

interface Row {
  label: string;
  value: string;
}

export function EckdatenCard({ antrag }: Props): React.ReactElement {
  const name = strOrNull(antrag.antragsteller);
  const branche = strOrNull(antrag.branche);
  const foerdergeber = strOrNull(antrag.foerdergeber);
  const subline = branche ?? foerdergeber;

  const rows: Row[] = [];
  const unterprogramm = strOrNull(antrag.unterprogramm_id);
  if (unterprogramm) rows.push({ label: 'Unterprogramm', value: unterprogramm });

  // "Phase" ist ein typisches Custom-Feld in Forschungs-CSVs; rendern wenn vorhanden.
  const phase = strOrNull(findFieldValue(antrag, ['phase', 'vorhaben_phase', 'projektphase']));
  if (phase) rows.push({ label: 'Phase', value: phase });

  const antragsdatum = strOrNull(antrag.antragsdatum);
  if (antragsdatum) rows.push({ label: 'Eingang', value: formatGermanDate(antragsdatum) });

  const bewilligung = strOrNull(antrag.bewilligung_datum);
  if (bewilligung) rows.push({ label: 'Bewilligung', value: formatGermanDate(bewilligung) });

  const frist = strOrNull(antrag.frist_datum);
  if (frist) rows.push({ label: 'Frist', value: formatGermanDate(frist) });

  const foerdersumme = antrag.foerdersumme;
  if (typeof foerdersumme === 'number' && foerdersumme > 0) {
    rows.push({
      label: 'Fördersumme',
      value: foerdersumme.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
    });
  }

  return (
    <aside
      className="rounded-[var(--tf-radius)] p-4"
      style={{ background: 'var(--tf-bg-secondary)' }}
    >
      <h3 className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-3">
        Eckdaten
      </h3>
      {name ? (
        <div className="text-[14px] font-medium text-[var(--tf-text)] leading-snug">{name}</div>
      ) : null}
      {subline ? (
        <div className="mt-0.5 text-[12px] text-[var(--tf-text-secondary)]">{subline}</div>
      ) : null}
      {rows.length > 0 && (name || subline) ? (
        <div
          className="mt-3 pt-3 space-y-2"
          style={{ borderTop: '0.5px solid var(--tf-border)' }}
        />
      ) : null}
      <div className={rows.length > 0 ? 'space-y-2' : ''}>
        {rows.map(r => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <span className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">{r.label}</span>
            <span className="text-[12.5px] text-[var(--tf-text)] tabular-nums text-right">{r.value}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
