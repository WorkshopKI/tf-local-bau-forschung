/**
 * Delta zum Stand der Technik: je Zielparameter der heutige Wert gegenüber dem
 * angestrebten.
 *
 * Die Spalte „Quantifizierung" trägt den eigentlichen Prüfnutzen: eine nur
 * qualitativ beschriebene Verbesserung ist nach der Entscheidungshilfe genau das
 * Merkmal der Stufe B1 — und damit ein Kandidat für eine Nachforderung.
 *
 * Rein darstellend.
 */
import { ArrowRight } from 'lucide-react';
import type { SdtDeltaZeile } from '../infografik/schema';

const QUANT_STIL: Record<SdtDeltaZeile['quantifizierung'], { label: string; farbe: string }> = {
  quantifiziert: { label: 'quantifiziert', farbe: 'var(--tf-success, #16a34a)' },
  qualitativ: { label: 'nur qualitativ', farbe: 'var(--tf-warning, #f59e0b)' },
  fehlt: { label: 'nicht beziffert', farbe: 'var(--tf-danger, #dc2626)' },
};

export function SdtDeltaKarte({ zeilen }: { zeilen: readonly SdtDeltaZeile[] }): React.ReactElement {
  if (zeilen.length === 0) {
    return (
      <div
        className="rounded px-3 py-2.5 text-[12.5px]"
        style={{ background: 'color-mix(in srgb, var(--tf-warning, #f59e0b) 10%, var(--tf-bg))' }}
      >
        <p className="text-[var(--tf-text)] font-medium">Keine Zielparameter erkennbar</p>
        <p className="text-[var(--tf-text-secondary)] mt-0.5">
          Die Vorhabensbeschreibung nennt keine Parameter, mit denen sich das Vorhaben
          gegen den Stand der Technik abgrenzen liesse. Das ist selbst ein Befund.
        </p>
      </div>
    );
  }

  const nurQualitativ = zeilen.filter(z => z.quantifizierung !== 'quantifiziert').length;

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px] border-collapse">
          <thead>
            <tr className="text-left text-[11px] text-[var(--tf-text-tertiary)] uppercase tracking-wide">
              <th className="py-1.5 pr-3 font-medium">Parameter</th>
              <th className="py-1.5 pr-3 font-medium">Stand der Technik</th>
              <th className="py-1.5 pr-3 font-medium">Ziel</th>
              <th className="py-1.5 pr-3 font-medium">Beleg</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z, i) => {
              const stil = QUANT_STIL[z.quantifizierung];
              return (
                <tr key={`${z.parameter}-${i}`} style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                  <td className="py-2 pr-3 text-[var(--tf-text)] align-top">{z.parameter}</td>
                  <td className="py-2 pr-3 text-[var(--tf-text-secondary)] align-top">
                    {z.sdtWert.length > 0 ? z.sdtWert : '—'}
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <span className="flex items-center gap-1.5 text-[var(--tf-text)]">
                      <ArrowRight size={12} className="text-[var(--tf-text-tertiary)] shrink-0" />
                      {z.zielWert.length > 0 ? z.zielWert : '—'}
                    </span>
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <span className="text-[11px]" style={{ color: stil.farbe }}>{stil.label}</span>
                    {z.sektionIds.length > 0 && (
                      <span className="block text-[10.5px] text-[var(--tf-text-tertiary)] mt-0.5">
                        {z.sektionIds.join(', ')}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {nurQualitativ > 0 && (
        <p className="text-[11.5px]" style={{ color: 'var(--tf-warning, #f59e0b)' }}>
          {nurQualitativ} von {zeilen.length} Parametern sind nicht messbar beschrieben —
          nach der Entscheidungshilfe das Merkmal der Stufe B1 und ein Kandidat für eine
          Nachforderung.
        </p>
      )}
    </div>
  );
}
