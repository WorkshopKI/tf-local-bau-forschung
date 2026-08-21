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
import type { KiRolle } from '@/core/services/ai/modell-katalog';
import { TEMPERATUR_ZWEITFASSUNG, type FassungMarker } from '@/core/services/ai/sampling';
import { ZIEL_LABEL } from './kontextWarnung';

export type ZweitfassungArt =
  /** Bridge: derselbe Prompt an den jeweils ANDEREN Tab. */
  | { art: 'ki'; ziel: KiRolle; label: string }
  /** Direkt angebundene KI: dasselbe Modell, andere Sampling-Einstellung. */
  | { art: 'temperatur'; temperatur: number; label: string };

/**
 * `label` ist die Dativ-Ergänzung zu „Zweitfassung mit …" — im selben Kasus wie
 * die Fenster-Angabe der Kontext-Warnung, damit beide Texte gleich klingen.
 */
export function bestimmeZweitfassung(bridgeAktiv: boolean, kiZiel: KiRolle): ZweitfassungArt {
  if (!bridgeAktiv) {
    return { art: 'temperatur', temperatur: TEMPERATUR_ZWEITFASSUNG, label: 'anderer Einstellung' };
  }
  const andere: KiRolle = kiZiel === 'stark' ? 'standard' : 'stark';
  return { art: 'ki', ziel: andere, label: ZIEL_LABEL(andere) };
}

/**
 * Beschriftung der Herkunft einer fertigen Fassung („· andere Einstellung").
 * `null` für Fassungen ohne Marker — das ist der Normalfall und soll nichts sagen.
 *
 * `'mutig'` ist der Marker aus v2.373, als der zweite Lauf eine HÖHERE Temperatur
 * fuhr. Die Messung hat diese Richtung verworfen (siehe [sampling.ts]); bereits
 * gespeicherte Fassungen behalten ihren Marker und werden hier mit übersetzt,
 * statt beim Lesen als „ohne Herkunft" durchzufallen.
 */
export function fassungLabel(fassung?: FassungMarker): string | null {
  return fassung === undefined ? null : 'andere Einstellung';
}
