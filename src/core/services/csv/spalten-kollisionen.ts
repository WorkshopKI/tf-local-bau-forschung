/**
 * **Zwei Quellspalten, ein Feld** — die stille Sorte Datenverlust.
 *
 * `resolveFieldKey` (merger/helpers.ts) bildet jede Spalte auf einen Feld-Key ab:
 * `canonical`, sonst `custom`, sonst der kleingeschriebene Spaltenname. Der Key
 * wird beim Merge als Objekt-Eigenschaft geschrieben — treffen sich zwei Spalten
 * auf demselben Key, gewinnt die **zuletzt geschriebene**, und die andere ist
 * weg. Ohne Fehlermeldung, ohne Eintrag im Bericht.
 *
 * Das passiert nicht aus Versehen im Code, sondern über die **Label-XLS**: der
 * Mapping-Wizard leitet `custom` aus der Bezeichnung ab, und das Fachsystem
 * vergibt für ein Datum (`D_…`) und seinen Text (`T_…`) regelmäßig dieselbe
 * Bezeichnung. Gemessen am Bestand vom 12.09.2026, drei Schemas, 549 gemappte
 * Spalten: **20 Kollisionen**, darunter
 *
 * - `termin_fur_nachlieferung ← D_ANT (date) + T_ANT (string)` — der Text
 *   „Termin für Nachlieferung" überschreibt das Datum 08.09.2026. Die beiden
 *   Regeln, die diesen Termin brauchen (R10 „Erinnerung an NF", R27), trafen
 *   deshalb auf **keinen einzigen** der 2.537 gemessenen Vorgänge zu: `gefuellt`
 *   sagt ja (ein Text ist nicht leer), `datumVor` sagt nein (ein Text ist kein
 *   Datum). Eine Regel, die nie greift und nie meckert.
 * - `nw_partner ← D_XRN+ (date) + D_XRN- (string)` — die Zusage und ihre
 *   Verneinung in einem Feld.
 * - `ausfuhrende_stelle ← PLZ_AFS + ORT_AFS + BULAND_AFS` — drei Adressteile,
 *   übrig bleibt das Bundesland.
 *
 * **Was das hier tut und was nicht.** Es findet und benennt; es repariert nicht.
 * Die Reparatur ist eine Kurations-Entscheidung (welche der beiden Spalten
 * bekommt einen eigenen Schlüssel, und wie heißt er) und läuft über den
 * Remap-Dialog. Automatisch umzubenennen hieße, einen Feldnamen zu erfinden, auf
 * den sich Filter, eigene Spalten und Regeln bereits beziehen könnten.
 *
 * Rein: keine IDB, kein React.
 */
import type { ColumnMappingEntry, CsvSchema } from './types';
import { resolveFieldKey } from './merger/helpers';

/** Eine Quellspalte, die sich den Feld-Key mit mindestens einer anderen teilt. */
export interface KollisionsSpalte {
  /** Der rohe Spaltenname aus der CSV-Kopfzeile (`D_ANT`). */
  spalte: string;
  /** Der deklarierte Wert-Typ (`date`, `string`, `number`, `boolean`). */
  typ: ColumnMappingEntry['type'];
  /** Die Bezeichnung aus der Label-XLS — die Quelle der Namensgleichheit. */
  label: string | undefined;
}

/** Ein Feld-Key, auf den mehr als eine Spalte zeigt. */
export interface SpaltenKollision {
  /** Der Feld-Key, unter dem die Werte im Antrag-Record landen. */
  feldKey: string;
  /** Die beteiligten Spalten, in Mapping-Reihenfolge. Immer mindestens zwei. */
  spalten: KollisionsSpalte[];
  /**
   * Sind unterschiedliche Typen beteiligt? Dann ist der Verlust **sicher
   * schädlich**: ein `date`, das von einem `string` überschrieben wird, ist für
   * jede Frist- und Regelrechnung verloren. Bei gleichem Typ ist es „nur" ein
   * überschriebener Wert — schlimm genug, aber ohne Folgefehler in der Mechanik.
   */
  typenGemischt: boolean;
}

/**
 * Alle Feld-Keys eines Schemas, auf die mehrere Spalten zeigen.
 *
 * Ignorierte Spalten (`ignore`) zählen nicht mit — sie werden gar nicht
 * geschrieben. Sortiert: gemischte Typen zuerst (der schädliche Fall), dann
 * nach Feld-Key, damit die Liste zwischen zwei Läufen stabil bleibt.
 */
export function findeSpaltenKollisionen(schema: CsvSchema): SpaltenKollision[] {
  const proKey = new Map<string, KollisionsSpalte[]>();

  for (const [spalte, entry] of Object.entries(schema.column_mapping ?? {})) {
    const key = resolveFieldKey(spalte, entry);
    if (key === null) continue;
    const liste = proKey.get(key);
    const eintrag: KollisionsSpalte = { spalte, typ: entry.type, label: entry.label };
    if (liste) liste.push(eintrag);
    else proKey.set(key, [eintrag]);
  }

  return [...proKey]
    .filter(([, spalten]) => spalten.length > 1)
    .map(([feldKey, spalten]) => ({
      feldKey,
      spalten,
      typenGemischt: new Set(spalten.map(s => s.typ)).size > 1,
    }))
    .sort((a, b) =>
      Number(b.typenGemischt) - Number(a.typenGemischt) || a.feldKey.localeCompare(b.feldKey, 'de'));
}

/**
 * Ein Satz für die Oberfläche — welche Spalte den Wert am Ende trägt.
 *
 * Bewusst konkret statt allgemein („Mehrfachbelegung erkannt"): Wer das liest,
 * soll ohne zweite Recherche wissen, welcher Wert fehlt.
 */
export function kollisionsSatz(k: SpaltenKollision): string {
  const letzte = k.spalten[k.spalten.length - 1];
  const verlierer = k.spalten.slice(0, -1).map(s => `${s.spalte} (${s.typ})`).join(', ');
  return `„${k.feldKey}" wird von ${k.spalten.length} Spalten beschrieben — `
    + `${letzte?.spalte} (${letzte?.typ}) überschreibt ${verlierer}.`;
}
