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
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import type { SdtDeltaZeile } from '../infografik/schema';
import { istKandidat, istUebernommen } from '../substanz/zielkriterien';

const QUANT_STIL: Record<SdtDeltaZeile['quantifizierung'], { label: string; farbe: string }> = {
  quantifiziert: { label: 'quantifiziert', farbe: 'var(--tf-success-text)' },
  qualitativ: { label: 'nur qualitativ', farbe: 'var(--tf-warning-text)' },
  fehlt: { label: 'nicht beziffert', farbe: 'var(--tf-danger-text)' },
};

export function SdtDeltaKarte({
  zeilen, zielkriterienAus, erledigteAusloeser, onZielkriterium, onNachfordern,
}: {
  zeilen: readonly SdtDeltaZeile[];
  /** Abgewählte Zielkriterien (normalisierte Parameter). */
  zielkriterienAus: readonly string[];
  /** Parameter, zu denen bereits eine Präzisions-NF vorliegt. */
  erledigteAusloeser: ReadonlySet<string>;
  onZielkriterium: (parameter: string, uebernehmen: boolean) => void;
  onNachfordern: (zeile: SdtDeltaZeile) => void;
}): React.ReactElement {
  if (zeilen.length === 0) {
    return (
      <div
        className="rounded px-3 py-2.5 text-[12.5px]"
        style={{ background: 'color-mix(in srgb, var(--tf-warning-text) 10%, var(--tf-bg))' }}
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
              <th className="py-1.5 font-medium">Weiterverwendung</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z, i) => {
              const stil = QUANT_STIL[z.quantifizierung];
              const kandidat = istKandidat(z);
              const uebernommen = istUebernommen(z, zielkriterienAus);
              const erledigt = erledigteAusloeser.has(z.parameter);
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
                  <td className="py-2 align-top">
                    {kandidat
                      ? (
                        // Messbare Zeile → Zielkriterium fürs Gutachten. Vorbelegt an:
                        // was quantifiziert ist, gehört per Vorgabe in den Bescheid.
                        <label className="flex items-start gap-1.5 text-[11.5px] text-[var(--tf-text-secondary)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={uebernommen}
                            onChange={e => onZielkriterium(z.parameter, e.target.checked)}
                            className="mt-0.5 shrink-0"
                          />
                          als Zielkriterium übernehmen
                        </label>
                      )
                      : (
                        <Button
                          variant="ghost" size="sm"
                          disabled={erledigt}
                          onClick={() => onNachfordern(z)}
                        >
                          {erledigt ? 'Nachforderung erzeugt' : 'Nachforderung erzeugen'}
                        </Button>
                      )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {nurQualitativ > 0 && (
        <p className="text-[11.5px]" style={{ color: 'var(--tf-warning-text)' }}>
          {nurQualitativ} von {zeilen.length} Parametern sind nicht messbar beschrieben —
          nach der Entscheidungshilfe das Merkmal der Stufe B1 und ein Kandidat für eine
          Nachforderung.
        </p>
      )}
    </div>
  );
}
