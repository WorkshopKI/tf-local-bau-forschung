/**
 * Frist und Meilensteine einer Zeile — **eine Datenhülle, keine Rechnung**.
 *
 * Bis v3.30 stand hier die schlichte Liste aus Phase 2 und daneben ein zweiter
 * Aufruf von `fristFuerVorkommen` mit denselben Eingaben wie im Hook. Beides ist
 * weg: gerechnet hat `useZeilenVerlauf` (samt Verlaufsquelle fürs Haltedatum),
 * dargestellt wird im [FristenBand](../fristen-band/FristenBand.tsx) — Achse
 * plus beschriftete Herleitung in einem Bauteil.
 */
import { isMeilensteinMonitoringEnabled } from '@/config/feature-flags';
import type { WaechterErgebnis } from '@/core/status/waechter';
import { useVerbundMeilensteine } from '../meilensteine/useVerbundMeilensteine';
import { FristenBand } from '../fristen-band/FristenBand';
import { useFristenBandModell } from '../fristen-band/useFristenBand';
import type { ZeilenVerlauf } from './useZeilenVerlauf';

const leise = 'text-[11px] text-[var(--tf-text-tertiary)]';

/**
 * Der Meilenstein-Teil — eigene Komponente, damit sein Hook nicht bedingt läuft
 * und der Reiter ohne Verbund-Id gar nicht erst danach fragt.
 */
function MitMeilensteinen({ verbundId, daten, statusRoh, stichtag, istVerbundZeile, waechter }: {
  verbundId: string;
  daten: ZeilenVerlauf;
  statusRoh: unknown;
  stichtag: string;
  istVerbundZeile: boolean;
  waechter: WaechterErgebnis | null;
}): React.ReactElement | null {
  const api = useVerbundMeilensteine(verbundId);
  const an = isMeilensteinMonitoringEnabled();
  const modell = useFristenBandModell({
    version: daten.quelle.version,
    frist: daten.frist,
    // Der Status dieser Zeile — nicht der des Verbunds. Die beiden gehen im
    // Bestand regelmäßig auseinander; die Frist des einen neben den Zieltagen
    // des anderen wäre ein Band über zwei verschiedene Vorgänge. (Dieselbe
    // Zeile speist auch den Wächter, der von oben hereinkommt.)
    statusRoh,
    stichtag,
    waechter,
    meilensteine: an ? api.bewertung : null,
  });
  if (modell === null) return null;
  return (
    <>
      <FristenBand
        modell={modell}
        meilensteine={an ? api.bewertung : null}
        knoten={api.plan?.knoten ?? []}
      />
      {istVerbundZeile && daten.quelle.jeTeilvorhaben.length > 1 && (
        <p className={leise}>
          Über alle {daten.quelle.jeTeilvorhaben.length} Teilvorhaben; maßgeblich
          ist das späteste Eingangsdatum.
        </p>
      )}
    </>
  );
}

/** Dieselbe Anzeige ohne Verbund — dann gibt es keine Meilensteine. */
function OhneMeilensteine({ daten, statusRoh, stichtag, waechter }: {
  daten: ZeilenVerlauf; statusRoh: unknown; stichtag: string;
  waechter: WaechterErgebnis | null;
}): React.ReactElement | null {
  const modell = useFristenBandModell({
    version: daten.quelle.version,
    frist: daten.frist,
    statusRoh,
    stichtag,
    waechter,
    meilensteine: null,
  });
  return modell === null ? null : <FristenBand modell={modell} meilensteine={null} knoten={[]} />;
}

export function FristenReiter({
  daten, istVerbundZeile, statusRoh, stichtag, verbundId, waechter,
}: {
  /** Der fertige Zeilen-Zustand — **inklusive der einen Fristrechnung**. */
  daten: ZeilenVerlauf;
  /** Verdichtete Verbund-Zeile? Dann zählen alle Teilvorhaben, sonst nur dieses. */
  istVerbundZeile: boolean;
  /** Der Status DIESER Zeile — Verbund oder Teilvorhaben, nie gemischt. */
  statusRoh: unknown;
  /** ISO-Tag. */
  stichtag: string;
  verbundId: string | null;
  /** Der eine Wächter dieser Zeile — auch die Verlaufs-Bahn liest ihn. */
  waechter: WaechterErgebnis | null;
}): React.ReactElement {
  if (daten.quelle.laden) return <p className={leise}>Lädt …</p>;
  if (!daten.quelle.version || !daten.frist) {
    return <p className={leise}>Kein Statuskatalog geladen.</p>;
  }
  return (
    // Die Lesebreite sitzt HIER, nicht am `ZeilenBereich`: seit v3.32 spannt der
    // Bereich über die sichtbare Tabellenbreite, damit die Verlaufs-Bahn sie
    // nutzen kann. Fließtext über 1200 px wäre unlesbar — der Deckel gehört
    // deshalb an den Reiter, der Text zeigt.
    <div className="flex flex-col gap-3 max-w-[820px]">
      {verbundId !== null
        ? (
          <MitMeilensteinen
            verbundId={verbundId} daten={daten} statusRoh={statusRoh}
            stichtag={stichtag} istVerbundZeile={istVerbundZeile} waechter={waechter}
          />
        )
        : (
          <OhneMeilensteine
            daten={daten} statusRoh={statusRoh} stichtag={stichtag} waechter={waechter}
          />
        )}
    </div>
  );
}
