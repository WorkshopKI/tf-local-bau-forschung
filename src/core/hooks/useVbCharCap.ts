/**
 * Wirksamer VB-Zeichen-Cap für die Anzeige — inklusive des Bridge-Tabs.
 *
 * Die Warnhinweise („Dokument zu lang", „Korpus passt nicht") müssen dieselbe
 * Grenze zeigen, gegen die der Lauf später tatsächlich prüft. Vor v2.273 galt
 * überall der lokale llama.cpp-Wert, auch wenn der Lauf über den agentischen
 * Bridge-Tab mit dem Vierfachen an Kontext lief — die Warnung erschien dann viel
 * zu früh.
 *
 * Reaktiv auf die Zielwahl (zustand-Store), damit ein Umschalten von Standard auf
 * Agentisch die Hinweise sofort neu bewertet.
 */
import { useAIBridge } from './useAIBridge';
import { useKiZiel } from '@/core/services/ai/ki-ziel';
import { getVbCharCap, type KontextZiel } from '@/core/services/ai/llm-context';

/** Beschreibt den aktuell wirksamen Lauf-Kontext (Bridge? welcher Tab?). */
export function useKontextZiel(): KontextZiel {
  const bridge = useAIBridge();
  const ziel = useKiZiel(s => s.ziel);
  return { bridge: bridge.istBridgeAktiv(), ziel };
}

export function useVbCharCap(): number {
  return getVbCharCap(useKontextZiel());
}
