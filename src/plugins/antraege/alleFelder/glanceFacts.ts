/**
 * „Auf einen Blick" (Hebel 1): kuratiertes 8-Fakten-Raster aus den TVs eines
 * Verbundes. Reine Ableitung (testbar) — die UI (`VerbundGlance`) ist dünn.
 *
 * Custom-Felder (Netzwerk, beantragte Kosten, Laufzeit, Pre-Check, Nachforderung)
 * werden über `findFieldValue` aufgelöst (case-/trenner-tolerant, Klammern
 * inklusive — siehe `normalizeKey`). In den Dev-Fixtures fehlen Kosten/
 * Pre-Check/NF → die Fakten zeigen „—"; die echten SMB-Schemas liefern sie.
 * Alias-Listen bei Bedarf erweitern.
 *
 * Alle TV-getragenen Fakten lesen über ALLE Teilvorhaben (`findFieldValuesAcross`),
 * nicht nur den Lead: ein leerer Lead neben einem gefüllten Partner verschluckte
 * den Wert sonst still (gemessen 89 Verbünde bei Pre-Check, 136 bei NF). Gehen die
 * TVs auseinander, sagt die Kachel das (`· je TV verschieden`), statt einen von
 * mehreren Werten unmarkiert als Verbund-Aussage zu drucken.
 */
import type { Antrag } from '@/core/services/csv/types';
import { getVbPhaseLabel } from '@/core/utils/vb-phase-mappings';
import { verbundAntragsdatum } from '@/core/services/csv/frist';
import { findFieldValue, findFieldValuesAcross } from '../fieldLookup';
import { parseEuroish, formatEuro, formatDateish } from './format';

export interface GlanceFact {
  label: string;
  value: string;
  /** Monospace-Darstellung (IDs, Zahlen, Daten). */
  mono: boolean;
}

const DASH = '—';

const KOSTEN_ALIASES = [
  'beantragte Kosten (Deckblatt Mantelbogen)', 'beantragte_kosten_deckblatt_mantelbogen',
  'beantragte_kosten', 'beantragte kosten', 'beantragtekosten', 'kosten_beantragt',
];
const NETZWERK_ALIASES = [
  'netzwerkname', 'NETZWERKNA', 'Netzwerk', 'netzwerk_kurzname_fkz_ztp',
];
const PRECHECK_ALIASES = ['pre-check positiv', 'pre_check_positiv', 'precheck', 'pre_check'];
const NF_ALIASES = ['NF an ASt', 'nf_an_ast', 'nf_ast'];
/**
 * Laufzeit-Schluessel. Die kanonischen `laufzeitbeginn`/`laufzeitende` stehen
 * hier nur noch als Rueckfall: die produktiven Schemas mappen `LFZ_TV_B`/
 * `LFZ_TV_E` als Custom-Felder `tv_beginn`/`tv_ende` (gemessen 14 131 bzw.
 * 14 126 von 14 225 Saetzen), die kanonischen Namen kommen im Bestand in
 * 0 Saetzen vor. `vb_beginn`/`vb_ende` als zweiter Rueckfall (12 358 Saetze).
 */
const LFZ_VON_ALIASES = ['tv_beginn', 'laufzeitbeginn', 'lfz_tv_b', 'vb_beginn', 'beginn_vb'];
const LFZ_BIS_ALIASES = ['tv_ende', 'laufzeitende', 'lfz_tv_e', 'vb_ende', 'ende_vb'];

export interface GlanceInput {
  tvs: Antrag[];
  verbundId: string;
  /** Bereits aufgelöstes Unterprogramm-Label (Component liefert es via Hook). */
  unterprogramm: string | null;
}

/** Summe der „beantragten Kosten" über alle TVs; `null`, wenn kein TV einen Wert hat. */
export function sumBeantragteKosten(tvs: Antrag[]): number | null {
  let sum = 0;
  let any = false;
  for (const tv of tvs) {
    const n = parseEuroish(findFieldValue(tv, KOSTEN_ALIASES));
    if (n !== null) { sum += n; any = true; }
  }
  return any ? sum : null;
}

/**
 * Ein Verbund-Fakt aus einem TV-Feld: nimmt den ersten nicht-leeren Wert ueber
 * ALLE Teilvorhaben (nicht nur den Lead — der kann leer sein, waehrend ein
 * Partner den Wert traegt) und kennzeichnet, wenn die TVs auseinandergehen.
 * Ohne die Kennzeichnung stuende ein einzelner TV-Wert unmarkiert als
 * Verbund-Aussage da.
 */
function verbundFakt(tvs: Antrag[], aliases: string[]): { text: string | null; uneinheitlich: boolean } {
  const werte = findFieldValuesAcross(tvs, aliases);
  return { text: werte[0] ?? null, uneinheitlich: werte.length > 1 };
}

function datumsFakt(tvs: Antrag[], aliases: string[]): string | null {
  const { text, uneinheitlich } = verbundFakt(tvs, aliases);
  const d = formatDateish(text);
  if (!d) return null;
  return uneinheitlich ? `${d} · je TV verschieden` : d;
}

export function buildGlanceFacts({ tvs, verbundId, unterprogramm }: GlanceInput): GlanceFact[] {
  const lead = tvs[0];
  const netzwerk = verbundFakt(tvs, NETZWERK_ALIASES).text;
  const phaseLabel = lead ? getVbPhaseLabel(lead.vb_phase) : null;
  const kosten = sumBeantragteKosten(tvs);
  const antragsdatum = formatDateish(verbundAntragsdatum(tvs));
  const von = datumsFakt(tvs, LFZ_VON_ALIASES);
  const bis = datumsFakt(tvs, LFZ_BIS_ALIASES);
  const preCheck = datumsFakt(tvs, PRECHECK_ALIASES);
  const nf = datumsFakt(tvs, NF_ALIASES);

  return [
    { label: 'Verbund', value: netzwerk ? `${netzwerk} · ${verbundId}` : verbundId, mono: true },
    { label: 'Phase', value: [phaseLabel, unterprogramm ? `Unterprogramm ${unterprogramm}` : null].filter(Boolean).join(' · ') || DASH, mono: false },
    { label: 'Teilvorhaben', value: `${tvs.length} Partner`, mono: false },
    { label: 'beantragte Kosten', value: kosten !== null ? formatEuro(kosten) : DASH, mono: true },
    { label: 'Antragsdatum', value: antragsdatum ?? DASH, mono: true },
    { label: 'Laufzeit', value: von && bis ? `${von} – ${bis}` : (von ?? bis ?? DASH), mono: true },
    { label: 'Pre-Check', value: preCheck ?? DASH, mono: true },
    { label: 'Nachforderung', value: nf ? `an ASt · ${nf}` : DASH, mono: true },
  ];
}
