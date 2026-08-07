/**
 * Wie ein **roher Antragsstatus** heißt — an genau einer Stelle.
 *
 * **Warum es diese Datei gibt.** Bis v3.15 führten drei Module ihre eigene
 * Kurzform desselben Statuswerts: `STATUS_LABELS` in `status-mappings.ts`
 * (26 Paare), `STATUS_LABEL_OVERRIDES` in `plugins/suche/columns.tsx` (4 Paare,
 * abweichende Schreibweise, ein Tippfehler „Wiederspr.") und ein Literal in
 * `plugins/antraege/arbeitsvorrat.ts`. Derselbe Status sah je nach Ansicht
 * anders aus. Zwei der Kopien schlüsselten Code 72 sogar unter verschiedenen
 * Schreibweisen — die Fassung in `STATUS_LABELS` hat im Produktivbestand
 * deshalb **nie** gegriffen, dort steht ausschließlich die Langform.
 *
 * Das ist dieselbe Konsolidierung, die {@link ../utils/status-category-labels}
 * eine Ebene höher für die Arbeitslisten-Achse gemacht hat. Der Unterschied:
 * dort sind es neun feste Kategorien, hier dreißig amtliche Codes, die die PL
 * überschreiben können soll.
 *
 * **Drei Stufen, per Schlüssel einzeln.** Nicht wie `getStatusCategory` die
 * ganze Map tauschen: eine Fassung, die eine Schreibweise nicht führt, würde
 * ihr sonst die Kurzform wegnehmen, obwohl der Code-Katalog sie kennt (genau
 * dieser Fehler ist in `snapshot.ts` für die Kategorie schon einmal passiert).
 *
 *   1. `fassung`  — `StatusWertEintrag.kurzLabel`, von der PL kuratiert
 *   2. `katalog`  — `StatusCodeEintrag.kurz`, die Auslieferung
 *   3. `ohne`     — nichts gepflegt ⇒ der volle Bezeichner, bei Bedarf an der
 *                   Wortgrenze gekürzt und mit „…" **sichtbar unfertig**
 *
 * Leerer String heißt auf jeder Stufe „nicht gepflegt", nicht „leeres Label" —
 * daher `?.trim() ||` statt `??`. Ein leergeräumtes Eingabefeld im Cockpit darf
 * keine leere Pille erzeugen.
 *
 * **Warum die Kurzform groß und der Tooltip klein geschrieben ist.** `kurz` ist
 * unsere Beschriftung, `text` sind Fremddaten aus der Parametertabelle
 * (Pitfall #43). Code 59 heißt dort amtlich `bewilligt`; die Pille sagt
 * `Bewilligt`, der Tooltip `bewilligt`. Das ist kein Fehler, sondern die
 * Trennung. Wer die Schreibweise im Tooltip ändern will, pflegt das kuratierte
 * `label` am Statuswert — der amtliche Text bleibt unangetastet.
 *
 * Einbahn-Abhängigkeit wie in `status-canonical.ts`: `core/utils` →
 * `core/status/{status-codes,typen}` (beides Blätter). NIE über das Barrel
 * `@/core/status` — das zöge `snapshot.ts` und damit dieses Modul zurück.
 */
import { STATUS_CODE_KATALOG, KURZLABEL_MAX } from '@/core/status/status-codes';
import { normalisiereSchreibfehler, quellsystemZusatz } from '@/core/status/schreibfehler';
import { normalisiereWert } from '@/core/status/typen';

/** Lange und kurze Schreibweise eines Statuswerts. */
export interface StatusBeschriftung {
  /** Voller Bezeichner — Tooltip, Export, Prompt. */
  lang: string;
  /** Kurzform für enge Flächen; leer = auf dieser Stufe nicht gepflegt. */
  kurz: string;
}

/** Aus welcher Stufe die Kurzform kam. Gehört ins Herleitungs-Popover. */
export type LabelHerkunft = 'fassung' | 'katalog' | 'ohne';

export interface KurzLabel {
  text: string;
  herkunft: LabelHerkunft;
  /** Nur bei `herkunft: 'ohne'` möglich: der Bezeichner war zu lang. */
  gekuerzt: boolean;
}

/**
 * Die Auslieferung, aufgefächert über **alle** Schreibweisen eines Codes.
 * `lang` ist immer der amtliche Text — auch für eine Variante: wer „Ablehnung"
 * liest, soll im Tooltip „Ablehnung versandt" sehen.
 */
const EINGEBAUT: ReadonlyMap<string, StatusBeschriftung> = (() => {
  const m = new Map<string, StatusBeschriftung>();
  for (const e of STATUS_CODE_KATALOG) {
    const b: StatusBeschriftung = { lang: e.text, kurz: e.kurz };
    for (const schreibweise of [e.text, ...e.varianten]) {
      const k = normalisiereWert(schreibweise);
      if (k && !m.has(k)) m.set(k, b);
    }
  }
  return m;
})();

