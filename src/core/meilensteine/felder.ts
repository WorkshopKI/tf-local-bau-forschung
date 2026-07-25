/**
 * Feld-Auflösung der Meilenstein-Bedingungen.
 *
 * Eine Bedingung referenziert ein Feld über eine von zwei Schreibweisen:
 *
 * - **kanonischer Feld-Key** (`status`, `antragsdatum`, `tib_kuerz`, …) — liegt
 *   unter genau diesem Namen im Antrag-/Verbund-Record.
 * - **roher CSV-Spalten-CODE** (`D_PC+`, `D_QS`, `D_XTEC`, …) — der tatsächliche
 *   Record-Key hängt vom Mapping ab (Standardspalte, Eigenes Feld oder
 *   lowercase-Fallback). Er wird deshalb über die Programm-Schemas aufgelöst,
 *   niemals hart verdrahtet (recurring-bug-classes Klasse 5).
 *
 * Die Code-Auflösung ist bewusst dieselbe wie bei den Datums-Status-Gruppen
 * ([status-datum-gruppen.ts](../services/csv/status-datum-gruppen.ts)) — inklusive
 * ihrer NFC-/Sonderzeichen-Normalisierung, damit `D_ÄT` und `D_PC+` treffen.
 *
 * Rein: keine IO. Die Schemas reicht der Aufrufer herein.
 */
import { resolveStatusDatumFelder } from '@/core/services/csv/status-datum-gruppen';
import type { CsvSchema } from '@/core/services/csv/types';
import { baueKontext, type BedingungsKontext } from '@/core/status';
import type { Bedingung } from '@/core/status';
import type { MeilensteinKnoten, MeilensteinPlan } from './typen';

/** Ein aufgelöstes Bedingungs-Feld. */
export interface FeldAufloesung {
  /** So, wie die Bedingung es nennt. */
  feldId: string;
  /** So, wie es im Record steht. */
  recordKey: string;
  /** Anzeige-Label (Schema-Label bei CSV-Codes, sonst der Feld-Key). */
  label: string;
  /** True, wenn über einen CSV-Spalten-Code aufgelöst wurde. */
  viaSpaltenCode: boolean;
}

/** Alle Feld-Referenzen eines Bedingungs-Baums (dedupliziert, Reihenfolge stabil). */
export function feldRefsAusBedingung(b: Bedingung, out: string[] = []): string[] {
  if ('alle' in b) {
    for (const x of b.alle) feldRefsAusBedingung(x, out);
  } else if ('einige' in b) {
    for (const x of b.einige) feldRefsAusBedingung(x, out);
  } else if (!out.includes(b.feldId)) {
    out.push(b.feldId);
  }
  return out;
}

/** Alle Feld-Referenzen eines Knotens: Bedingung + `istDatumFeld`. */
export function feldRefsAusKnoten(k: MeilensteinKnoten): string[] {
  const out = feldRefsAusBedingung(k.bedingung);
  if (k.istDatumFeld && !out.includes(k.istDatumFeld)) out.push(k.istDatumFeld);
  return out;
}

/** Alle Felder, die ein Plan zur Auswertung braucht (dedupliziert). */
export function benoetigteFelder(plan: MeilensteinPlan): string[] {
  const out: string[] = [];
  for (const k of plan.knoten) {
    for (const f of feldRefsAusKnoten(k)) if (!out.includes(f)) out.push(f);
  }
  return out;
}

/**
 * Löst die Feld-Referenzen gegen die Programm-Schemas auf. Was als CSV-Code
 * gefunden wird, bekommt den gemappten Record-Key; alles übrige bleibt als
 * kanonischer Key stehen (Identität). Ein CSV-Code, den kein Schema kennt, wird
 * dadurch zu einem Record-Key, der schlicht nie gefüllt ist — die Bedingung
 * evaluiert zu `false`, statt zu werfen.
 */
export function loeseFelderAuf(
  schemas: readonly CsvSchema[],
  feldIds: readonly string[],
): FeldAufloesung[] {
  const perCode = new Map(
    resolveStatusDatumFelder(schemas, feldIds).map(f => [f.code, f]),
  );
  return feldIds.map(feldId => {
    const treffer = perCode.get(feldId);
    if (treffer) {
      return { feldId, recordKey: treffer.feld, label: treffer.label, viaSpaltenCode: true };
    }
    return { feldId, recordKey: feldId, label: feldId, viaSpaltenCode: false };
  });
}

/** Liest einen Record-Wert als getrimmten String; Zahlen werden konvertiert. */
function leseWert(rec: Record<string, unknown>, key: string): string {
  const v = rec[key];
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  return '';
}

/**
 * Baut den Auswertungs-Kontext eines Verbunds: je aufgelöstem Feld alle Werte,
 * die im Verbund-Record und in den Teilvorhaben stehen — abgelegt unter der
 * `feldId`, die die Bedingung nennt.
 *
 * Die Ebene wird bewusst NICHT unterschieden: der Verbund-Record trägt nur
 * Status/Titel, alle Datumsspalten liegen auf TV-Ebene. Ein Meilenstein gilt für
 * den Verbund, sobald IRGENDEIN Teilvorhaben ihn belegt (`einige`-Semantik der
 * Blatt-Prädikate).
 */
export function baueMeilensteinKontext(
  aufloesung: readonly FeldAufloesung[],
  verbundRecord: Record<string, unknown>,
  antraege: readonly { aktenzeichen: string; record: Record<string, unknown> }[],
): BedingungsKontext {
  const felder: Record<string, string> = {};
  const tvFelder: Record<string, Record<string, string>> = {};

  for (const f of aufloesung) {
    const w = leseWert(verbundRecord, f.recordKey);
    if (w) felder[f.feldId] = w;
  }
  for (const a of antraege) {
    const rec: Record<string, string> = {};
    for (const f of aufloesung) {
      const w = leseWert(a.record, f.recordKey);
      if (w) rec[f.feldId] = w;
    }
    if (Object.keys(rec).length > 0) tvFelder[a.aktenzeichen] = rec;
  }
  return baueKontext(felder, tvFelder);
}
