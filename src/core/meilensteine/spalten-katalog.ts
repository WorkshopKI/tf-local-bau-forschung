/**
 * Der Vorrat, aus dem die PL im Bedingungs-Editor wählt: **alle** Spalten, die
 * in irgendeinem Programm-Schema gemappt sind, plus die Statuswerte, die dabei
 * vorkommen können.
 *
 * Damit erfüllt sich die Anforderung „alle Stati aus der CSV anzeigen und
 * Meilensteinen zuordnen können", ohne dass jemand einen Spaltencode abtippen
 * muss.
 *
 * Das Spalten-Inventar selbst wohnt bei den CSV-Diensten
 * ([spalten-inventar.ts](../services/csv/spalten-inventar.ts)) — der
 * Status-Katalog braucht dasselbe Inventar für seine Spalten-Entdeckung, und
 * zwei Fassungen davon würden auseinanderlaufen. Hier bleibt nur, was
 * meilenstein-spezifisch ist.
 */
import { getCanonicalStatusEntries } from '@/core/utils/status-canonical';

export {
  baueSpaltenKatalog,
  type SpaltenEintrag,
  type SpaltenTyp,
} from '@/core/services/csv/spalten-inventar';

/**
 * Die Statuswerte, die für `ist`/`istNicht` angeboten werden — der kanonische
 * Wertevorrat aus `status-canonical`. Bewusst nicht aus den Live-Daten gezogen:
 * ein Wert, der gerade in keinem Antrag steht, muss trotzdem konfigurierbar sein
 * (sonst ließe sich ein Meilenstein für einen selten erreichten Zustand nie
 * anlegen).
 */
export function bekannteStatusWerte(): string[] {
  return getCanonicalStatusEntries()
    .map(([wert]) => wert)
    .sort((a, b) => a.localeCompare(b, 'de'));
}

/** Felder, auf denen `ist`/`istNicht` mit Werte-Auswahl sinnvoll ist. */
export const STATUS_FELDER: readonly string[] = ['status', 'verbund_status'];
