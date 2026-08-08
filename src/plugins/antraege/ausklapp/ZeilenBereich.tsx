/**
 * Der aufgeklappte Bereich unter einer Tabellenzeile — **ein** Bereich, zwei
 * Reiter.
 *
 * Beide Zellen (Status und Frist) öffnen denselben Kasten; die geklickte wählt
 * nur den Reiter vor. Zwei getrennte Bereiche übereinander wären dieselbe
 * Information zweimal umrandet.
 *
 * Escape schließt. Der Fokus bleibt dabei auf der Zelle, die geöffnet hat —
 * der Bereich zieht ihn nie zu sich, sonst verlöre man beim Zumachen die
 * Position in der Tabelle.
 */
import { useMemo } from 'react';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import { useZeilenVerlauf } from './useZeilenVerlauf';
import { useZeilenWaechter } from './useZeilenWaechter';
import { VerlaufReiter } from './VerlaufReiter';
import { FristenReiter } from './FristenReiter';
import { bereichsId, type ReiterId } from './ausklappZustand';

export interface ZeilenBereichProps {
  /** Zeilenschlüssel = Aktenzeichen (bei Verbund-Körnung das des Lead-TVs). */
  zeilenKey: string;
  verbundId: string | null;
  /** Verdichtete Verbund-Zeile? Entscheidet, welche Teilvorhaben zählen. */
  istVerbundZeile: boolean;
  /** Roher Status der Zeile, wie importiert. */
  statusRoh: unknown;
  reiter: ReiterId;
  onReiter: (r: ReiterId) => void;
  onSchliessen: () => void;
  /** ISO-Tag. Ende der Verlaufs-Achse und Stichtag der Frist. */
  stichtag: string;
}

function Reiter({ id, aktiv, onClick, kinder }: {
  id: ReiterId; aktiv: boolean; onClick: () => void; kinder: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={aktiv}
      onClick={onClick}
      className={`px-3 py-1.5 text-[12.5px] cursor-pointer border-b-2 ${
        aktiv
          ? 'text-[var(--tf-text)] border-[var(--tf-text)] font-medium'
          : 'text-[var(--tf-text-secondary)] border-transparent'
      }`}
      data-reiter={id}
    >
      {kinder}
    </button>
  );
}

export function ZeilenBereich({
  zeilenKey, verbundId, istVerbundZeile, statusRoh,
  reiter, onReiter, onSchliessen, stichtag,
}: ZeilenBereichProps): React.ReactElement {
  const verlaufAn = isVorgangssystemEnabled();
  const daten = useZeilenVerlauf(verbundId, zeilenKey, stichtag, istVerbundZeile, statusRoh);
  // EINE Rechnung für beide Reiter (v3.38): der Fristen-Reiter zeigt den
  // Stillstand ausführlich, die Verlaufs-Bahn markiert damit ihren aktuellen
  // Abschnitt. Zweimal gerechnet liefen sie beim ersten Sonderfall auseinander.
  const waechter = useZeilenWaechter({
    version: daten.quelle.version,
    vorkommen: daten.vorkommen,
    statusRoh,
    stichtag,
    journalAenderung: daten.journalAb,
  });
  // Der Wächter urteilt über den VORGANG dieser Zeile. Die Marke gehört deshalb
  // an genau die Bahn, die diese Zeile IST — bei einer verdichteten Verbundzeile
  // an die Verbundbahn, sonst an die des Teilvorhabens.
  const haengtFest = useMemo(
    () => (waechter?.urteil !== 'haengt'
      ? null
      : istVerbundZeile && verbundId !== null
        ? { art: 'verbund' as const, id: verbundId }
        : { art: 'tv' as const, id: zeilenKey }),
    [waechter, istVerbundZeile, verbundId, zeilenKey],
  );
  // Der Reiter *Verlauf* existiert nur mit Flag; ohne ihn ist „Fristen" der
  // einzige — und dann braucht es keine Leiste.
  const reiterListe = useMemo(
    () => (verlaufAn
      ? [{ id: 'verlauf' as const, label: 'Verlauf' }, { id: 'fristen' as const, label: 'Fristen und Meilensteine' }]
      : [{ id: 'fristen' as const, label: 'Fristen und Meilensteine' }]),
    [verlaufAn],
  );
  const aktiv: ReiterId = verlaufAn ? reiter : 'fristen';

  return (
    <div
      id={bereichsId(zeilenKey)}
      role="region"
      aria-label={`Details zu ${zeilenKey}`}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onSchliessen(); } }}
      // Der Kasten füllt, was `TableBody` ihm gibt — die SICHTBARE Tabellen-
      // breite (`portBreite`), nie die volle, womöglich weit nach rechts
      // laufende Tabelle. Der Deckel gegen unlesbar lange Zeilen sitzt seit
      // v3.32 dort, wo Fließtext steht (`FristenReiter`), nicht hier: die Bahn
      // im Verlaufs-Reiter ist eine Grafik und will jeden Pixel.
      className="w-full px-3 py-2.5"
    >
      <div className="flex items-center gap-1 border-b border-[var(--tf-border)] mb-2" role="tablist">
        {reiterListe.map(r => (
          <Reiter
            key={r.id} id={r.id} aktiv={aktiv === r.id}
            onClick={() => onReiter(r.id)} kinder={r.label}
          />
        ))}
      </div>

      {aktiv === 'verlauf' ? (
        <VerlaufReiter
          spuren={daten.spuren}
          eigenes={zeilenKey}
          journalAb={daten.journalAb}
          journalGenutzt={daten.journalGenutzt}
          laden={daten.laden}
          bezugsZeitpunkt={daten.bezugsZeitpunkt}
          fassung={daten.quelle.version === null ? null : `Fassung ${daten.quelle.version.version}`}
          haengtFest={haengtFest}
        />
      ) : (
        <FristenReiter
          daten={daten}
          istVerbundZeile={istVerbundZeile}
          statusRoh={statusRoh}
          stichtag={stichtag}
          verbundId={verbundId}
          waechter={waechter}
        />
      )}
    </div>
  );
}
