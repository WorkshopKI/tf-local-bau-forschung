/**
 * Was passiert, wenn jemand beim Bearbeiten der Prompt-Vorlage einen Slot
 * herauslöscht?
 *
 * Der bekanntere Teil ist die DSGVO-Seite (Pitfall #35): die Klassifizierung
 * leitet sich aus dem Template-TEXT ab, nicht aus dem `slots`-Array. Sie ist aber
 * fail-safe — `skillEnthaeltDokumentInhalte` fällt auf `?? true` zurück, ein Skill
 * kippt also nicht von allein nach „extern erlaubt".
 *
 * Der Schaden, der wirklich passiert, ist der leisere: OHNE `{{vbMarkdown}}` setzt
 * der Lauf die Vorhabensbeschreibung nicht mehr ein. Das Modell schreibt den
 * Abschnitt dann aus dem Nichts — kein Fehler, keine Meldung, nur ein plausibel
 * klingender Text ohne den Antrag. Darauf zielt die Warnung.
 *
 * Verglichen wird gegen den GESPEICHERTEN Stand, nicht gegen `skill.slots`: sonst
 * meldete jeder Bestands-Skill, dessen `slots`-Array vom Template abweicht, sofort
 * einen Fehlalarm.
 *
 * Reine Funktion (node-testbar) — das Repo hat keine Render-Tests.
 */
import { templateReferenziertInhaltsSlot } from '@/core/services/ai/transport-policy';

/** Slots, die den Antragstext tragen. Bewusst KEIN zweiter Transport-Katalog —
 *  die Frage ist eine andere: welcher Slot bringt die Vorhabensbeschreibung mit? */
const VB_SLOTS = ['vbMarkdown', 'vbRelevant'];

const SLOT_RE = /\{\{([A-Za-z0-9_]+)\}\}/g;

/** Alle `{{slot}}`-Namen eines Templates, dedupliziert, in Reihenfolge des Auftretens. */
function slotNamen(template: string): string[] {
  const namen: string[] = [];
  for (const m of template.matchAll(SLOT_RE)) {
    const name = m[1];
    if (name && !namen.includes(name)) namen.push(name);
  }
  return namen;
}

export interface SlotAenderung {
  /** Inhalts-Slots, die im gespeicherten Stand standen und im Entwurf fehlen. */
  entfernteSlots: string[];
  /** Darunter einer, der die Vorhabensbeschreibung einsetzt. */
  vbVerloren: boolean;
  /** Der Skill galt über die Ableitung als inhalts-tragend und tut es nicht mehr. */
  kipptAufInhaltsfrei: boolean;
}

export function pruefeSlotAenderung(gespeichert: string, entwurf: string): SlotAenderung {
  const vorher = slotNamen(gespeichert);
  const nachher = new Set(slotNamen(entwurf));
  // Nur Inhalts-Slots melden — ein entfernter Formatierungs-Platzhalter ist keine
  // Warnung wert. Die Zugehörigkeit kommt aus der EINEN Quelle in `transport-policy`,
  // hier nur auf einen einzelnen Namen angewandt.
  const entfernteSlots = vorher.filter(s => !nachher.has(s) && templateReferenziertInhaltsSlot(`{{${s}}}`));

  return {
    entfernteSlots,
    vbVerloren: entfernteSlots.some(s => VB_SLOTS.includes(s)),
    kipptAufInhaltsfrei:
      templateReferenziertInhaltsSlot(gespeichert) && !templateReferenziertInhaltsSlot(entwurf),
  };
}
