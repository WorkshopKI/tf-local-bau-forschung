/**
 * Benannte Spaltensätze der Fördertabelle — „Profile".
 *
 * Die Registry bietet über zwanzig feste Spalten an, dazu die kuratierten
 * Ordner-Spalten und die selbst angelegten. Sie einzeln an- und abzuhaken ist
 * der Sonderfall; der Normalfall ist „zeig mir den Satz für DIESE Arbeit".
 * Ein Profil ist deshalb **keine neue Mechanik**, sondern eine Voreinstellung
 * auf `useAntraegeColumnsStore.setVisibleColumns` — der Picker bleibt daneben
 * unverändert bedienbar, und wer eigene Haken setzt, landet auf `eigene`.
 *
 * `standard` ist bewusst als eigenes Profil geführt und nicht als „kein Profil":
 * die heutige Werkseinstellung IST ein sinnvoller Satz, und ohne ihn stünde der
 * Auslieferungszustand als Abweichung („eigene Auswahl") im Darstellungs-Menü.
 *
 * Rein und ohne React — die Liste wird auch vom Convention-Guard gelesen, der
 * prüft, dass jeder Key eine echte Spalte ist.
 */
import { ANTRAG_TABLE_COLUMNS, DEFAULT_VISIBLE_COLUMN_KEYS } from './tableColumns';

export type SpaltenProfilId = 'standard' | 'triage' | 'fristen' | 'alle';

/** Wert der Achse, wenn die Auswahl zu keinem Profil passt. Kein Profil-Id —
 *  er lässt sich nicht *setzen*, nur erreichen. */
export const EIGENE_AUSWAHL = 'eigene';

/**
 * Alle statischen Registry-Keys. **Ohne** die kuratierten Ordner-Spalten
 * (`katstatus:*`) und die selbst angelegten (`frei_*`): welche es davon gibt,
 * entscheiden Kuration bzw. Nutzer, nicht der Code — ein Profil, das sie
 * mitnimmt, hieße je Rechner etwas anderes.
 */
function alleStatischenKeys(): string[] {
  return ANTRAG_TABLE_COLUMNS.map(c => c.key);
}

export interface SpaltenProfil {
  id: SpaltenProfilId;
  label: string;
  /** Einzeiler für den Tooltip der Achse. */
  hinweis: string;
  keys: () => string[];
}

/**
 * Die Profile in Menü-Reihenfolge: vom gewohnten Satz über die zwei
 * Arbeitssätze bis zu „alles". Die Reihenfolge ist zugleich die des Segments.
 */
export const SPALTEN_PROFILE: readonly SpaltenProfil[] = [
  {
    id: 'standard',
    label: 'Standard',
    hinweis: 'Der gewohnte Satz: FKZ, Frist, AB-Kürzel, Akronym, Antragsteller, Status.',
    keys: () => [...DEFAULT_VISIBLE_COLUMN_KEYS],
  },
  {
    id: 'triage',
    label: 'Triage',
    hinweis: 'Zum Sichten: Frist, Status mit nächstem Schritt, Zuständigkeit und FB/PreCheck verdichtet, dazu der Titel.',
    keys: () => [
      'aktenzeichen',
      'frist',
      'akronym',
      'status_naechster_schritt',
      'zustaendig',
      'fb_precheck',
      'titel',
    ],
  },
  {
    id: 'fristen',
    label: 'Fristen',
    hinweis: 'Zur Terminkontrolle: Frist neben Antragseingang und Erstentscheidung.',
    keys: () => [
      'aktenzeichen',
      'frist',
      'akronym',
      'status_naechster_schritt',
      'antragsdatum',
      'erstentscheidung',
      'zustaendig',
    ],
  },
  {
    id: 'alle',
    label: 'Alle',
    hinweis: 'Jede feste Spalte der Registry — die Tabelle scrollt dann bewusst waagerecht.',
    keys: alleStatischenKeys,
  },
];

/** Der Standard, auf den „Zurücksetzen" im Darstellungs-Menü zeigt. */
export const DEFAULT_SPALTEN_PROFIL: SpaltenProfilId = 'standard';

/**
 * Welches Profil beschreibt diese Auswahl — oder keines?
 *
 * Mengenvergleich, nicht Reihenfolgen-Vergleich: die Anzeige-Reihenfolge macht
 * die Registry, die gespeicherte Liste ist die Toggle-Reihenfolge des Nutzers.
 * Ein Vergleich auf Gleichheit der Arrays meldete deshalb schon nach dem
 * ersten Aus- und Wiedereinschalten „eigene Auswahl".
 *
 * Nicht-statische Keys (Ordner-Spalten, eigene Spalten) zählen mit: wer eine
 * eigene Spalte einblendet, hat eben nicht mehr „Triage" vor sich.
 */
export function erkenneProfil(visibleKeys: readonly string[]): SpaltenProfilId | null {
  const ist = new Set(visibleKeys);
  for (const profil of SPALTEN_PROFILE) {
    const soll = new Set(profil.keys());
    if (soll.size !== ist.size) continue;
    let gleich = true;
    for (const k of soll) if (!ist.has(k)) { gleich = false; break; }
    if (gleich) return profil.id;
  }
  return null;
}

/** Die Keys eines Profils; leere Liste bei unbekannter Id (statt Absturz). */
export function keysVonProfil(id: string): string[] {
  return SPALTEN_PROFILE.find(p => p.id === id)?.keys() ?? [];
}

/**
 * Die Optionen der Achse — `Eigene` nur, wenn sie gerade zutrifft.
 *
 * Sie dauerhaft anzubieten wäre eine Attrappe: „eigene Auswahl" ist kein Satz,
 * den man wählen kann, sondern das Ergebnis eigener Haken im Picker. Sichtbar
 * muss sie trotzdem sein, sonst stünde das Segment ohne markierten Wert da und
 * sähe aus wie ein Fehler.
 */
export function spaltenProfilOptionen(
  aktiv: SpaltenProfilId | null,
): { key: string; label: string }[] {
  const basis = SPALTEN_PROFILE.map(p => ({ key: p.id, label: p.label }));
  return aktiv === null ? [...basis, { key: EIGENE_AUSWAHL, label: 'Eigene' }] : basis;
}
