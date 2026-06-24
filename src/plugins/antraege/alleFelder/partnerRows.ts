/**
 * Verbundpartner-Tabelle (Hebel 2): die `Wert / Wert / Wert`-Slash-Suppe wird zu
 * einer Zeile pro Teilvorhaben aufgelöst. Reine Ableitung (testbar).
 *
 * Adress-/Kosten-Felder via `findFieldValue` — **AST bevorzugt, AFS als Fallback**
 * (in den Dev-Fixtures sind nur die AFS-Varianten gemappt; die echten SMB-Schemas
 * liefern die AST-Spalten). Koordinator-Markierung über `isNetzwerkLead` bzw. den
 * ersten TV, wenn kein expliziter Netzwerk-Lead in der Liste ist.
 */
import type { Antrag } from '@/core/services/csv/types';
import { isNetzwerkLead } from '../netzwerk';
import { findFieldValue } from '../fieldLookup';
import { parseEuroish } from './format';

export interface PartnerRow {
  aktenzeichen: string;
  name: string;
  istKoordinator: boolean;
  typ: string | null;
  ort: string | null;
  plz: string | null;
  bl: string | null;
  kosten: number | null;
}

const NAME_ALIASES = ['antragsteller_ast', 'ORG_AST', 'Org Ast'];
const ORT_AST = ['ort_ast', 'ORT_AST'];
const ORT_AFS = ['ort_afs', 'ORT_AFS'];
const PLZ_AST = ['plz_ast', 'PLZ_AST'];
const PLZ_AFS = ['plz_afs', 'PLZ_AFS'];
const BL_AST = ['buland_ast', 'BULAND_AST'];
const BL_AFS = ['buland_afs', 'BULAND_AFS'];
const TYP_ALIASES = ['ast_typ', 'ATTR_TEXT', 'attribut', 'ATTR_AUFB'];
const KOSTEN_ALIASES = [
  'beantragte Kosten (Deckblatt Mantelbogen)', 'beantragte_kosten', 'beantragte kosten',
  'beantragtekosten', 'kosten_beantragt',
];

function str(v: unknown): string | null {
  if (typeof v !== 'string') return v == null ? null : String(v);
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/** AST-Wert bevorzugt, AFS-Fallback. */
function astOrAfs(tv: Antrag, ast: string[], afs: string[]): string | null {
  return str(findFieldValue(tv, ast)) ?? str(findFieldValue(tv, afs));
}

/**
 * Baut die Partner-Zeilen. Reihenfolge = Eingabe-Reihenfolge (Caller liefert
 * lead-first sortiert). Koordinator: expliziter Netzwerk-Lead, sonst der erste
 * TV, falls die Liste keinen Netzwerk-Lead enthält.
 */
export function buildPartnerRows(tvs: Antrag[]): PartnerRow[] {
  const anyLead = tvs.some(t => isNetzwerkLead(t));
  return tvs.map((tv, idx) => ({
    aktenzeichen: tv.aktenzeichen,
    name: str(findFieldValue(tv, NAME_ALIASES)) ?? str(tv.antragsteller) ?? '—',
    istKoordinator: isNetzwerkLead(tv) || (!anyLead && idx === 0),
    typ: str(findFieldValue(tv, TYP_ALIASES)),
    ort: astOrAfs(tv, ORT_AST, ORT_AFS) ?? str(tv.ort_ast as unknown),
    plz: astOrAfs(tv, PLZ_AST, PLZ_AFS),
    bl: astOrAfs(tv, BL_AST, BL_AFS),
    kosten: parseEuroish(findFieldValue(tv, KOSTEN_ALIASES)),
  }));
}

/** Summe der Partner-Kosten; `null`, wenn keine Zeile einen Kostenwert hat. */
export function sumPartnerKosten(rows: PartnerRow[]): number | null {
  let sum = 0;
  let any = false;
  for (const r of rows) {
    if (r.kosten !== null) { sum += r.kosten; any = true; }
  }
  return any ? sum : null;
}
