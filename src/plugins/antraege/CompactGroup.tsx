import type { AntragGroup } from './antragGroups';
import { CompactRow } from './CompactRow';

interface Props {
  group: AntragGroup;
  selectedAktenzeichen: string | null;
  onOpenAntrag: (aktenzeichen: string) => void;
}

/**
 * Eine Gruppe in der Kompakt-Liste: bei Verbund/Netzwerk (≥2 TVs) eine linke
 * 2px-Akzentbar in Primary-Color, dann untereinander eine `CompactRow` je TV.
 * Bei Einzel-Gruppe (1 TV) nur eine Row ohne Bar.
 *
 * Bei Netzwerk-Supergruppen (`group.netzwerkLabel` gesetzt) wird oberhalb der
 * TV-Rows eine einzeilige Netzwerk-Header-Row gerendert (Label + FKZ-Range +
 * Verbund-/Antrags-Count). Bei Verbund-Cluster und Solos: weiterhin nur
 * Akzentbar (Akronym steht ohnehin in jeder TV-Row).
 */
export function CompactGroup({
  group,
  selectedAktenzeichen,
  onOpenAntrag,
}: Props): React.ReactElement {
  const isMulti = group.tvs.length >= 2;
  const isNetzwerkSuper = group.netzwerkId !== null && group.netzwerkLabel !== null;
  const subCount = group.subGroups?.length ?? 0;
  const tvCount = group.tvs.length;
  const containerStyle: React.CSSProperties = isMulti
    ? {
      borderLeftWidth: '2px',
      borderLeftStyle: 'solid',
      borderLeftColor: 'var(--tf-primary)',
      paddingLeft: '6px',
    }
    : { paddingLeft: '8px' };

  return (
    <div className="flex flex-col" style={containerStyle}>
      {isNetzwerkSuper ? (
        <div className="flex items-center gap-2 min-w-0 py-0.5 flex-wrap">
          <span
            className="font-medium text-[11.5px] shrink-0"
            style={{ color: 'var(--tf-primary)' }}
          >
            {group.netzwerkLabel}
          </span>
          <span className="font-mono text-[10.5px] text-[var(--tf-text-tertiary)] shrink-0">
            {group.fkzRange}
          </span>
          {subCount > 0 ? (
            <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">
              {subCount} {subCount === 1 ? 'Verbund' : 'Verbünde'} · {tvCount} {tvCount === 1 ? 'Antrag' : 'Anträge'}
            </span>
          ) : null}
        </div>
      ) : null}
      {group.tvs.map(tv => (
        <CompactRow
          key={tv.aktenzeichen}
          tv={tv}
          selected={selectedAktenzeichen === tv.aktenzeichen}
          onClick={() => onOpenAntrag(tv.aktenzeichen)}
        />
      ))}
    </div>
  );
}
