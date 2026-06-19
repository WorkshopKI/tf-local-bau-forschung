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
import type { StepId, WorkflowRun } from './types';

/** Minimal-Shape eines Schritts für die Reihenfolge-/Label-Auflösung (Def-agnostisch). */
interface StepLike { id: StepId; label: string }

/** Kürzt einen Abschnitts-Text am letzten Absatzumbruch vor dem Cap. */
function cutAtParagraph(text: string, cap: number): string {
  if (text.length <= cap) return text;
  const slice = text.slice(0, cap);
  const lastBreak = slice.lastIndexOf('\n\n');
  const cut = lastBreak > cap * 0.5 ? slice.slice(0, lastBreak) : slice;
  return `${cut.trimEnd()}\n\n…`;
}

/**
 * Baut den `{{vorherigeAbschnitte}}`-Block: die Schritte VOR `currentStep` in
 * A–G-Reihenfolge, je „### Abschnitt {ID} — {Label}" + (gekürzter) finaler Text.
 * Leere Schritte werden immer ausgelassen. Leerstring, wenn keiner — so bleibt
 * Schritt A (keiner davor) byte-identisch zum bisherigen Kurzfassung-Prompt.
 *
 * `quelle` (5. Param, Default `'freigegeben'`):
 *  - `'freigegeben'` (Einzellauf): nur freigegebene Abschnitte, KEIN Marker →
 *    byte-identisch zum bisherigen Verhalten.
 *  - `'entwurf'` (Batch): zusätzlich Entwürfe; diese tragen den „(Entwurf)"-Marker
 *    in der Überschrift, freigegebene bleiben markerlos. Einzige bewusste
 *    Batch-Abweichung (mangels Freigaben im selben Lauf).
 */
export function buildVorherigeAbschnitte(
  run: WorkflowRun,
  currentStep: StepId,
  defs: readonly StepLike[],
  capPerSection = 2000,
  quelle: 'freigegeben' | 'entwurf' = 'freigegeben',
): string {
  // Reihenfolge kommt aus der übergebenen Schrittliste (aktive WorkflowDef),
  // NICHT mehr aus einer Code-Konstante.
  const order = defs.map(d => d.id);
  const idx = order.indexOf(currentStep);
  const bloecke: string[] = [];
  for (const id of order.slice(0, idx)) {
    const step = run.schritte[id];
    if (!step) continue;
    const akzeptiert = quelle === 'freigegeben'
      ? step.status === 'freigegeben'
      : step.status === 'freigegeben' || step.status === 'entwurf';
    if (!akzeptiert) continue;
    const label = defs.find(d => d.id === id)?.label ?? id;
    const marker = step.status === 'entwurf' ? ' (Entwurf)' : '';
    bloecke.push(`### Abschnitt ${id} — ${label}${marker}\n${cutAtParagraph(step.finalerText, capPerSection)}`);
  }
  return bloecke.join('\n\n');
}
