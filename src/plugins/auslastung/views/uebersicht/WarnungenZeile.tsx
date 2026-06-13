/**
 * WarnungenZeile — Sektion mit klickbaren Warn-/Success-Chips.
 *
 * Header: "WARNUNGEN" · "X offen"-Count + Hairline.
 * Default zwei Chips:
 *  - Leere MAs (warning, klickbar → setzt MA-Liste-Filter "ohne-Buchungen")
 *  - Überbuchte MAs (warning wenn > 0, sonst success "0 überbuchte MAs")
 *
 * Wenn keine Warnung offen ist, wird die ganze Sektion gerendert (mit
 * Success-Chips), damit der User aktiv sieht: "alles gut".
 */
import { useMemo } from 'react';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { useAuslastungIndex } from '../../hooks/useAuslastungIndex';
import { computeQuartalsStatistik } from '../../services/kapazitaet';
import { InlineCapsHeader } from './InlineCapsHeader';
import { WarnungChip } from './WarnungChip';

interface Props {
  /** Wird mit dem Filter-Schlüssel aufgerufen. Etappe 4 verdrahtet das. */
  onFilter?: (filter: 'no-bookings' | 'overbooked') => void;
}

export function WarnungenZeile({ onFilter }: Props): React.ReactElement {
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const config = useAuslastungData(s => s.data.config);
  const { auslastungByAnon } = useAuslastungIndex();

  const stats = useMemo(
    () => computeQuartalsStatistik(mitarbeiter, auslastungByAnon, config, config.aktuellesQuartal),
    [mitarbeiter, auslastungByAnon, config],
  );

  const leereCount = stats.warnungen.leereMAs.length;
  const ueberCount = stats.warnungen.ueberbuchteMAs.length;
  const offene = (leereCount > 0 ? 1 : 0) + (ueberCount > 0 ? 1 : 0);
  const countLabel = `${offene} offen`;

  return (
    <div>
      <InlineCapsHeader label="Warnungen" count={countLabel} />
      <div className="flex flex-wrap gap-2">
        <WarnungChip
          count={leereCount}
          label={
            leereCount === 1
              ? 'aktiver MA ohne Buchungen im Quartal'
              : 'aktive MAs ohne Buchungen im Quartal'
          }
          suffix="→ filtern"
          variant={leereCount > 0 ? 'warning' : 'success'}
          onClick={leereCount > 0 ? () => onFilter?.('no-bookings') : undefined}
          disabled={leereCount === 0}
        />
        <WarnungChip
          count={ueberCount}
          label={ueberCount === 1 ? 'überbuchter MA' : 'überbuchte MAs'}
          suffix={ueberCount > 0 ? '→ filtern' : undefined}
          variant={ueberCount > 0 ? 'warning' : 'success'}
          onClick={ueberCount > 0 ? () => onFilter?.('overbooked') : undefined}
          disabled={ueberCount === 0}
        />
      </div>
    </div>
  );
}
