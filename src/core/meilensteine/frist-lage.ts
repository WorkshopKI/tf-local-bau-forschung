/**
 * Die **Bearbeitungsfrist eines Verbunds**, wie der Meilenstein-Plan sie liest —
 * dieselbe, die die Frist-Spalte der Förderanträge zeigt.
 *
 * Bis v6.65 rechnete `bewerteVerbund` eine eigene 90-Tage-Uhr ab Anker, die nie
 * anhielt. Gemessen am 13.09.2026 (dev:local, 2 081 offene Verbünde) sagte sie
 * bei 1 917 „N Tage überfällig", während die Frist-Spalte bei 1 348 davon
 * „angehalten" zeigte, bei 90 „nicht berechenbar" und bei 151 „noch in der
 * Frist". Zweimal „90 Tage" mit verschiedenen Regeln — genau das, was
 * Bearbeiter verwirrte.
 *
 * Deshalb geht der Weg über die Listen-Projektion (`toAntragListItem`) und die
 * eine Faltung (`verbundFristErgebnis`): dieselben Felder, dieselbe Engine,
 * derselbe Halt wie in der Tabelle. Die Soll-Wochen zählen weiter ab dem Anker
 * (`anker.ts`); nur die Frist hat keine zweite Rechnung mehr.
 *
 * Rein: keine IO. Der Stichtag wird hereingereicht.
 */
import { verbundFristErgebnis } from '@/core/services/csv/frist-ergebnis';
import { toAntragListItem } from '@/core/services/csv/list-view';
import type { Antrag } from '@/core/services/csv/types';
import type { FristLage } from './typen';

export function verbundFristLage(antraege: readonly Antrag[], heute: string): FristLage {
  const e = verbundFristErgebnis(antraege.map(a => toAntragListItem(a)), Date.parse(heute));
  return { zustand: e.zustand, zielDatum: e.zielDatum ?? null };
}