/**
 * Der optionale Katalog-Snapshot. Gesetzt wird er **ausschließlich** von
 * `src/core/status/snapshot.ts` (core/status → core/utils, kein Zyklus) — dort
 * hängen alle Register der aktiven Fassung an einem Schreibweg.
 *
 * Ohne Snapshot (prod ohne `statusCockpit`, Tests, früher Boot) greift allein
 * `EINGEBAUT`; bei einer Fassung ohne eigene Kuration ist das Ergebnis
 * bitweise gleich (`label-identitaet.test.ts`).
 */
let snapshotLabels: ReadonlyMap<string, StatusBeschriftung> | null = null;

/** Setzt (oder löscht mit `null`) das Beschriftungs-Register. Siehe oben. */
export function setStatusLabelSnapshot(
  m: ReadonlyMap<string, StatusBeschriftung> | null,
): void {
  snapshotLabels = m;
}

/**
 * Der Nachschlage-Schlüssel eines Rohwerts.
 *
 * **Belegte Schreibfehler des Quellsystems werden hier aufgelöst** — an genau
 * einer Stelle, damit `statusLabel` und `statusKurzLabelMit` gemeinsam greifen
 * (Pitfall #50: eine Quelle). Die Bestandsdaten bleiben unberührt; wer den
 * Rohwert sehen will, bekommt ihn über `quellsystemZusatz`.
 */
function schluessel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const k = normalisiereWert(normalisiereSchreibfehler(raw));
  return k.length === 0 ? null : k;
}

/**
 * Der **volle Bezeichner** eines rohen Statuswerts: kuratiertes Label, sonst
 * die amtliche Bezeichnung, sonst der Rohwert selbst. Nie leer, solange etwas
 * hineingegeben wurde.
 */
export function statusLabel(raw: unknown): string {
  const k = schluessel(raw);
  if (k === null) return typeof raw === 'string' ? raw : '';
  return snapshotLabels?.get(k)?.lang.trim()
    || EINGEBAUT.get(k)?.lang
    || (raw as string);
}

/**
 * Der volle Bezeichner **samt Rohwert**, wo ein Schreibfehler des Quellsystems
 * aufgelöst wurde: `VN geprüft (im Quellsystem: „VN gegrüft“)`.
 *
 * Gehört in jeden Tooltip, der den Status ausschreibt. Ohne den Zusatz sähe
 * jemand „VN geprüft" und suchte im Fachsystem vergeblich danach.
 */
export function statusLabelMitQuelle(raw: unknown): string {
  const lang = statusLabel(raw);
  const zusatz = quellsystemZusatz(raw);
  return zusatz === null ? lang : `${lang} (${zusatz})`;
}

/**
 * Kürzt einen Bezeichner an der Wortgrenze und macht die Kürzung sichtbar.
 * Inklusive „…" bleibt das Ergebnis auf {@link KURZLABEL_MAX} — sonst wäre die
 * Kürzung breiter als das, wofür gekürzt wird.
 */
function kuerze(lang: string): { text: string; gekuerzt: boolean } {
  if (lang.length <= KURZLABEL_MAX) return { text: lang, gekuerzt: false };
  const platz = KURZLABEL_MAX - 1;                       // ein Zeichen fürs „…"
  const roh = lang.slice(0, platz);
  const luecke = roh.lastIndexOf(' ');
  const stamm = luecke > 0 ? roh.slice(0, luecke) : roh;
  return { text: `${stamm.replace(/[\s,;:.-]+$/, '')}…`, gekuerzt: true };
}

/**
 * Die **Kurzform** samt Herkunft. Die Herkunft ist keine Diagnose für
 * Entwickler, sondern die Auskunft, die das Herleitungs-Popover einem Kurator
 * gibt: steht hier eure Fassung, die Auslieferung, oder ist nichts gepflegt?
 */
export function statusKurzLabelMit(raw: unknown): KurzLabel {
  const k = schluessel(raw);
  if (k !== null) {
    const ausFassung = snapshotLabels?.get(k)?.kurz.trim();
    if (ausFassung) return { text: ausFassung, herkunft: 'fassung', gekuerzt: false };
    const ausKatalog = EINGEBAUT.get(k)?.kurz.trim();
    if (ausKatalog) return { text: ausKatalog, herkunft: 'katalog', gekuerzt: false };
  }
  const { text, gekuerzt } = kuerze(statusLabel(raw));
  return { text, herkunft: 'ohne', gekuerzt };
}

/** Die Kurzform für enge Flächen. Daneben gehört immer ein Tooltip mit
 *  {@link statusLabel} — die Kurzform allein ist nicht selbsterklärend. */
export function statusKurzLabel(raw: unknown): string {
  return statusKurzLabelMit(raw).text;
}
