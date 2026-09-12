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
import type { ColumnMapping, ColumnMappingEntry, CsvSchema } from './types';
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

// ---------------------------------------------------------------------------
// Entflechten
// ---------------------------------------------------------------------------

/**
 * Der Zusatz, mit dem eine zweite Spalte denselben Namen verlässt.
 *
 * Erst die **Konvention des Fachsystems**, weil sie den Unterschied schon
 * benennt: `D_` ist das Datum, `T_` der Text, `+`/`−` die Zusage und ihre
 * Verneinung (`PC+`/`PC-`, `XRN+`/`XRN-`). Ein `nachlieferung_termin_text` sagt,
 * was drinsteht; ein `nachlieferung_termin_2` sagt nur, dass es das zweite ist.
 */
function zusatzFuer(spalte: string): string[] {
  const s = spalte.trim();
  const out: string[] = [];
  if (s.endsWith('+')) out.push('plus');
  if (s.endsWith('-')) out.push('minus');
  if (/^D_/i.test(s)) out.push('datum');
  if (/^T_/i.test(s)) out.push('text');
  // Der Spaltenname selbst als letzte benannte Stufe — immer noch sprechender
  // als eine Zahl, weil er in der CSV-Kopfzeile nachschlagbar ist.
  out.push(s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, ''));
  return out.filter(Boolean);
}

/**
 * Ein Feld-Key, den in dieser Menge noch niemand hat.
 *
 * **Die eine Stelle, an der aus Bezeichnung + Spalte ein Schlüssel wird.** Der
 * Mapping-Wizard leitet den Namen aus der Label-XLS ab und hat bis v6.65 nicht
 * gefragt, ob ihn schon jemand trägt — bei gleicher Bezeichnung für `D_…` und
 * `T_…` (im Fachsystem der Normalfall) landeten beide auf einem Feld, und die
 * hintere überschrieb die vordere. Dazu kommt die Kürzung auf 40 Zeichen: zwei
 * verschiedene Bezeichnungen können allein dadurch zusammenfallen.
 *
 * `vergeben` wird **nicht** verändert — der Aufrufer entscheidet, wann ein Name
 * als belegt gilt.
 */
export function eindeutigerFeldKey(
  wunsch: string,
  spalte: string,
  vergeben: ReadonlySet<string>,
): string {
  if (!vergeben.has(wunsch)) return wunsch;
  for (const z of zusatzFuer(spalte)) {
    const kandidat = `${wunsch}_${z}`;
    if (!vergeben.has(kandidat)) return kandidat;
  }
  for (let i = 2; i < 100; i++) {
    const kandidat = `${wunsch}_${i}`;
    if (!vergeben.has(kandidat)) return kandidat;
  }
  return `${wunsch}_${Date.now()}`;
}

/** Eine Umbenennung, die das Entflechten vorschlägt bzw. vorgenommen hat. */
export interface Entflechtung {
  spalte: string;
  von: string;
  nach: string;
}

/**
 * Gibt jeder Spalte einen eigenen Feld-Key — **die erste behält ihren**.
 *
 * Warum die erste und nicht die „richtige": Umbenannt wird nur, was heute gar
 * nicht ankommt. Die erste Spalte ist die, deren Wert beim Merge überschrieben
 * WIRD; sie bekommt den Namen, den die Label-XLS für sie vorgesehen hat, und
 * damit ihren Wert zurück. Die hintere zieht auf einen neuen Namen um, unter dem
 * sie vorher nie stand — es kann also niemand von dort gelesen haben.
 *
 * **Was sich dadurch ändert, und das ist der Zweck:** Unter dem bisherigen Key
 * steht danach ein anderer Wert — bei `termin_fur_nachlieferung` das Datum
 * `08.09.2026` statt des Textes „Termin für Nachlieferung". Genau deshalb trafen
 * R10 und R27 auf keinen einzigen Vorgang zu.
 *
 * Wirksam wird das erst mit dem **nächsten Import** dieser Quelle: die Records
 * tragen die alten Schlüssel, bis sie neu geschrieben werden.
 *
 * Rein: verändert `mapping` nicht, liefert eine neue Zuordnung.
 */
export function entflechteFeldKeys(
  mapping: ColumnMapping,
): { mapping: ColumnMapping; umbenannt: Entflechtung[] } {
  const neu: ColumnMapping = {};
  const vergeben = new Set<string>();
  const umbenannt: Entflechtung[] = [];

  for (const [spalte, entry] of Object.entries(mapping)) {
    const key = resolveFieldKey(spalte, entry);
    if (key === null) {
      neu[spalte] = entry;
      continue;
    }
    // Standardfelder (`canonical`) bleiben unangetastet: ihr Name ist keine
    // Ableitung aus einer Bezeichnung, sondern das Schema der App. Zwei Spalten
    // auf einem Standardfeld sind ein anderer Fall — davor warnt der Wizard
    // bereits beim Bearbeiten (`conflictCanonicals`).
    if (entry.canonical) {
      vergeben.add(key);
      neu[spalte] = entry;
      continue;
    }
    const eindeutig = eindeutigerFeldKey(key, spalte, vergeben);
    vergeben.add(eindeutig);
    neu[spalte] = eindeutig === key ? entry : { ...entry, custom: eindeutig };
    if (eindeutig !== key) umbenannt.push({ spalte, von: key, nach: eindeutig });
  }

  return { mapping: neu, umbenannt };
}
