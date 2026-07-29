/**
 * Auflösung Auslastungs-relevanter CSV-Felder (Vollständigkeit + erwartete TVs)
 * aus dem CSV-Schema.
 *
 * Hintergrund: Mehrere Auslastungs-Funktionen brauchen Werte bestimmter
 * Quell-Spalten — die **Vollständigkeits-Datums** D_XTEC (FuE/DS) / D_ADV (DL/NW)
 * sowie die **erwartete TV-Anzahl** T_XAT. Diese landen je nach Mapping unter dem
 * kanonischen Feld (Standardfeld) ODER unter einem Custom-Key (Eigenes Feld —
 * z.B. aus der Spalten-Beschreibung abgeleitet wie `alle_antrage_in_c16_eingegeben`
 * bzw. `anz_erw_tv`). Statt das Antrag-Feld fest zu verdrahten, lösen wir es über
 * die Schema-`column_mapping` anhand des Spalten-CODES (`D_XTEC` / `D_ADV` /
 * `T_XAT`) auf — damit funktioniert es unabhängig davon, ob der Kurator die Spalte
 * als Standard- oder als Eigenes Feld gemappt hat (Lehre aus v2.40, siehe
 * `docs/architecture/recurring-bug-classes.md` #5).
 */
import type { CsvSchema } from '@/core/services/csv/types';
import { resolveFieldKey } from '@/core/services/csv/merger/helpers';
import { CANONICAL_D_XTEC, CANONICAL_D_ADV } from '../../types';

/** Default-Feldname für die erwartete TV-Anzahl, falls T_XAT nicht im Schema
 *  gefunden wird (gebräuchlicher Custom-Key; wird nur gelesen, wenn gefunden). */
const DEFAULT_ERWARTETE_TVS_FELD = 'anz_erw_tv';

export interface VollstaendigkeitsFelder {
  /** Antrag-Feld-Key, in dem die D_XTEC-Spalte landet (Default: `d_xtec`). */
  xtecFeld: string;
  /** Antrag-Feld-Key, in dem die D_ADV-Spalte landet (Default: `d_adv`). */
  advFeld: string;
  /** Antrag-Feld-Key, in dem die T_XAT-Spalte (erwartete TV-Anzahl) landet. */
  erwarteteTvsFeld: string;
  /** True, wenn im Schema eine Spalte mit Code `D_XTEC` existiert (= der Kurator
   *  hat sie gemappt → Vollständigkeits-Prüfung ist „gewollt"). False = Fallback
   *  auf den kanonischen Default; treibt den Inaktiv-Hinweis im Klassifizieren-Tab. */
  xtecGefunden: boolean;
  /** Analog für die `D_ADV`-Spalte. */
  advGefunden: boolean;
  /** True, wenn eine `T_XAT`-Spalte im Schema existiert → erwartete TV-Anzahl
   *  anzeigbar. */
  erwarteteTvsGefunden: boolean;
}

export const DEFAULT_VOLLSTAENDIGKEITS_FELDER: VollstaendigkeitsFelder = {
  xtecFeld: CANONICAL_D_XTEC,
  advFeld: CANONICAL_D_ADV,
  erwarteteTvsFeld: DEFAULT_ERWARTETE_TVS_FELD,
  xtecGefunden: false,
  advGefunden: false,
  erwarteteTvsGefunden: false,
};

/** Normalisierung für den Spalten-Code-Vergleich: lower + ohne `_`/`-`/Space
 *  (analog `CANONICAL_FIELD_NAME_ALIASES`-Matching). `D_XTEC` → `dxtec`. */
const normCode = (s: string): string => s.toLowerCase().replace(/[\s_-]/g, '');

/**
 * Findet das Antrag-Feld zur CSV-Spalte mit Code `columnCode` (z.B. `D_XTEC`).
 * Master-Schema zuerst (es trägt die Vollständigkeits-Spalten). Aufgelöst über
 * `resolveFieldKey` (canonical → custom → `col.toLowerCase()`). Fallback bei
 * keinem Treffer: `fallback` (der kanonische Default).
 */
