import { useState } from 'react';
import './felder.css';
import type { Antrag } from '@/core/services/csv/types';
import { buildPartnerRows, sumPartnerKosten } from './partnerRows';
import { formatEuro } from './format';

function Caret({ open }: { open: boolean }): React.ReactElement {
  return (
    <svg className={'af-caret' + (open ? ' open' : '')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/**
 * Verbundpartner-Tabelle (Hebel 2) — eine Zeile pro Teilvorhaben statt der
 * `Wert / Wert / Wert`-Slash-Suppe. Klappbar; Koordinator trägt eine 2px-Kante
 * links + Rollen-Label, Summenzeile im `tfoot`.
 */
export function VerbundPartnerTabelle({ tvs }: { tvs: Antrag[] }): React.ReactElement | null {
  const [open, setOpen] = useState(true);
  if (tvs.length === 0) return null;
  const rows = buildPartnerRows(tvs);
  const sum = sumPartnerKosten(rows);

  return (
    <div className="af-card">
      <button type="button" className="af-card-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="ttl">Verbundpartner</span>
        <span className="af-card-right">
          <span className="n">{rows.length}{sum !== null ? ` · ${formatEuro(sum)}` : ''}</span>
          <Caret open={open} />
        </span>
      </button>
      {open ? (
        <table className="af-ptable">
          <thead>
            <tr>
              <th>Partner</th><th>Ort</th><th>PLZ</th><th>BL</th><th className="num">beantragt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.aktenzeichen} className={r.istKoordinator ? 'koord' : ''}>
                <td>
                  <div>{r.name}</div>
                  <span className="af-prole">{r.istKoordinator ? 'Koordinator · ' : ''}{r.typ ?? ''}</span>
                </td>
                <td>{r.ort ?? '—'}</td>
                <td className="mono">{r.plz ?? '—'}</td>
                <td>{r.bl ?? '—'}</td>
                <td className="num">{r.kosten !== null ? formatEuro(r.kosten) : '—'}</td>
              </tr>
            ))}
          </tbody>
          {sum !== null ? (
            <tfoot>
              <tr><td colSpan={4}>Gesamt</td><td className="num">{formatEuro(sum)}</td></tr>
            </tfoot>
          ) : null}
        </table>
      ) : null}
    </div>
  );
}
