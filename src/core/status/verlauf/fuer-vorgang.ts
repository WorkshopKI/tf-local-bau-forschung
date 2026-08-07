/**
 * `baueVerlauf` für einen einzelnen Vorgang — die Fassade, die die Regeln der
 * Zuarbeit hält, damit kein Aufrufer sie anfassen muss.
 *
 * **Warum es diese Datei gibt.** `KUERZEL_TRIGGER_REGELN` sind ausnahmslos
 * `aktiv: false`: erfasst und prüfbar, nicht wirksam. Der Guard
 * `trigger-regeln-nur-im-verlauf` lässt sie deshalb nur unter
 * `src/core/status/verlauf/` lesen. Jede UI, die einen Verlauf zeigen will,
 * bräuchte ohne diese Fassade eine eigene Ausnahme im Guard — und die zweite
 * Ausnahme ist der Anfang vom Ende einer Regel.
 *
 * Hier bleibt der Zugriff an einer Stelle. Die Aufrufer reichen ihren Bezug
 * herein und bekommen Spuren zurück; die Regeln sehen sie nie.
 *
 * **Direkt importieren, nicht über das Barrel** (`@/core/status/verlauf/fuer-vorgang`):
 * `verlauf/index.ts` ist Barrel und Implementierung von `baueVerlauf` zugleich —
 * ein Re-Export von hier zurück wäre ein Laufzeit-Zyklus, und `npm run cycles`
 * hat eine leere Allowlist.
 *
 * Rein und deterministisch wie {@link baueVerlauf} selbst.
 */
import { KUERZEL_TRIGGER_REGELN } from '../kuerzel-trigger.data';
import type { AntragsChronik } from '../journal/lesen';
import type { MappingVersion } from '../typen';
import { baueVerlauf, type VerlaufsBezug, type VerlaufsOptionen } from './index';
import type { VerlaufsSpur } from './typen';

/**
 * Die Bahnen eines Vorhabens, gegen die Regeln der Kürzel-Zuarbeit gerechnet.
 *
 * @param journal Chronik **dieses** Vorhabens oder `null`. Die Chronik hängt am
 *   Antrag, die Spuren hängen am Verbund — wer die Chronik eines
 *   Teilvorhabens auf die Spuren seiner Nachbarn anwendet, behauptet
 *   Beobachtungen, die es nicht gibt. Im Zweifel `null`.
 */
export function baueVerlaufFuerVorgang(
  bezug: VerlaufsBezug,
  version: MappingVersion,
  journal: AntragsChronik | null,
  opts?: VerlaufsOptionen,
): VerlaufsSpur[] {
  return baueVerlauf(bezug, version, KUERZEL_TRIGGER_REGELN, journal, opts);
}