function resolveFeld(schemas: readonly CsvSchema[], columnCode: string, fallback: string): { feld: string; gefunden: boolean } {
  const target = normCode(columnCode);
  const ordered = [...schemas].sort((a, b) => (b.is_master ? 1 : 0) - (a.is_master ? 1 : 0));
  for (const sc of ordered) {
    const cm = sc.column_mapping ?? {};
    for (const col of Object.keys(cm)) {
      const entry = cm[col];
      if (!entry || entry.ignore) continue;
      if (normCode(col) === target) {
        const feld = resolveFieldKey(col, entry);
        if (feld) return { feld, gefunden: true };
      }
    }
  }
  return { feld: fallback, gefunden: false };
}

/**
 * Löst die Antrag-Feld-Keys für D_XTEC + D_ADV aus den Programm-Schemas auf.
 * Greift kein Schema (oder keine passende Spalte) → kanonische Defaults
 * (`d_xtec`/`d_adv`) = bisheriges Verhalten für sauber gemappte Quellen, plus
 * `*Gefunden: false` (treibt den Inaktiv-Hinweis).
 */
export function resolveVollstaendigkeitsFelder(schemas: readonly CsvSchema[]): VollstaendigkeitsFelder {
  const x = resolveFeld(schemas, 'D_XTEC', CANONICAL_D_XTEC);
  const a = resolveFeld(schemas, 'D_ADV', CANONICAL_D_ADV);
  // T_XAT = erwartete TV-Anzahl. `normCode('T_XAT')` = `txat` trifft NICHT
  // `T_XAT+` (`txat+`, das `+` bleibt erhalten) → kein Fehl-Match.
  const t = resolveFeld(schemas, 'T_XAT', DEFAULT_ERWARTETE_TVS_FELD);
  return {
    xtecFeld: x.feld,
    advFeld: a.feld,
    erwarteteTvsFeld: t.feld,
    xtecGefunden: x.gefunden,
    advGefunden: a.gefunden,
    erwarteteTvsGefunden: t.gefunden,
  };
}

export interface VollstaendigkeitsHinweisInput {
  /** Sind die Antrags-Stream-Artefakte (xtec/adv-Az-Sets) fertig geladen?
   *  false ⇒ IMMER `[]` — siehe Doc-Kommentar der Funktion. */
  datenBereit: boolean;
  /** Anzahl Verbünde im FuE/DS-Bucket (nur dann ist D_XTEC relevant). */
  fueDs: number;
  /** Anzahl Verbünde im DL/NW-Bucket (nur dann ist D_ADV relevant). */
  dlNw: number;
  felder: Pick<VollstaendigkeitsFelder, 'xtecFeld' | 'advFeld' | 'xtecGefunden' | 'advGefunden'>;
  /** Trägt IRGENDEIN Antrag ein gültiges Datum im jeweiligen Feld? */
  gate: { dxtec: boolean; dadv: boolean };
}

/**
 * Selbst-Diagnose gegen STUMME Fehlkonfiguration: eine D_XTEC/D_ADV-Spalte ist im
 * Schema gemappt (der Kurator WILL die Prüfung), aber das aufgelöste Feld trägt bei
 * KEINEM Antrag ein gültiges Datum → „Unvollständig"-Filter, Warndreieck und
 * Freigabe-Sperre laufen still ins Leere (Bug v2.40: Custom-Mapping → `d_xtec` leer).
 *
 * `datenBereit: false` ⇒ leeres Ergebnis. Die Gate-Flags stammen aus den Stream-
 * Artefakten des Antraege-Caches (Phase 2 von `useAntraegeCache.refresh`); solange die
 * laufen, sind die Az-Sets leer und die Diagnose würde einen FEHLALARM melden — der
 * User wird sonst beim ersten Modul-Aufruf grundlos ins CSV-Mapping geschickt.
 */
export function baueVollstaendigkeitsHinweise(input: VollstaendigkeitsHinweisInput): string[] {
  if (!input.datenBereit) return [];
  const { fueDs, dlNw, felder, gate } = input;
  const msgs: string[] = [];
  if (fueDs > 0 && felder.xtecGefunden && !gate.dxtec) {
    msgs.push(`FuE/DS: Spalte D_XTEC ist gemappt (Feld „${felder.xtecFeld}"), aber kein Antrag trägt dort ein gültiges Datum`);
  }
  if (dlNw > 0 && felder.advGefunden && !gate.dadv) {
    msgs.push(`DL/NW: Spalte D_ADV ist gemappt (Feld „${felder.advFeld}"), aber kein Antrag trägt dort ein gültiges Datum`);
  }
  return msgs;
}
