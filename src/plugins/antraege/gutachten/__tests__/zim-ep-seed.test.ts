import { describe, it, expect } from 'vitest';
import { ZIM_EP_WORKFLOW } from '../workflow-definition';
import { ZIM_EP_DEF } from '@/core/services/skills';

/**
 * Drift-Sicherung (Cross-Layer): der kuratierbare Seed `ZIM_EP_DEF` (core/registry)
 * MUSS die hart verdrahtete `ZIM_EP_WORKFLOW` (gutachten-plugin) exakt spiegeln —
 * solange das so ist, bleibt das Laufzeit-Verhalten byte-identisch. Ändert jemand
 * eine der beiden Quellen, schlägt dieser Test an.
 */
describe('ZIM_EP_DEF spiegelt ZIM_EP_WORKFLOW exakt', () => {
  it('gleiche Anzahl + Reihenfolge der Step-IDs', () => {
    expect(ZIM_EP_DEF.steps.map(s => s.id)).toEqual([...ZIM_EP_WORKFLOW.map(d => d.id)]);
  });

  it('je Schritt: label/kurz/skillId/ankerKey/retrievalQueries deckungsgleich, Gate→gateExpr=immer', () => {
    for (const def of ZIM_EP_WORKFLOW) {
      const step = ZIM_EP_DEF.steps.find(s => s.id === def.id);
      expect(step, `Step ${def.id} fehlt im Seed`).toBeDefined();
      expect(step!.label).toBe(def.label);
      expect(step!.kurz).toBe(def.kurz);
      expect(step!.skillId).toBe(def.skillId);
      expect(step!.ankerKey).toBe(def.ankerKey);
      expect(step!.retrievalQueries).toEqual(def.retrievalQueries);
      // A–G trugen nie eine Gate-Funktion → der Seed mappt sie auf 'immer'.
      expect(def.gate).toBeUndefined();
      expect(step!.gateExpr).toBe('immer');
    }
  });
});
