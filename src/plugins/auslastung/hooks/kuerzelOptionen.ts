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
  /** Bearbeiter-Kürzel (Klartext, NFC+upper). */
  kuerzel: string;
  /** false = ehemalige:r Bearbeiter:in; in der Auswahl als „ehem." markiert. */
  aktiv: boolean;
}

/** Nur die Felder, die hier gelesen werden — hält die Testdaten klein. */
type AntragMitKuerzeln = Record<string, unknown>;

export function baueKuerzelOptionen(
  antraege: ReadonlyArray<AntragMitKuerzeln>,
  mapKuerzel: ReadonlyArray<string>,
  anonymMap: AnonymMap,
  mitarbeiter: Readonly<Record<string, AnonymerMitarbeiter>>,
): KuerzelOption[] {
  const kuerzelSet = new Set<string>();
  for (const a of antraege) {
    const fb = normalizeKuerzel(a[CANONICAL_TIB_KUERZ]);
    if (fb) kuerzelSet.add(fb);
    const ab = normalizeKuerzel(a[CANONICAL_BIB_KUERZ]);
    if (ab) kuerzelSet.add(ab);
  }
  for (const k of mapKuerzel) {
    const n = normalizeKuerzel(k);
    if (n) kuerzelSet.add(n);
  }

  const opts: KuerzelOption[] = [...kuerzelSet].map(kuerzel => {
    const anonId = anonymMap.toAnon.get(kuerzel);
    return { kuerzel, aktiv: mitarbeiter[anonId ?? '']?.aktiv ?? true };
  });
  // Aktive zuerst — die inaktiven bleiben sichtbar (viele PL waren früher selbst
  // Bearbeiter:innen und finden sich nur dort), stehen aber nicht im Weg.
  opts.sort((a, b) => {
    if (a.aktiv !== b.aktiv) return a.aktiv ? -1 : 1;
    return a.kuerzel.localeCompare(b.kuerzel, 'de');
  });
  return opts;
}
