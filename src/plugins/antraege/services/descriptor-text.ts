/**
 * Sammelt alle Deskriptor-Werte + ZT-Klartexte eines Antrags als
 * such-/embedding-fertigen Text.
 *
 * Drei Quellen, ge-joined zu einem einzigen String:
 *  1. **TECHN_/BRANCHE_/ANWEND_-Werte** — sind selbst Labels (z.B.
 *     "Bauindustrie", "Leichtbau"). TECHN aus `readAntragDeskriptoren`,
 *     BRANCHE/ANWEND aus `WEITERE_DESKRIPTOR_SPALTEN` (siehe dort, warum die
 *     beiden Achsen NICHT über denselben Leser laufen).
 *  2. **ZT-Boolean-Flags** — 44 Spalten (`zt_*_tv` / `zt_*_vb`). Wenn `true`,
 *     kommt der zugehoerige Klartext aus `ZUKUNFTSTECHNOLOGIE_FELDER` rein
 *     (z.B. "Leichtbautechnologien", "Kuenstliche Intelligenz (KI)").
 *  3. Joined per ` • ` als Separator — gut sichtbar in Snippet-Previews
 *     und fuer Embeddings irrelevant (Tokenizer ignoriert Bullet).
 *
 * Reuses bestehende Infrastruktur:
 * - `readAntragDeskriptoren` aus `profil-aggregator.ts`
 * - `ZUKUNFTSTECHNOLOGIE_FELDER` aus `default-labels.ts`
 *
 * C16-CSVs speichern Boolean-Spalten heterogen: echtes `true`, `"X"`,
 * `"1"`, `"Ja"` etc. — wir matchen konservativ nur die bekannten
 * Wahr-Varianten. Alle anderen Werte (leer, `"0"`, `"-"`, `false`) gelten
 * als false.
 */
import type { Antrag } from '@/core/services/csv/types';
import { ZUKUNFTSTECHNOLOGIE_FELDER } from '@/plugins/auslastung/services/default-labels';
import { readAntragDeskriptoren } from '@/plugins/auslastung/services/identitaet';
import { ALL_DESKRIPTOREN_SPALTEN } from '@/plugins/auslastung/types';

/**
 * Branchen- und Anwendungsdomänen-Spalten — die Achsen, die
 * `readAntragDeskriptoren` **absichtlich** auslässt.
 *
 * Der Ausschluss dort ist richtig und bleibt: er schützt das Auslastungs-Matching
 * davor, einen KI-Querschnittsbearbeiter als Pflanzentechnologie-Experten zu
 * markieren (`ALL_DESKRIPTOREN_SPALTEN`, mit Regressionstest). Der SUCHKORPUS hat
 * diesen fremden Ausschluss aber stillschweigend geerbt, obwohl sein eigener
 * Modulkopf oben TECHN/BRANCHE/ANWEND zusagt: `deskriptor:Baugewerbe` lieferte
 * null Treffer, und die Achse „Anwendungsdomäne" war unauffindbar (v4.124).
 *
 * Am echten Bestand gemessen (14 225 Sätze): `anwend_1` 9 614 gefüllt,
 * `anwend_2..5` 1 308/336/89/30, `branche_1..5` 2 770/167/44/10/4 — alle mit
 * Textlabels („Verkehr und Nachrichtenübermittlung", „Baugewerbe").
 *
 * **Feste Liste statt Präfix-Suche**: dieselbe Messung zeigt fünf `techn_*`-
 * Spalten, die DATEN führen (`techn_bearb_za_erfolgt` = „2016-12-19"). Ein
 * `startsWith('techn')` zöge sie in den Suchtext.
 */
const WEITERE_DESKRIPTOR_SPALTEN: readonly string[] = [
  'branche_1', 'branche_2', 'branche_3', 'branche_4', 'branche_5',
  'anwend_1', 'anwend_2', 'anwend_3', 'anwend_4', 'anwend_5',
  // Zweite Schreibweise je nach Mapping (`schema-c.ts`: anwend_1, dann anwendung_2..5).
  'anwendung_1', 'anwendung_2', 'anwendung_3', 'anwendung_4', 'anwendung_5',
];

