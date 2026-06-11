/**
 * Kontext-Slots für die Abschnitts-Skills B–G. `stammdaten` + `vbMarkdown`
 * laufen unverändert über den bestehenden Skill-Runner (Cap + Kürzungsvermerk).
 * NEU: `vorherigeAbschnitte` — die bereits FREIGEGEBENEN Abschnitte vor dem
 * aktuellen, als Konsistenz-Referenz (Terminologie, keine Widersprüche).
 *
 * SEAM Schritt 4 (abschnittsbezogenes Retrieval) ist bewusst NICHT verdrahtet:
 * ein sauberer Pro-FKZ-Tag-Filter ist auf dem aktuellen Orama-Schema nicht
 * möglich (tags = komma-gejointer String; `where` kann nicht containment-
 * filtern) → ein „Relevante Passagen"-Block würde hier ansetzen, sobald `tags`
 * ein filterbares Feld ist (Reindex). Für v1 genügen die Slots unten.
 */
import type { WorkflowStepDef } from './workflow-definition';
import { STEP_ORDER, type StepId, type WorkflowRun } from './types';

/** Kürzt einen Abschnitts-Text am letzten Absatzumbruch vor dem Cap. */
function cutAtParagraph(text: string, cap: number): string {
  if (text.length <= cap) return text;
  const slice = text.slice(0, cap);
  const lastBreak = slice.lastIndexOf('\n\n');
  const cut = lastBreak > cap * 0.5 ? slice.slice(0, lastBreak) : slice;
  return `${cut.trimEnd()}\n\n…`;
}

/**
 * Baut den `{{vorherigeAbschnitte}}`-Block: alle freigegebenen Schritte VOR
 * `currentStep` in A–G-Reihenfolge, je „### Abschnitt {ID} — {Label}" + (gekürzter)
 * finaler Text. Nicht-freigegebene/leere Schritte werden ausgelassen (nur
 * freigegebene Inhalte sind verbindlich). Leerstring, wenn keiner — so bleibt
 * Schritt A (keiner davor) byte-identisch zum bisherigen Kurzfassung-Prompt.
 */
export function buildVorherigeAbschnitte(
  run: WorkflowRun,
  currentStep: StepId,
  defs: readonly WorkflowStepDef[],
  capPerSection = 2000,
): string {
  const idx = STEP_ORDER.indexOf(currentStep);
  const bloecke: string[] = [];
  for (const id of STEP_ORDER.slice(0, idx)) {
    const step = run.schritte[id];
    if (step?.status !== 'freigegeben') continue;
    const label = defs.find(d => d.id === id)?.label ?? id;
    bloecke.push(`### Abschnitt ${id} — ${label}\n${cutAtParagraph(step.finalerText, capPerSection)}`);
  }
  return bloecke.join('\n\n');
}
