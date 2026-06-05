/**
 * Render-Container für eine Netzwerk-Supergruppe in der List-View.
 *
 * Die Gruppe trägt `subGroups[]` mit allen Verbund-Clustern und Einzelanträgen
 * innerhalb des Netzwerks. Außen umschließt diese Komponente den ganzen Block
 * mit einer dezenten Box + Netzwerk-Header; innen werden die Sub-Gruppen über
 * die unveränderte `AntragGroupCard` gerendert (Verbund-Klammer-Linie etc.
 * bleiben dadurch konsistent zur Default-Listen-Darstellung).
 *
 * Wird nur in der List-View verwendet — die Tabellen- und CardGrid-Ansicht
 * iterieren weiterhin flach über die Anträge.
 */
import type { AntragGroup } from './antragGroups';
import { AntragGroupCard } from './AntragGroupCard';

interface Props {
  group: AntragGroup;
  selectedAktenzeichen: string | null;
  onOpenAntrag: (aktenzeichen: string) => void;
  onOpenVerbund: (verbundId: string) => void;
  /** „alle"-Modus → MA-Kürzel je TV-Zeile anzeigen (an AntragGroupCard durchgereicht). */
  showMa?: boolean;
  narrow?: boolean;
}

export function NetzwerkClusterCard({
  group,
  selectedAktenzeichen,
  onOpenAntrag,
  onOpenVerbund,
  showMa = false,
  narrow = false,
}: Props): React.ReactElement {
  const subGroups = group.subGroups ?? [];
  const subCount = subGroups.length;
  const tvCount = group.tvs.length;
  const headTv = group.tvs[0]!;
  // Im Netzwerk-Modus sind die Sub-Gruppen entweder echte Verbünde (≥2 TVs
  // gleicher verbund_id) oder Einzelanträge. „Verbund" ist hier die User-
  // bevorzugte Sammelbezeichnung, auch wenn vereinzelt Solo-Sub-Gruppen
  // mitzählen — saubere Aufteilung wäre eigene Counts, aber dann wird der
  // Header unruhig.
  const subCountLabel = `${subCount} ${subCount === 1 ? 'Verbund' : 'Verbünde'}`;
  const tvCountLabel = `${tvCount} ${tvCount === 1 ? 'Antrag' : 'Anträge'}`;

  const onHeaderClick = (): void => {
    // Klick auf den Netzwerk-Header öffnet den Lead-Antrag (oder den ersten
    // TV der ersten Sub-Gruppe, falls kein Lead vorhanden ist).
    onOpenAntrag(headTv.aktenzeichen);
  };

  return (
    <div
      className="rounded-[var(--tf-radius)]"
      style={{
        borderWidth: '0.5px',
        borderStyle: 'solid',
        borderColor: 'var(--tf-border)',
        borderLeftWidth: '3px',
        borderLeftColor: 'var(--tf-primary)',
        padding: '2px 4px 4px 4px',
      }}
    >
      {/* Netzwerk-Header — klein, primary-coloriertes Label, FKZ-Range + Count rechts. */}
      <button
        type="button"
        onClick={onHeaderClick}
        className="w-full text-left px-2 py-1 rounded-[var(--tf-radius)] transition-colors hover:bg-[var(--tf-bg-secondary)]"
      >
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <span
            className={`font-medium shrink-0 ${narrow ? 'text-[12px]' : 'text-[12.5px]'}`}
            style={{ color: 'var(--tf-primary)' }}
          >
            {group.netzwerkLabel ?? `Netzwerk ${group.netzwerkId ?? ''}`}
          </span>
          <span className={`font-mono text-[var(--tf-text-tertiary)] ${narrow ? 'text-[10.5px]' : 'text-[11px]'}`}>
            {group.fkzRange}
          </span>
          <span className={`text-[var(--tf-text-tertiary)] ${narrow ? 'text-[10.5px]' : 'text-[11px]'}`}>
            {subCountLabel} · {tvCountLabel}
          </span>
        </div>
      </button>

      {/* Sub-Gruppen: Verbund-Cluster + Einzelanträge. Leicht eingerückt, damit
          die Hierarchie sichtbar ist. */}
      <div className="flex flex-col gap-0.5" style={{ paddingLeft: '6px' }}>
        {subGroups.map(sg => (
          <AntragGroupCard
            key={sg.tvs[0]!.aktenzeichen}
            group={sg}
            selectedAktenzeichen={selectedAktenzeichen}
            showMa={showMa}
            onOpenAntrag={onOpenAntrag}
            onOpenVerbund={onOpenVerbund}
            narrow={narrow}
            hideClusterAccent
          />
        ))}
      </div>
    </div>
  );
}
