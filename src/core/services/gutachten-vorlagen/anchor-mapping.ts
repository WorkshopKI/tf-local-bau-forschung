/**
 * Anker-Überschriften je Vorlagen-Typ → Abschnitts-ID. Der Füller fügt den
 * freigegebenen Abschnittstext direkt NACH dem Anker-Absatz ein (whitespace-
 * toleranter Substring-Vergleich, wie beim Kurzfassung-Anker).
 *
 * EP-Mapping VERIFIZIERT gegen die echte Vorlage `Gutachten_EP.docx`
 * (Überschriftentexte aus `word/document.xml` extrahiert) — NICHT aus einem
 * Prompt abgeschrieben.
 *
 * VB-Vorlage (`Gutachten_VB.DOCX`): abweichende Überschriften bei E/F/G und
 * Sektionen PRO PARTNER wiederholt — bewusst NICHT v1 (dokumentierter Folge-
 * schritt; das Einfügen-nach-erstem-Treffer würde nur den ersten Partner-Slot
 * füllen). Die echten VB-Überschriften zur späteren Umsetzung:
 *   B „Innovationsgehalt, Chancen und Risiken" · C „Herausforderungen und
 *   Technische Risiken" · D „Marktchancen" · E „Unternehmensgegenstand 1-2 Sätze
 *   (keine Entwicklungshistorie)" (je Partner) · F „Ergebnisverwertung und
 *   Einfluss auf die Entwicklung der/des Unternehmen(s)" · G „Auswirkungen des
 *   FuE-Projektes auf die Kompetenz der/des Unternehmen(s)".
 */
import type { AbschnittId } from './types';

export type VorlagenTyp = 'EP';

/** EP-Anker A–G (verifizierte Überschriften-Substrings aus Gutachten_EP.docx). */
export const ANKER_EP: Readonly<Record<AbschnittId, string>> = {
  A: 'Kurzfassung der Projektbeschreibung',
  B: 'Innovationsgehalt, Chancen und Risiken',
  C: 'Herausforderungen und Technische Risiken',
  D: 'Marktchancen',
  E: 'Unternehmensgegenstand',
  F: 'Ergebnisverwertung und Einfluss auf die Entwicklung des Unternehmens',
  G: 'Auswirkungen des FuE-Projektes auf die Kompetenz des Antragsstellers',
};

const ANKER_BY_TYP: Record<VorlagenTyp, Readonly<Record<AbschnittId, string>>> = {
  EP: ANKER_EP,
};

/** Anker-Überschrift eines Abschnitts für einen Vorlagen-Typ. */
export function ankerFuer(typ: VorlagenTyp, id: AbschnittId): string {
  return ANKER_BY_TYP[typ][id];
}

/** Gültige DOCX-Anker-Schlüssel (= geschlossene `AbschnittId`-Union A–G). */
const ANKER_IDS: ReadonlySet<string> = new Set(Object.keys(ANKER_EP));

/**
 * Type-Guard: trägt ein (kuratierbarer, daher offener) `WorkflowStep.ankerKey`
 * einen GÜLTIGEN DOCX-Anker (A–G)? Schritte ohne/ungültigen Anker — z.B. neue
 * Unterschritte (5a) — werden vom Export sauber übersprungen, statt zu werfen.
 * Die `AbschnittId`-Union bleibt bewusst geschlossen (nur die ausgelieferten
 * EP-Anker); diese Funktion ist die Brücke zur offenen `StepId`-Welt.
 */
export function ankerKeyGueltig(key: string | undefined): key is AbschnittId {
  return key !== undefined && ANKER_IDS.has(key);
}

/**
 * Vorlagen-Typ aus dem Dateinamen ableiten. v1 unterstützt nur EP; andere
 * Namen werden defensiv als EP behandelt (Anker, die nicht passen, werden vom
 * Füller ohnehin übersprungen + im Dialog als „Anker nicht gefunden" gemeldet).
 */
export function vorlagenTypFuerDatei(_dateiname: string): VorlagenTyp {
  return 'EP';
}
