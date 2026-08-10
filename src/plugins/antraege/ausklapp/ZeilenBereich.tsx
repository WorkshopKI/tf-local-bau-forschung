/**
 * Der aufgeklappte Bereich unter einer Tabellenzeile — **die Hülle**.
 *
 * Beide Zellen (Status und Frist) öffnen denselben Kasten; die geklickte wählt
 * nur den Reiter vor. Zwei getrennte Bereiche übereinander wären dieselbe
 * Information zweimal umrandet.
 *
 * Escape schließt. Der Fokus bleibt dabei auf der Zelle, die geöffnet hat —
 * der Bereich zieht ihn nie zu sich, sonst verlöre man beim Zumachen die
 * Position in der Tabelle.
 *
 * **Hier stehen nur die Hooks, gebaut wird in [AusklappInhalt](AusklappInhalt.tsx).**
 * Die Meilenstein-Daten hängen an einem Hook, der eine Verbund-Id braucht —
 * deshalb die zwei Hüllen darunter statt einer bedingten Hook-Reihenfolge
 * (React #310). Gerechnet wird jede Größe **einmal**: Frist und Spuren in
 * `useZeilenVerlauf`, der Stillstand in `useZeilenWaechter`, die Meilensteine in
 * `useVerbundMeilensteine` — Kopfkarte, Achse und Gliederung lesen dasselbe
 * Ergebnis.
 */
import { useMemo } from 'react';
import { isMeilensteinMonitoringEnabled, isVorgangssystemEnabled } from '@/config/feature-flags';
import { findeStatusCode } from '@/core/status';
import { zieltageFuer } from '@/core/status/waechter';
import type { WaechterErgebnis } from '@/core/status/waechter';
import { useVerbundMeilensteine } from '../meilensteine/useVerbundMeilensteine';
import { AusklappInhalt } from './AusklappInhalt';
import type { MeilensteinLage } from './meilensteinLage';
import { useZeilenVerlauf, type ZeilenVerlauf } from './useZeilenVerlauf';
import { useZeilenWaechter } from './useZeilenWaechter';
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

/** Was beide Hüllen unverändert weiterreichen. */
interface InhaltBasis {
  zeilenKey: string;
  verbundId: string | null;
  istVerbundZeile: boolean;
  daten: ZeilenVerlauf;
  waechter: WaechterErgebnis | null;
  zieltage: number | null;
  haengtFest: { art: 'verbund' | 'tv'; id: string } | null;
  stichtag: string;
  reiter: ReiterId;
  onReiter: (r: ReiterId) => void;
  zeitverlaufAn: boolean;
}

const NICHTS = async (): Promise<void> => { /* ohne Verbund gibt es nichts zu melden */ };

/**
 * Mit Verbund: der Meilenstein-Hook läuft und liefert die Lage.
 *
 * Der `stichtag` geht mit hinein — sonst bewertete er gegen `new Date()`,
 * während die Frist gegen den gestempelten Tag rechnet, und „271 Tage über der
 * Frist" stünde neben „326 T offen" aus zwei Gegenwarten.
 */
function MitMeilensteinen({ verbundId, basis }: {
  verbundId: string; basis: InhaltBasis;
}): React.ReactElement {
  const api = useVerbundMeilensteine(verbundId, basis.stichtag);
  const lage: MeilensteinLage = useMemo(() => {
    if (!isMeilensteinMonitoringEnabled()) return { art: 'flagAus' };
    if (api.laden) return { art: 'laedt' };
    if (api.plan === null || api.bewertung === null) return { art: 'ohnePlan' };
    return { art: 'da', knoten: api.plan.knoten, bewertung: api.bewertung };
  }, [api.laden, api.plan, api.bewertung]);

  return (
    <AusklappInhalt
      {...basis} lage={lage} melden={api.melden} nurLokal={api.nurLokal}
    />
  );
}

/** Ohne Verbund gibt es keinen Plan — und nichts zu melden. */
function OhneMeilensteine({ basis }: { basis: InhaltBasis }): React.ReactElement {
  const lage: MeilensteinLage = isMeilensteinMonitoringEnabled()
    ? { art: 'ohneVerbund' }
    : { art: 'flagAus' };
  return <AusklappInhalt {...basis} lage={lage} melden={NICHTS} nurLokal={false} />;
}

export function ZeilenBereich({
  zeilenKey, verbundId, istVerbundZeile, statusRoh,
  reiter, onReiter, onSchliessen, stichtag,
}: ZeilenBereichProps): React.ReactElement {
  const zeitverlaufAn = isVorgangssystemEnabled();
  const daten = useZeilenVerlauf(verbundId, zeilenKey, stichtag, istVerbundZeile, statusRoh);
  // EINE Rechnung für beide Reiter (v3.38): die Kopfkarte zeigt den Stillstand
  // als Faktum, die Verlaufs-Bahn markiert damit ihren aktuellen Abschnitt.
  // Zweimal gerechnet liefen sie beim ersten Sonderfall auseinander.
  const waechter = useZeilenWaechter({
    version: daten.quelle.version,
    vorkommen: daten.vorkommen,
    statusRoh,
    stichtag,
    journalAenderung: daten.journalAb,
  });
  const zieltage = useMemo(
    () => (daten.quelle.version === null
      ? null
      : zieltageFuer(daten.quelle.version, findeStatusCode(statusRoh)?.eintrag.code ?? null)),
    [daten.quelle.version, statusRoh],
  );
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

  const basis: InhaltBasis = {
    zeilenKey, verbundId, istVerbundZeile, daten, waechter, zieltage, haengtFest,
    stichtag, reiter, onReiter, zeitverlaufAn,
  };

  return (
    <div
      id={bereichsId(zeilenKey)}
      role="region"
      aria-label={`Details zu ${zeilenKey}`}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onSchliessen(); } }}
      // Der Kasten füllt, was `TableBody` ihm gibt — die SICHTBARE Tabellen-
      // breite (`portBreite`), nie die volle, womöglich weit nach rechts
      // laufende Tabelle. Der Deckel gegen unlesbar lange Zeilen sitzt seit
      // v3.32 dort, wo Fließtext steht, nicht hier: die Bahn im Zeitverlauf ist
      // eine Grafik und will jeden Pixel.
      className="w-full px-3 py-2.5"
    >
      {verbundId === null
        ? <OhneMeilensteine basis={basis} />
        : <MitMeilensteinen verbundId={verbundId} basis={basis} />}
    </div>
  );
}
