/**
 * Anzeige-Konstanten für den Textbaustein-Verwaltungs-Tab (Labels + Badge-Varianten).
 * UI-frei, damit Liste/Editor/Import dieselben Bezeichnungen teilen.
 */
import type { BadgeVariant } from '@/components/ui/badge';
import type { BausteinArtefaktTyp, BausteinStatus } from '@/core/services/skills';

export const TYP_LABEL: Record<BausteinArtefaktTyp, string> = {
  nf: 'Nachforderung',
  rne: 'Rücknahmeempfehlung',
  abl: 'Ablehnung',
};

export const TYP_KURZ: Record<BausteinArtefaktTyp, string> = { nf: 'NF', rne: 'RNE', abl: 'ABL' };

export const STATUS_LABEL: Record<BausteinStatus, string> = {
  entwurf: 'Entwurf',
  freigegeben: 'Freigegeben',
  stillgelegt: 'Stillgelegt',
};

export const STATUS_VARIANT: Record<BausteinStatus, BadgeVariant> = {
  entwurf: 'warning',
  freigegeben: 'success',
  stillgelegt: 'default',
};

export const ARTEFAKT_TYPEN: BausteinArtefaktTyp[] = ['nf', 'rne', 'abl'];
