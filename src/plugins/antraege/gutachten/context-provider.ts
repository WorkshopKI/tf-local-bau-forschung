/**
 * Kontext-Slots für die Abschnitts-Skills B–G. `stammdaten` + `vbMarkdown`
 * laufen unverändert über den bestehenden Skill-Runner (Cap + Kürzungsvermerk).
 * `vorherigeAbschnitte` — die bereits FREIGEGEBENEN Abschnitte vor dem aktuellen,
 * als Konsistenz-Referenz (Terminologie, keine Widersprüche).
 *
 * Abschnittsbezogenes Retrieval (vormals „SEAM Schritt 4") ist jetzt über die
 * **Relevanz-Map** verdrahtet (`buildVbRelevant`, [relevanz-map.ts]): ein interner
 * LLM-Lauf taggt antragsweit jede VB-Sektion mit den Gutachten-Teilen, für die sie
 * relevant ist; `buildVbRelevant` setzt daraus den **wortgetreuen** `{{vbRelevant}}`-
 * Block zusammen. Greift nur, wenn ein Schritt `kontextBedarf: 'relevant'` trägt —
 * Seed bleibt `'voll'` (byte-identisch), das Umschalten ist eine Kurator-/Eval-Entscheidung.
 */
import type { StepId, WorkflowRun } from './types';
import { assembleVbRelevant, type RelevanzMapResult } from './relevanz-map';

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
 * Ausdrückliche Auskunft, wenn es keinen Vorkontext gibt.
 *
 * Der Slot steht im Template unter einer Überschrift („Bereits freigegebene frühere
 * Abschnitte — Konsistenz-Referenz …"), die UNBEDINGT gerendert wird. Ein Leerstring
 * hinterließ dort eine Überschrift ohne Inhalt: sie verspricht eine Referenz und
 * liefert nichts, und das Modell muss entscheiden, ob es etwas übersehen hat. Bei
 * einem frischen Gutachten trifft das JEDEN Abschnitt. Ein entscheidbarer Satz kostet
 * eine Zeile und nimmt die Frage weg.
 */
const KEIN_VORKONTEXT = 'Keine — es sind noch keine früheren Abschnitte freigegeben.';

/**
 * Baut den `{{vorherigeAbschnitte}}`-Block: die Schritte VOR `currentStep` in
 * A–G-Reihenfolge, je „### Abschnitt {ID} — {Label}" + (gekürzter) finaler Text.
 * Leere Schritte werden immer ausgelassen. Gibt es keinen Vorgänger, steht dort
 * `KEIN_VORKONTEXT` statt einer leeren Überschrift. Schritt A bleibt davon
 * unberührt — sein Template führt den Platzhalter gar nicht.
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
  return bloecke.length ? bloecke.join('\n\n') : KEIN_VORKONTEXT;
}

/**
 * Baut den `{{vbRelevant}}`-Block für einen Schritt aus der (gecachten) Relevanz-Map:
 * die für `abschnittId` getaggten VB-Sektionen wortgetreu, in Dokumentreihenfolge,
 * bis `budgetChars`. Kennt die Map den Abschnitt nicht (oder ist sie leer), kommt
 * ein Leerstring zurück → der Caller fällt auf den vollen `{{vbMarkdown}}` zurück.
 * Dünne Hülle um `assembleVbRelevant` — hält die Kontext-Assemblierung an einer Stelle.
 */
export function buildVbRelevant(
  relevanz: RelevanzMapResult,
  vbMarkdown: string,
  abschnittId: StepId,
  budgetChars: number,
): string {
  return assembleVbRelevant(relevanz.map, relevanz.headings, vbMarkdown, abschnittId, budgetChars);
}
