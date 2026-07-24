/**
 * Zuordnung Bescheid-Typ → Skill / Dateiname / DOCX-Anker / Label.
 *
 * NF, RNE und ABL teilen die Generierungs-Maschine (`useNachforderungen`); sie
 * unterscheiden sich nur im verwendeten Füll-Skill und in der Ausgabe-Rahmung. Diese
 * eine Tabelle hält das zusammen — kein verstreutes `=== 'rne'`.
 */
import { NF_SKILL_ID, RNE_SKILL_ID, ABL_SKILL_ID } from '@/core/services/skills';

/** Artefakt-Typen, die die NF-Maschine erzeugt (Teilmenge von `ArtefaktTyp`). */
export type BescheidTyp = 'nf' | 'rne' | 'abl';

export const SKILL_ID_BY_TYP: Record<BescheidTyp, string> = {
  nf: NF_SKILL_ID,
  rne: RNE_SKILL_ID,
  abl: ABL_SKILL_ID,
};

/** Dateinamen-Präfix für den DOCX-Export (Muster `Gutachten_EP` / `ZIM-Nachforderung`). */
export const DATEI_PREFIX_BY_TYP: Record<BescheidTyp, string> = {
  nf: 'ZIM-Nachforderung',
  rne: 'ZIM-Ruecknahmeempfehlung',
  abl: 'ZIM-Ablehnung',
};

/**
 * DOCX-Anker-Überschrift, hinter die der Text eingefügt wird. NF hat historisch
 * „Nachforderungen"; RNE/ABL tragen die „Tragenden Gründe" (Bescheid-Konvention).
 */
export const ANKER_BY_TYP: Record<BescheidTyp, string> = {
  nf: 'Nachforderungen',
  rne: 'Tragende Gründe',
  abl: 'Tragende Gründe',
};

export const LABEL_BY_TYP: Record<BescheidTyp, string> = {
  nf: 'Nachforderung',
  rne: 'Rücknahmeempfehlung',
  abl: 'Ablehnung',
};
