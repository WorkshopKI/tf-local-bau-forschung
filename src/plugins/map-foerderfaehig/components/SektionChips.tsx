/**
 * Sektions-IDs als Fundstellen-Chips.
 *
 * Schwester von `FundstellenChips` in `ItemKarte.tsx`, aber mit anderem Eingang:
 * dort kommen fertige `Fundstelle`-Objekte aus dem Aspekt-Mapping, hier nur die
 * IDs, die das Modell zu einem Befund genannt hat. Die Auflösung gegen die
 * Gliederung passiert deshalb erst hier.
 *
 * Rein darstellend.
 */
import type { VbSektion } from '@/plugins/antraege/aufbereitung/gliederung';

function beschriftung(sektion: VbSektion): string {
  const titel = sektion.titel.length > 28 ? `${sektion.titel.slice(0, 27)}…` : sektion.titel;
  return sektion.nummer != null ? `${sektion.nummer} ${titel}` : titel;
}

export function SektionChips({
  sektionIds, gliederung,
}: {
  sektionIds: readonly string[];
  gliederung: readonly VbSektion[];
}): React.ReactElement {
  const treffer = sektionIds
    .map(id => gliederung.find(s => s.id === id))
    .filter((s): s is VbSektion => s !== undefined);

  // Ohne Fundstelle ist der Befund nicht nachschlagbar — das gehört gesagt,
  // nicht durch eine leere Zeile verschwiegen.
  if (treffer.length === 0) {
    return (
      <span className="text-[11px] text-[var(--tf-text-tertiary)]">ohne Fundstelle</span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {treffer.map(s => (
        <span
          key={s.id}
          className="text-[11px] px-1.5 py-0.5 rounded"
          style={{
            border: '0.5px solid var(--tf-border)',
            color: 'var(--tf-text-secondary)',
          }}
        >
          {beschriftung(s)}
        </span>
      ))}
    </span>
  );
}
