/**
 * „Auf einen Blick" (Hebel 1): kuratiertes 8-Fakten-Raster aus den TVs eines
 * Verbundes. Reine Ableitung (testbar) — die UI (`VerbundGlance`) ist dünn.
 *
 * Custom-Felder (Netzwerk, beantragte Kosten, Pre-Check, Nachforderung) werden
 * über `findFieldValue` aufgelöst (case-/trenner-tolerant). In den Dev-Fixtures
 * fehlen Kosten/Pre-Check/NF → die Fakten zeigen „—"; die echten SMB-Schemas
 * liefern sie. Alias-Listen bei Bedarf erweitern.
 */
import type { Antrag } from '@/core/services/csv/types';
import { getVbPhaseLabel } from '@/core/utils/vb-phase-mappings';
import { verbundAntragsdatum } from '@/core/services/csv/frist';
import { findFieldValue } from '../fieldLookup';
import { parseEuroish, formatEuro, formatDateish } from './format';

export interface GlanceFact {
  label: string;
  value: string;
  /** Monospace-Darstellung (IDs, Zahlen, Daten). */
  mono: boolean;
}

const DASH = '—';

const KOSTEN_ALIASES = [
  'beantragte Kosten (Deckblatt Mantelbogen)', 'beantragte_kosten', 'beantragte kosten',
  'beantragtekosten', 'kosten_beantragt',
];
const NETZWERK_ALIASES = ['netzwerkname', 'NETZWERKNA', 'Netzwerk'];
const PRECHECK_ALIASES = ['pre-check positiv', 'pre_check_positiv', 'precheck', 'pre_check'];
const NF_ALIASES = ['NF an ASt', 'nf_an_ast', 'nf_ast'];

export interface GlanceInput {
  tvs: Antrag[];
  verbundId: string;
  /** Bereits aufgelöstes Unterprogramm-Label (Component liefert es via Hook). */
  unterprogramm: string | null;
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return v == null ? null : String(v);
  const t = v.trim();
  return t.length === 0 ? null : t;
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

export function buildGlanceFacts({ tvs, verbundId, unterprogramm }: GlanceInput): GlanceFact[] {
  const lead = tvs[0];
  const netzwerk = lead ? str(findFieldValue(lead, NETZWERK_ALIASES)) : null;
  const phaseLabel = lead ? getVbPhaseLabel(lead.vb_phase) : null;
  const kosten = sumBeantragteKosten(tvs);
  const antragsdatum = formatDateish(verbundAntragsdatum(tvs));
  const von = lead ? formatDateish(lead.laufzeitbeginn) : null;
  const bis = lead ? formatDateish(lead.laufzeitende) : null;
  const preCheck = lead ? formatDateish(findFieldValue(lead, PRECHECK_ALIASES)) : null;
  const nf = lead ? formatDateish(findFieldValue(lead, NF_ALIASES)) : null;

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
