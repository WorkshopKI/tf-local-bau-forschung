/**
 * ModulLadeStreifen (v2.352) — EIN Ladezustand fuer das Auslastungs-Modul,
 * Nachfolger des `ModulLoadingBanner`-Kastens (v2.10).
 *
 * Warum der Umbau: der alte Kasten war eines von DREI gleichzeitigen Lade-Signalen
 * (Kasten + „Themen-Vektoren werden geladen …" + Skeletons), er schob den Inhalt
 * beim Erscheinen nach unten und zeigte einen erfundenen Sekunden-Countdown (feste
 * 5→0-Heuristik, keine echte Restzeit).
 *
 * Jetzt zwei Teile, die sich denselben Platz mit vorhandener UI teilen:
 *  - dieser Streifen: eine 2 px hohe, unbestimmt laufende Leiste unter dem
 *    Seitenkopf. Die 2 px sind IMMER reserviert (`invisible` statt Ausbau), damit
 *    das Fertigwerden keinen Layout-Sprung erzeugt;
 *  - `ladePhasenText()`: der Klartext dazu, den [AuslastungView](../views/AuslastungView.tsx)
 *    in die ohnehin vorhandene Kopf-Zeile (`79 MAs · 5 Kategorien · …`) haengt —
 *    also ohne eine zusaetzliche Zeile aufzumachen.
 *
 * Beides speist sich aus `useAuslastungReady().phase`, der einzigen Quelle dafuer,
 * was gerade haengt.
 */
import { useAuslastungReady, type LadePhase } from '../hooks/useAuslastungReady';

const PHASEN_TEXT: Record<LadePhase, string> = {
  auslastungsdaten: 'Auslastungsdaten laden …',
  antraege: 'Anträge laden …',
  themenvektoren: 'Themen-Vektoren laden …',
};

/** Klartext zur Lade-Phase; `null` wenn nichts laedt. */
export function ladePhasenText(phase: LadePhase | null): string | null {
  return phase ? PHASEN_TEXT[phase] : null;
}

export function ModulLadeStreifen(): React.ReactElement {
  const { phase } = useAuslastungReady();
  return (
    <div
      className={`tf-ladeleiste mb-4 ${phase ? '' : 'invisible'}`}
      role="status"
      aria-live="polite"
      aria-label={phase ? PHASEN_TEXT[phase] : undefined}
    />
  );
}
