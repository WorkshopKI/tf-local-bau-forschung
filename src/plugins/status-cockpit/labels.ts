/**
 * Geteilte Beschriftungen + Formularklassen für die Status-Cockpit-Tabs.
 *
 * Rein darstellend: deutsche Labels für die Enums (StatusCategory,
 * Prominenz, Werkzeug), die Aufzähl-Reihenfolgen für Selects/Filter und die
 * gemeinsamen Feld-Klassen (aus dem ChecklistenEditor-Muster übernommen).
 */
import { parseGermanDate, formatGermanDate } from '@/core/services/csv/dateParse';
import { KATEGORIE_TEXTE, getStatusCategoryLabel } from '@/core/utils/status-category-labels';
import {
  type StatusCategory, type Prominenz, type Werkzeug,
  type StatusFeldEintrag,
} from '@/core/status';

/**
 * Die Arbeitslisten-Bezeichnungen — **abgeleitet**, nicht hier gepflegt.
 * Bis v2.409 stand hier eine eigene Tabelle; sie war eines von vier Vokabularen
 * für dieselben neun Werte (`status-category-labels.ts`).
 */
export const KATEGORIE_LABEL: Record<StatusCategory, string> = Object.fromEntries(
  (Object.keys(KATEGORIE_TEXTE) as StatusCategory[]).map(k => [k, getStatusCategoryLabel(k)]),
) as Record<StatusCategory, string>;

export const PROMINENZ_LABEL: Record<Prominenz, string> = {
  meilenstein: 'Meilenstein',
  normal: 'Normal',
  nebensaechlich: 'Nebensächlich',
  ignoriert: 'Ignoriert',
};

export const WERKZEUG_LABEL: Record<Werkzeug, string> = {
  gutachten: 'Gutachten',
  nachforderung: 'Nachforderung',
  ablehnung: 'Ablehnung',
};

export const EBENE_LABEL: Record<'verbund' | 'tv', string> = {
  verbund: 'Verbund',
  tv: 'Teilvorhaben',
};

export const TYP_LABEL: Record<StatusFeldEintrag['typ'], string> = {
  wert: 'Wert',
  datum: 'Datum',
  text: 'Text',
};

/** Kategorie-Werte in Taxonomie-Reihenfolge (für Selects + Filter-Pills). */
export const KATEGORIE_WERTE: readonly StatusCategory[] = [
  'offen', 'in_pruefung', 'nachforderung', 'entscheidung',
  'bewilligt', 'begleitung', 'abgelehnt', 'abgeschlossen', 'sonstige',
];

/** Prominenz-Werte (für Selects + Filter-Pills). */
export const PROMINENZ_WERTE: readonly Prominenz[] = [
  'meilenstein', 'normal', 'nebensaechlich', 'ignoriert',
];

/** Die Reiter der Seite. Der Schlüssel ist stabil, die Beschriftung nicht. */
export type TabKey = 'katalog' | 'felder' | 'regeln' | 'klaerfragen';

const TAB_KEYS: readonly TabKey[] = ['katalog', 'felder', 'regeln', 'klaerfragen'];

/**
 * Der Reiter aus `?tab=` — für Deep-Links von außerhalb (`/status-cockpit?tab=regeln`
 * aus dem Vorgangs-Board). Unbekannter Wert ⇒ `null`, der Aufrufer bleibt dann
 * beim Standard-Reiter statt auf einer leeren Seite zu landen.
 */
export function tabAusParameter(roh: string | null): TabKey | null {
  return TAB_KEYS.find(k => k === roh) ?? null;
}

/**
 * Reiter-Beschriftungen — **eine** Quelle, wie bei den Kategoriebezeichnungen.
 *
 * `katalog` hieß bis v2.412 „Katalog" und damit fast wie die Seite selbst; ein
 * Reiter, der den Seitennamen wiederholt, trägt keine Information. Der
 * Schlüssel bleibt `katalog` — er steht in gespeicherten Zuständen und in
 * Deep-Links, und eine Umbenennung dort brächte nichts als Bruch.
 */
export const TAB_LABEL: Record<TabKey, string> = {
  katalog: 'Statuswerte',
  felder: 'Kürzel',
  regeln: 'To-do-Regeln',
  klaerfragen: 'Klärfragen',
};

/**
 * Ein Satz je Reiter: was dort gepflegt wird und wozu.
 *
 * Das Modul ist neu, und kein Reitername sagt von sich aus, was dahinter zu tun
 * ist. „To-do-Regeln" statt „To-dos" ist derselbe Gedanke in der Beschriftung:
 * wer „To-dos" liest, erwartet seine Aufgaben — die stehen im Vorgangs-Board,
 * hier wird die Kaskade gepflegt, die sie erzeugt.
 */
export const TAB_ZWECK: Record<TabKey, string> = {
  katalog: 'Was ein Status bedeutet, in welchem Verfahrensschritt er steht und wie lange '
    + 'er dauern darf.',
  felder: 'Die Felder des Fachsystems, wer sie setzt und welche als Aktivität zählen.',
  regeln: 'Die geordnete Kaskade, die bestimmt, welche Aufgabe an einem Vorgang ansteht.',
  // „Klärfragen" gegen „Zu klären": dort ein Fragebogen, den das Team IN der App
  // beantwortet; hier eine Ableitung aus dem Bestand, die als Datei herausgeht.
  // Der Satz muss den Unterschied tragen, sonst liest sich der Reiter wie eine
  // Dublette des Moduls nebenan.
  klaerfragen: 'Was am Katalog fachlich offen ist — aus dem Bestand abgeleitet und als '
    + 'Arbeitsmappe zum Herumreichen. Beantwortet wird außerhalb der App.',
};

/**
 * Wie `feldKlasse`, aber **ohne** `w-full` — für Felder, die ihre Breite selbst
 * setzen (`w-[64px]`, `flex-1`).
 *
 * Warum getrennt und nicht einfach eine Breite dahinter: `w-full` steht im
 * erzeugten Stylesheet HINTER den Arbitrary-Values (`.w-[64px]` bei 20 202 035,
 * `.w-full` bei 20 202 869) und gewinnt bei gleicher Spezifität. Ein
 * `${feldKlasse} w-[64px]` ist also 100 % breit; zusammen mit `shrink-0`
 * fordert das Feld die ganze Zeile und quetscht seine Nachbarn auf null.
 */
export const feldKlasseSchmal =
  'text-[12.5px] rounded px-2 py-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)]';

/** Gemeinsame Klasse für Inline-Formularfelder (Select/Input), dicht. */
export const feldKlasse = `w-full ${feldKlasseSchmal}`;

/** Haarlinien-Rahmen für Inline-Formularfelder (einzige erlaubte Inline-Style-Ausnahme). */
export const feldStil: React.CSSProperties = { border: '0.5px solid var(--tf-border)' };

/** ISO-Zeitstempel → `DD.MM.YYYY`; leer/ungültig → `—`.
 *  Über dieselbe Parse-/Format-Kette wie der Rest der App — nur das `—` für
 *  „nichts anzuzeigen" ist Cockpit-eigen. */
export function formatDatum(iso?: string): string {
  const tag = iso ? parseGermanDate(iso) : null;
  return tag ? formatGermanDate(tag) : '—';
}

/** ISO-Zeitstempel → `DD.MM.YYYY, HH:MM`; leer/ungültig → `—`. */
export function formatZeitpunkt(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
