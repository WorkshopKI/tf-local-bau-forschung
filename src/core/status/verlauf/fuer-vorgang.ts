/**
 * `baueVerlauf` für einen einzelnen Vorgang — der eine Einstieg für die Anzeige.
 *
 * **Warum es diese Datei (weiter) gibt.** Bis v3.22 hielt sie die Regeln der
 * Kürzel-Zuarbeit, damit kein Aufrufer den Guard `trigger-regeln-nur-im-verlauf`
 * umgehen musste. Seit v3.23 ist die Regelquelle C16, und die kommt vom Share —
 * der Aufrufer MUSS sie hereinreichen. Geblieben ist die Aufgabe darunter: die
 * Aufrufer sollen `VerlaufsBezug` bauen und Spuren bekommen, ohne zu wissen, wie
 * die Regeln indiziert werden.
 *
 * **Direkt importieren, nicht über das Barrel** (`@/core/status/verlauf/fuer-vorgang`):
 * `verlauf/index.ts` ist Barrel und Implementierung von `baueVerlauf` zugleich —
 * ein Re-Export von hier zurück wäre ein Laufzeit-Zyklus, und `npm run cycles`
 * hat eine leere Allowlist.
 *
 * Rein und deterministisch wie {@link baueVerlauf} selbst.
 */
import type { AntragsChronik } from '../journal/lesen';
import type { MappingVersion, TriggerZeile } from '../typen';
import { baueVerlauf, type VerlaufsBezug, type VerlaufsOptionen } from './index';
import type { VerlaufsSpur } from './typen';

/**
 * Die Bahnen eines Vorhabens, gerechnet gegen die C16-Trigger-Tabelle.
 *
 * @param trigger Die geladene Tabelle (`ladeTrigger`), ungefiltert. Die Auswahl
 *   auf die Richtlinie des Vorgangs macht `baueVerlauf` über
 *   `bezug.programm` — ein Ersatz-Programm gibt es nicht (Pitfall #44).
 * @param journal Chronik **dieses** Vorhabens oder `null`. Die Chronik hängt am
 *   Antrag, die Spuren hängen am Verbund — wer die Chronik eines
 *   Teilvorhabens auf die Spuren seiner Nachbarn anwendet, behauptet
 *   Beobachtungen, die es nicht gibt. Im Zweifel `null`.
 */
export function baueVerlaufFuerVorgang(
  bezug: VerlaufsBezug,
  version: MappingVersion,
  trigger: readonly TriggerZeile[],
  journal: AntragsChronik | null,
  opts?: VerlaufsOptionen,
): VerlaufsSpur[] {
  return baueVerlauf(bezug, version, trigger, journal, opts);
}
