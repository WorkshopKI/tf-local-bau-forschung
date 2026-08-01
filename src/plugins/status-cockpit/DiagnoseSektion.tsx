/**
 * Diagnose (nur dev): der **Phasen-Vergleichs-Report**.
 *
 * Stellt für jeden Verbund die alte, aus Rängen abgeleitete Spine-Phase der
 * neuen, am Status-Code hängenden ZAH-Phase gegenüber. Er ist kein Werkzeug für
 * den Betrieb, sondern das **Abnahme-Kriterium für den späteren Rückbau**: erst
 * wenn hier keine unerklärten Abweichungen mehr stehen, darf die alte Ableitung
 * verschwinden.
 *
 * Deshalb dev-only und deshalb bewusst nackt — Zahlen und eine Liste, keine
 * Aufbereitung. Wer sie interpretieren muss, sitzt am Code.
 */
import { useMemo } from 'react';
import { Stethoscope } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { isDevContext } from '@/config/feature-flags';
import {
  vergleichePhasen, vergleichZusammenfassung, abweichungsMuster, zahPhaseLabel,
} from '@/core/status';
import type { StatusCockpitApi } from './useStatusCockpit';
import { SPINE_LABEL, feldStil } from './labels';

const MAX_MUSTER = 40;

export function DiagnoseSektion({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const [offen, toggleOffen] = useCollapsedSection(
    'status-cockpit:diagnose', { defaultOpen: false },
  );

  const vergleich = useMemo(
    () => (api.entwurf ? vergleichePhasen(api.entwurf, api.verbundFelder, api.stichtag) : null),
    [api.entwurf, api.verbundFelder, api.stichtag],
  );

  if (!isDevContext() || !vergleich) return null;

  const muster = abweichungsMuster(vergleich);

  return (
    <section className="mt-3 rounded" style={feldStil}>
      <button
        type="button" onClick={toggleOffen} aria-expanded={offen}
        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
      >
        <Stethoscope size={15} />
        Diagnose · Phasen-Vergleich (dev)
        {vergleich.abweichend === 0
          ? <Badge variant="success">keine Abweichung</Badge>
          : <Badge variant="warning">{vergleich.abweichend} abweichend</Badge>}
        <span className="ml-auto text-[11px] text-[var(--tf-text-tertiary)]">
          {offen ? 'einklappen' : 'ausklappen'}
        </span>
      </button>

      {offen && (
        <div className="flex flex-col gap-2 border-t border-[var(--tf-border)] px-3 py-3">
          <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
            Alte abgeleitete Spine-Phase gegen neue ZAH-Phase aus dem Status-Code.
            {' '}<span className="text-[var(--tf-text)]">{vergleichZusammenfassung(vergleich)}</span>
            {' '}Keine unerklärte Abweichung ist die Bedingung dafür, dass die alte Ableitung
            (Ränge, Prominenz, terminal) später entfallen kann.
          </p>

          <div className="flex items-center gap-3 flex-wrap text-[12px]">
            <span className="text-[var(--tf-text-secondary)]">gleich: <b>{vergleich.gleich}</b></span>
            <span className="text-[var(--tf-text-secondary)]">abweichend: <b>{vergleich.abweichend}</b></span>
            <span className="text-[var(--tf-text-tertiary)]">
              nicht vergleichbar: <b>{vergleich.unvergleichbar}</b>
            </span>
          </div>

          {muster.length === 0 ? (
            <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">
              Keine Abweichung im geladenen Bestand.
            </p>
          ) : (
            <>
              <p className="text-[12px] text-[var(--tf-text-tertiary)]">
                Nach Muster gruppiert. Die Abweichungen sind systematisch: die alte Ableitung liest
                das ganze <code>D_</code>-Feld-Ensemble (höchster Rang gewinnt, terminal schlägt
                Rang), die ZAH-Phase nur den Statustext. Ein Antrag mit Status „beantragt", an dem
                schon ein Prüf-Datum hängt, kam alt als „Fachprüfung" heraus.
              </p>
              <div className="max-h-[320px] overflow-y-auto rounded bg-[var(--tf-bg)] px-2 py-1.5">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-left text-[11px] text-[var(--tf-text-tertiary)]">
                      <th className="px-1.5 py-1 font-medium text-right">Anzahl</th>
                      <th className="px-1.5 py-1 font-medium">Status (roh)</th>
                      <th className="px-1.5 py-1 font-medium">Code</th>
                      <th className="px-1.5 py-1 font-medium">ZAH-Phase</th>
                      <th className="px-1.5 py-1 font-medium">Spine (alt)</th>
                      <th className="px-1.5 py-1 font-medium">Beispiele</th>
                    </tr>
                  </thead>
                  <tbody>
                    {muster.slice(0, MAX_MUSTER).map(m => (
                      <tr
                        key={`${m.statusRoh}|${m.spinePhase}`}
                        className="text-[11.5px] text-[var(--tf-text-secondary)]"
                      >
                        <td className="px-1.5 py-1 font-mono text-right text-[var(--tf-text)]">{m.anzahl}</td>
                        <td className="px-1.5 py-1">{m.statusRoh || '—'}</td>
                        <td className="px-1.5 py-1 font-mono">{m.code ?? '—'}</td>
                        <td className="px-1.5 py-1">{zahPhaseLabel(m.zahPhase, api.entwurf?.zahPhasen)}</td>
                        <td className="px-1.5 py-1">{SPINE_LABEL[m.spinePhase]}</td>
                        <td className="px-1.5 py-1 font-mono text-[10.5px] text-[var(--tf-text-tertiary)]">
                          {m.beispiele.join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {muster.length > MAX_MUSTER && (
                  <p className="text-[11.5px] text-[var(--tf-text-tertiary)] px-1.5 py-1">
                    … {muster.length - MAX_MUSTER} weitere Muster
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
