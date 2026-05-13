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
 * Header-Zeile mit FKZ-Range + Akronym entfällt bewusst — in der Kompakt-View
 * stehen Akronym und FKZ in jeder Zeile, und die Akzentbar reicht visuell als
 * Gruppen-Indikator.
 */
export function CompactGroup({
  group,
  selectedAktenzeichen,
  onOpenAntrag,
}: Props): React.ReactElement {
  const isMulti = group.tvs.length >= 2;
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
