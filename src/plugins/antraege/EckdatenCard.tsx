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

interface Cell {
  label: string;
  value: string;
  /** Wenn true: Wert in Mono-Schrift (IDs, Aktenzeichen). */
  mono?: boolean;
}

export function EckdatenCard({ antrag }: Props): React.ReactElement {
  const name = strOrNull(antrag.antragsteller);
  const branche = strOrNull(antrag.branche);
  const foerdergeber = strOrNull(antrag.foerdergeber);
  const subline = branche && foerdergeber
    ? `${branche} · ${foerdergeber}`
    : branche ?? foerdergeber;

  const cells: Cell[] = [];

  const akronym = strOrNull(antrag.akronym);
  if (akronym) cells.push({ label: 'Akronym', value: akronym });

  cells.push({ label: 'Aktenzeichen', value: antrag.aktenzeichen, mono: true });

  const verbundId = strOrNull(antrag.verbund_id);
  if (verbundId) cells.push({ label: 'Verbund-ID', value: verbundId, mono: true });

  const unterprogramm = strOrNull(antrag.unterprogramm_id);
  if (unterprogramm) cells.push({ label: 'Unterprogramm', value: unterprogramm });

  // "Phase" ist ein typisches Custom-Feld in Forschungs-CSVs.
  const phase = strOrNull(findFieldValue(antrag, ['phase', 'vorhaben_phase', 'projektphase']));
  if (phase) cells.push({ label: 'Phase', value: phase });

  const antragsdatum = strOrNull(antrag.antragsdatum);
  if (antragsdatum) cells.push({ label: 'Eingang', value: formatGermanDate(antragsdatum) });

  const bewilligung = strOrNull(antrag.bewilligung_datum);
  if (bewilligung) cells.push({ label: 'Bewilligung', value: formatGermanDate(bewilligung) });

  const frist = strOrNull(antrag.frist_datum);
  if (frist) cells.push({ label: 'Frist', value: formatGermanDate(frist) });

  const foerdersumme = antrag.foerdersumme;
  if (typeof foerdersumme === 'number' && foerdersumme > 0) {
    cells.push({
      label: 'Fördersumme',
      value: foerdersumme.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
    });
  }

  const status = strOrNull(antrag.status);
  if (status) cells.push({ label: 'Status', value: status });

  return (
    <aside
      className="rounded-[var(--tf-radius)] p-4"
      style={{ background: 'var(--tf-bg-secondary)' }}
    >
      <h3 className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-3">
        Eckdaten
      </h3>

      {name ? (
        <div className="text-[14px] font-medium text-[var(--tf-text)] leading-snug">{name}</div>
      ) : null}
      {subline ? (
        <div className="mt-0.5 text-[12px] text-[var(--tf-text-secondary)]">{subline}</div>
      ) : null}

      {cells.length > 0 ? (
        <div
          className={`${name || subline ? 'mt-3 pt-3' : ''} grid grid-cols-2 gap-x-4 gap-y-3`}
          style={name || subline ? { borderTop: '0.5px solid var(--tf-border)' } : undefined}
        >
          {cells.map(c => (
            <div key={c.label} className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-0.5">
                {c.label}
              </div>
              <div
                className={`text-[12.5px] text-[var(--tf-text)] truncate ${c.mono ? 'font-mono' : ''}`}
                title={c.value}
              >
                {c.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
