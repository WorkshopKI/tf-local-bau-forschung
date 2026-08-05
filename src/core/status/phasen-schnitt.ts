/**
 * Der Code→Phase-Schnitt einer Fassung: Auslieferung, überlagert von dem, was
 * die PL umgehängt hat.
 *
 * Bis v2.409 lag diese Funktion im Cockpit-Hook und speiste nur den
 * Kürzel-Vorschlag. Sie ist jetzt die eine Stelle, an der aus einer Fassung ein
 * Schnitt wird — für das Register in `zah-phasen.ts` (und damit für Sidebar,
 * Verfahrensleiste und Filter) ebenso wie für den Vorschlag.
 *
 * Import-Disziplin: nur `./zah-phasen` (ein Blatt) und `./typen` type-only —
 * nicht über das Barrel `@/core/status`, das zöge `snapshot.ts` mit und damit
 * einen Laufzeit-Zyklus.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { SEED_CODE_ZU_ZAH_PHASE, SEED_MARKER_CODES, type PhasenSchnitt } from './zah-phasen';
import type { MappingVersion } from './typen';

/**
 * Code → Phase, wie die FASSUNG sie führt, mit dem Auslieferungs-Schnitt als
 * Rücken. Ein von Hand umgehängter Code muss überall mitziehen — sonst schlüge
 * das Kürzel-Band eine Phase vor, die die Fassung an derselben Stelle längst
 * anders sieht, und die Verfahrensleiste zeigte weiter die alte Station.
 *
 * `zahPhaseId` ist dreiwertig und wird auch so gelesen: gesetzt = kuratiert,
 * `null` = bewusst Marker, `undefined` = noch nicht zugeordnet ⇒ Auslieferung.
 *
 * **Erster Wert mit dem Code gewinnt**, genau wie in `statusKurz`
 * (`version.werte.find(w => w.code === code)`): derselbe Code steht am TV- und
 * am Verbund-Feld, und zwei Wege zur Phase wären ein zweiter Kategorien-Weg.
 */
export function schnittVon(version: MappingVersion | null | undefined): PhasenSchnitt {
  const codeZuPhase = new Map(SEED_CODE_ZU_ZAH_PHASE);
  const markerCodes = new Set(SEED_MARKER_CODES);
  const gesehen = new Set<number>();
  for (const w of version?.werte ?? []) {
    if (w.code === undefined || gesehen.has(w.code)) continue;
    gesehen.add(w.code);
    if (w.zahPhaseId !== undefined) {
      if (w.zahPhaseId === null) codeZuPhase.delete(w.code);
      else codeZuPhase.set(w.code, w.zahPhaseId);
    }
    if (w.marker !== undefined) {
      if (w.marker) markerCodes.add(w.code);
      else markerCodes.delete(w.code);
    }
  }
  return { codeZuPhase, markerCodes };
}
