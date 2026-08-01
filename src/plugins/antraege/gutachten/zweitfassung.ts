/**
 * Was eine „Zweitfassung" konkret variiert — das hängt daran, womit die App
 * gerade spricht.
 *
 * Über die **Bridge** gibt es zwei Tabs (Standard/agentisch), also variiert der
 * zweite Lauf die KI. Bei einer **direkt angebundenen** KI gibt es nur ein Modell;
 * dort variiert er die Sampling-Temperatur. Beides erzeugt eine zweite Fassung
 * desselben Abschnitts, aber es ist nicht dasselbe — deshalb steht die Art in der
 * Beschriftung und wird am Lauf festgehalten, statt sie im Verlauf zu verschweigen.
 *
 * Vorher entfiel der Menü-Eintrag ohne Bridge ersatzlos (`zielWirktAuf` → `null`):
 * ausgerechnet am lokalen Modell, wo der Vergleich am billigsten ist.
 *
 * Rein — kein Store, kein Transport.
 */
import type { BridgeZiel } from '@/core/services/ai/transports/streamlit';
import { TEMPERATUR_MUTIG } from '@/core/services/ai/sampling';
import { ZIEL_DATIV } from './kontextWarnung';

export type ZweitfassungArt =
  /** Bridge: derselbe Prompt an den jeweils ANDEREN Tab. */
  | { art: 'ki'; ziel: BridgeZiel; label: string }
  /** Direkt angebundene KI: dasselbe Modell, mehr Streuung. */
  | { art: 'temperatur'; temperatur: number; label: string };

/**
 * `label` ist die Dativ-Ergänzung zu „Zweitfassung mit …" — im selben Kasus wie
 * die Fenster-Angabe der Kontext-Warnung, damit beide Texte gleich klingen.
 */
export function bestimmeZweitfassung(bridgeAktiv: boolean, kiZiel: BridgeZiel): ZweitfassungArt {
  if (!bridgeAktiv) {
    return { art: 'temperatur', temperatur: TEMPERATUR_MUTIG, label: 'mutigerer Einstellung' };
  }
  const andere: BridgeZiel = kiZiel === 'agentisch' ? 'standard' : 'agentisch';
  return { art: 'ki', ziel: andere, label: ZIEL_DATIV[andere] };
}

/**
 * Beschriftung der Herkunft einer fertigen Fassung („· mutigere Einstellung").
 * `null` für Fassungen ohne Marker — das ist der Normalfall und soll nichts sagen.
 */
export function fassungLabel(fassung?: 'mutig'): string | null {
  return fassung === 'mutig' ? 'mutigere Einstellung' : null;
}
