/**
 * Die EINE Stelle, an der aus dem Zustand eines Abschnitts die `SkillRunInput`
 * eines Laufs wird.
 *
 * Vorher stand diese Zusammenstellung zweimal wörtlich in `generiereEinmal`
 * (Teil-Pfad + Normalpfad). Mit der Prompt-Ansicht käme eine dritte Kopie dazu —
 * und eine Vorschau, die ihre Eingabe selbst nachbaut, weicht bei acht bedingten
 * Feldern früher oder später unbemerkt vom echten Lauf ab. Deshalb: eine reine
 * Funktion, die Lauf UND Vorschau benutzen.
 *
 * Bewusst OHNE Transport, Bridge und React — direkt in Node testbar.
 */
import type { SkillRunInput, SkillTweak, SkillModifierKey } from '@/core/services/skills';
import type { ThinkingBudget } from '@/core/services/ai/llm-thinking';
import type { KiRolle } from '@/core/services/ai/modell-katalog';
import { buildStammdaten } from './skill-context';
import type { KurzfassungContext } from '../kurzfassung/types';

/** Die Streaming-Senke eines Laufs (fehlt bei der Vorschau — prompt-neutral). */
export interface EingabeSenke {
  onContentDelta: (text: string) => void;
  onThinkingDelta: (text: string) => void;
}

export interface SkillEingabeArgs {
  ctx: KurzfassungContext;
  /** Der Text, der tatsächlich ins Modell geht (VB oder VB + Korpus-Auswahl). */
  korpusMd: string;
  /** Zeichen-Cap aus dem Kontextfenster des ZIELS (nicht des Stores). */
  vbCharCap: number;
  thinkingBudget: ThinkingBudget;
  ziel: KiRolle;
  /** Sampling-Temperatur; fehlt sie, setzt `runSkill` den sicheren Standard. */
  temperatur?: number;
  /** Fertiger `{{vorherigeAbschnitte}}`-Block (nie leer — siehe context-provider). */
  vorherigeAbschnitte: string;
  /** Relevanz-Map-Ausschnitt; nur bei `kontextBedarf: 'relevant'` und erst zur Laufzeit. */
  vbRelevant?: string;
  /** Persönlicher Tweak — nur durchgereicht, wenn er auf DIESEN Skill wirkt. */
  tweak?: SkillTweak | null;
  tweakWirksam?: boolean;
  modifier?: SkillModifierKey;
  vorherigerText?: string;
  anweisung?: string;
  zusatzAnweisung?: string;
  teilAufgabe?: string;
  stream?: EingabeSenke;
  signal?: AbortSignal;
}

/**
 * Baut die Lauf-Eingabe. `erwarteAbschluss: 'Finaler Text'` ist gesetzt, weil alle
 * Abschnitts-Skills A–G damit enden (Abschluss-Marker-Schutz der Streamlit-Bridge;
 * auf DirectLLM wirkungslos) — es beeinflusst den Prompt-Text nicht.
 */
export function baueSkillEingabe(a: SkillEingabeArgs): SkillRunInput {
  return {
    ziel: a.ziel,
    stammdaten: buildStammdaten(a.ctx),
    vbMarkdown: a.korpusMd,
    vbCharCap: a.vbCharCap,
    thinkingBudget: a.thinkingBudget,
    erwarteAbschluss: 'Finaler Text',
    vorherigeAbschnitte: a.vorherigeAbschnitte,
    ...(a.stream
      ? { onContentDelta: a.stream.onContentDelta, onThinkingDelta: a.stream.onThinkingDelta }
      : {}),
    ...(a.temperatur !== undefined ? { temperatur: a.temperatur } : {}),
    ...(a.vbRelevant ? { vbRelevant: a.vbRelevant } : {}),
    ...(a.tweakWirksam && a.tweak ? { tweak: a.tweak } : {}),
    ...(a.modifier ? { modifier: a.modifier } : {}),
    ...(a.vorherigerText ? { vorherigerText: a.vorherigerText } : {}),
    ...(a.anweisung ? { anweisung: a.anweisung } : {}),
    ...(a.zusatzAnweisung ? { zusatzAnweisung: a.zusatzAnweisung } : {}),
    ...(a.teilAufgabe ? { teilAufgabe: a.teilAufgabe } : {}),
    ...(a.signal ? { signal: a.signal } : {}),
  };
}

/**
 * Wirkt der Tweak auf DIESEN Skill? (aktiv, richtige `skillId`, nicht leer) —
 * dieselbe Bedingung, die `generiereEinmal` schon hatte, hier als Prädikat, damit
 * die Vorschau sie nicht nachbaut.
 */
export function tweakWirktAuf(skillId: string, tweak: SkillTweak | null): boolean {
  return !!(tweak?.aktiv && tweak.skillId === skillId
    && (tweak.stilHinweise.trim() || tweak.beispielFormulierungen.trim()));
}
