/**
 * Gibt es in dieser Variante überhaupt etwas aufzuklappen?
 *
 * Der Bereich hat zwei Reiter, und beide hängen an einem Flag: der Verlauf am
 * Vorgangssystem, die Meilensteine am Monitoring. Ist keines gesetzt, bliebe ein
 * leerer Kasten mit einem einzigen Reiter, der nur die Frist wiederholt, die in
 * der Zelle daneben steht.
 *
 * **Die Frist allein reicht.** Auch ohne beide Flags rechnet der Frist-Reiter
 * mit `D_XTE` und dem Haltedatum — beides kann die Tabellenzelle nicht, und
 * genau darauf verweist `fristAnzeige.ts`. Deshalb ist der Bereich schon dann
 * verfügbar, wenn eine Fassung geladen ist; die Flags entscheiden nur, wie viele
 * Reiter er hat.
 *
 * Eigene Datei, damit `AntraegeTable` die Flag-Abfrage nicht selbst führt und
 * der Grund an einer Stelle steht.
 */
import { isMeilensteinMonitoringEnabled, isVorgangssystemEnabled } from '@/config/feature-flags';

export function istAusklappbar(): boolean {
  // Heute immer wahr — der Frist-Reiter trägt für sich. Die Funktion existiert,
  // damit die Bedingung EINE Heimat hat, wenn sich das ändert.
  return true;
}

/** Wie viele Reiter der Bereich in dieser Variante zeigt. */
export function reiterAnzahl(): number {
  return 1 + (isVorgangssystemEnabled() ? 1 : 0);
}

/** Trägt der Meilenstein-Block Inhalt? Nur für die Anzeige-Entscheidung. */
export function hatMeilensteine(): boolean {
  return isMeilensteinMonitoringEnabled();
}