/** Die Werte der Branchen-/Anwendungs-Spalten in ihrer Schreibweise, ohne Dubletten. */
function weitereDeskriptoren(antrag: Antrag): string[] {
  const rec = antrag as unknown as Record<string, unknown>;
  const out: string[] = [];
  const gesehen = new Set<string>();
  for (const spalte of WEITERE_DESKRIPTOR_SPALTEN) {
    const roh = rec[spalte];
    if (typeof roh !== 'string') continue;
    const t = roh.trim();
    if (t.length === 0 || gesehen.has(t.toLowerCase())) continue;
    gesehen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

/** Heuristisch erkannte „wahr"-Varianten in C16-CSV-Exporten. */
function isTruthyFlag(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (typeof v !== 'string') return false;
  const trimmed = v.trim();
  if (trimmed.length === 0) return false;
  const upper = trimmed.toUpperCase();
  return upper === 'X' || upper === '1' || upper === 'TRUE' || upper === 'JA' || upper === 'Y';
}

export function buildDescriptorsText(antrag: Antrag): string {
  const parts: string[] = [];
  // Kategoriale Werte: TECHN aus dem geteilten Leser, BRANCHE/ANWEND daneben
  // (siehe `WEITERE_DESKRIPTOR_SPALTEN` — der Auslastungs-Ausschluss gilt dort,
  // nicht hier).
  parts.push(...readAntragDeskriptoren(antrag));
  parts.push(...weitereDeskriptoren(antrag));
  // ZT-Boolean-Flags → Klartext.
  const rec = antrag as unknown as Record<string, unknown>;
  for (const zt of ZUKUNFTSTECHNOLOGIE_FELDER) {
    if (isTruthyFlag(rec[zt.customField])) parts.push(zt.klartext);
  }
  return parts.join(' • ');
}

/**
 * Dieselben Werte EINZELN und in ihrer SCHREIBWEISE — für die
 * Vervollständigung im Suchfeld.
 *
 * Zwei Unterschiede zum Text oben, beide notwendig:
 *
 *  1. **Einzeln**, weil ein Vorschlag ein Wert sein muss, kein Stück eines
 *     Bullet-Strings.
 *  2. **Ungeklein**, weil er in einer Liste steht und gelesen wird.
 *     `readAntragDeskriptoren` normalisiert auf Kleinschreibung — richtig für
 *     das Matching der Auslastung, das es bedient, aber „iuk-technologien" in
 *     einer Vorschlagsliste sieht aus wie ein Datenfehler.
 *
 * WELCHE Werte es sind, entscheidet weiterhin `readAntragDeskriptoren` — dieselbe
 * Funktion, aus der der Suchtext entsteht. Hier wird ausschließlich die
 * Schreibweise zurückgeholt: aus der Rohspalte des Antrags, sonst aus dem
 * Klartext der Zukunftstechnologie. Ein eigener Lesepfad wäre die Gelegenheit,
 * Werte vorzuschlagen, die der Korpus gar nicht führt.
 */
export function deskriptorenAnzeige(antrag: Antrag): string[] {
  const rec = antrag as unknown as Record<string, unknown>;
  const schreibweise = new Map<string, string>();
  for (const spalte of ALL_DESKRIPTOREN_SPALTEN) {
    const roh = rec[spalte];
    if (typeof roh !== 'string') continue;
    const t = roh.trim();
    if (t.length > 0) schreibweise.set(t.toLowerCase(), t);
  }
  return [
    ...readAntragDeskriptoren(antrag).map(v => schreibweise.get(v) ?? ZT_ANZEIGE.get(v) ?? v),
    // Branche/Anwendung stehen hier schon in ihrer Schreibweise (der Leser oben
    // kennt sie nicht) — dieselbe Menge wie im Suchtext, damit die
    // Vorschlagsliste nichts anbietet, was der Korpus nicht führt.
    ...weitereDeskriptoren(antrag),
  ];
}

/** Kleinschreibung → Klartext der Zukunftstechnologien. Modul-global: die Liste
 *  ist fest, und `deskriptorenAnzeige` läuft über 14 000 Anträge. */
const ZT_ANZEIGE: ReadonlyMap<string, string> = new Map(
  ZUKUNFTSTECHNOLOGIE_FELDER.map(zt => [zt.klartext.toLowerCase(), zt.klartext]),
);

/**
 * Ist dieser Deskriptor-Wert ein **Zukunftsthema**?
 *
 * Der Topf „Deskriptoren" führt vier Achsen in einem: Technologiefeld
 * (`techn_*`), Branche, Anwendungsdomäne — und die 22 kuratierten
 * Zukunftstechnologien, die der Kürzelkatalog „ZT-Themenfelder" nennt. Am
 * echten Bestand sind fünf der zehn häufigsten Deskriptoren ZT-Themen; wer die
 * beiden nebeneinander zeigen will, muss sie trennen können, sonst stünde
 * dieselbe Zeile zweimal da.
 *
 * Verglichen wird klein geschrieben, weil `verdichteWertIndex` die
 * Schreibweisen ohnehin faltet und die häufigere anzeigt.
 */
export function istZukunftsthema(wert: string): boolean {
  return ZT_ANZEIGE.has(wert.trim().toLowerCase());
}
