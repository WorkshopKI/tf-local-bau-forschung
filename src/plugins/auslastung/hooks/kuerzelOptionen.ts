/**
 * Reine Bau-Logik der Kürzel-Optionen für die Profil-Auswahl.
 *
 * Aus `useKuerzelFilterOptions` herausgelöst (v4.47), damit sie ohne React
 * prüfbar ist — die Regeln hier („wer taucht auf, wer gilt als aktiv, in welcher
 * Reihenfolge") sind fachlich, nicht Verdrahtung.
 *
 * **Zwei Bearbeiter-Spalten, ein Namensraum**: gesammelt werden `tib_kuerz`
 * (fachliche Bearbeitung) UND `bib_kuerz` (administrative Bearbeitung). Seit
 * auch AB-Leute mit der App arbeiten, wäre eine Auswahl ohne ihre Kürzel für sie
 * leer — obwohl der Filter beide Spalten längst matcht
 * (`BEARBEITER_FIELDS_LOWER` in `bearbeiterFilter.ts`). Ein Kürzel meint dieselbe
 * Person, in welcher Spalte es auch steht; die Liste bleibt deshalb flach.
 *
 * **Angezeigt wird die Schreibweise der Quelle** (v4.48): das Team schreibt
 * „THü", nicht „THÜ" — großgeschrieben liest ein Kürzel sich fremd. Verglichen
 * und ins Profil geschrieben wird weiter die Normalform, die Schreibweise
 * begleitet sie nur (`anzeige`).
 *
 * **Das `aktiv`-Flag bleibt tib-seitig**: es kommt aus der MA-Liste des
 * Auslastungs-Moduls, und die AnonymMap kennt ausschließlich `tib_kuerz`
 * (Pitfall #17/#18 — daran ändert diese Datei nichts). Ein Kürzel ohne
 * Map-Eintrag — neu, oder nur administrativ tätig — gilt als aktiv; das ist die
 * richtige Vorgabe, denn das Gegenteil („inaktiv") ist eine Aussage, die nur die
 * gepflegte MA-Liste treffen kann.
 */
import { normalizeKuerzel } from '../services/identitaet';
import type { AnonymMap } from '../services/identitaet';
import type { AnonymerMitarbeiter } from '../types';
import { CANONICAL_TIB_KUERZ, CANONICAL_BIB_KUERZ } from '../types';

export interface KuerzelOption {
  /** Vergleichs- und Speicherform (NFC+upper) — der Wert, der ins Profil geht. */
  kuerzel: string;
  /**
   * Schreibweise, wie das Team sie führt („THü", „JuHe"): NFC, aber
   * Groß-/Kleinschreibung unangetastet. **Nur zum Anzeigen** — verglichen und
   * gespeichert wird `kuerzel`, sonst hinge die Identität an einem Detail, das
   * je nach Quelle anders aussieht. 81 der 112 Kürzel im Bestand sind gemischt
   * geschrieben; großgeschrieben liest sie ihr Träger nicht als seine eigenen.
   */
  anzeige: string;
  /** false = ehemalige:r Bearbeiter:in; in der Auswahl als „ehem." markiert. */
  aktiv: boolean;
}

/** Nur die Felder, die hier gelesen werden — hält die Testdaten klein. */
type AntragMitKuerzeln = Record<string, unknown>;

/** Trimmt + NFC (Pitfall #22), lässt die Schreibweise aber stehen. */
function schreibweise(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t ? t.normalize('NFC') : null;
}

export function baueKuerzelOptionen(
  antraege: ReadonlyArray<AntragMitKuerzeln>,
  mapKuerzel: ReadonlyArray<string>,
  anonymMap: AnonymMap,
  mitarbeiter: Readonly<Record<string, AnonymerMitarbeiter>>,
): KuerzelOption[] {
  // Normalform → Schreibweise. Die erste gefundene gewinnt; eine reine
  // Großschreibung weicht aber einer gemischten, die später kommt — die
  // kuerzel-map führt ihre Einträge normalisiert, die Anträge im Original, und
  // die Reihenfolge der beiden Quellen soll das Ergebnis nicht bestimmen.
  // (Im echten Bestand widerspricht sich kein Kürzel selbst — 0 von 368 Werten
  // stehen in zwei Schreibweisen da.)
  const gefunden = new Map<string, string>();
  const merke = (raw: unknown): void => {
    const s = schreibweise(raw);
    if (!s) return;
    const norm = normalizeKuerzel(s);
    if (!norm) return;
    const bisher = gefunden.get(norm);
    if (bisher === undefined || (bisher === norm && s !== norm)) gefunden.set(norm, s);
  };

  for (const a of antraege) {
    merke(a[CANONICAL_TIB_KUERZ]);
    merke(a[CANONICAL_BIB_KUERZ]);
  }
  for (const k of mapKuerzel) merke(k);

  const opts: KuerzelOption[] = [...gefunden].map(([kuerzel, anzeige]) => {
    const anonId = anonymMap.toAnon.get(kuerzel);
    return { kuerzel, anzeige, aktiv: mitarbeiter[anonId ?? '']?.aktiv ?? true };
  });
  // Aktive zuerst — die inaktiven bleiben sichtbar (viele PL waren früher selbst
  // Bearbeiter:innen und finden sich nur dort), stehen aber nicht im Weg.
  opts.sort((a, b) => {
    if (a.aktiv !== b.aktiv) return a.aktiv ? -1 : 1;
    return a.kuerzel.localeCompare(b.kuerzel, 'de');
  });
  return opts;
}
