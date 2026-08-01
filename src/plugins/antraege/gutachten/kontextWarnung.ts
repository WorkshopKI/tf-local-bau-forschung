/**
 * „Passt der Gutachten-Kontext ins Fenster?" — VOR dem Lauf, nicht danach.
 *
 * Bisher erfuhr der Bearbeiter von einer gekappten Vorhabensbeschreibung erst am
 * fertigen Abschnitt („Auf gekürzter VB-Basis entstanden — der Schluss floss nicht
 * ein"). Da hatte der Lauf schon Minuten gekostet, und die naheliegende Abhilfe —
 * auf die andere interne KI wechseln, deren Fenster rund viermal so groß ist —
 * wäre vorher ein Klick gewesen.
 *
 * Rein und ohne Bridge/Store: die Caps rechnet der Aufrufer (sie hängen am
 * gewählten Ziel), hier steht nur die Entscheidung. Blockiert nie.
 */
import type { BridgeZiel } from '@/core/services/ai/transports/streamlit';

export interface KontextBefundEingabe {
  /** Zeichen des Textes, der ins Modell geht (VB + aufgenommene Zusatzdokumente). */
  korpusZeichen: number;
  /** Zeichen-Obergrenze des AKTUELL gewählten Ziels. */
  cap: number;
  ziel: BridgeZiel;
  /**
   * Obergrenze der jeweils ANDEREN internen KI. Fehlt, wenn das Ziel nicht wirkt
   * (DirectLLM/OpenRouter kennt keine Tabs) — dann entfällt die Wechsel-Empfehlung.
   */
  capAndere?: number;
}

export interface KontextBefund {
  zeichen: number;
  cap: number;
  /** Zeichen, die nicht mehr ins Fenster passen. */
  fehlend: number;
  /** Der Wechsel auf die andere interne KI allein würde das Problem lösen. */
  andereKiReicht: boolean;
  /** Name der anderen KI für die Empfehlung. */
  andereKiLabel: string;
}

export const ZIEL_LABEL: Record<BridgeZiel, string> = {
  standard: 'Standard-KI',
  agentisch: 'agentische KI',
};

/**
 * `null`, wenn alles passt — der Normalfall soll keine Zeile erzeugen. Sonst der
 * Befund mit der konkreten Lücke und der Auskunft, ob ein KI-Wechsel reicht.
 */
export function pruefeKontextPasst(e: KontextBefundEingabe): KontextBefund | null {
  if (e.korpusZeichen <= e.cap) return null;
  const andere: BridgeZiel = e.ziel === 'agentisch' ? 'standard' : 'agentisch';
  return {
    zeichen: e.korpusZeichen,
    cap: e.cap,
    fehlend: e.korpusZeichen - e.cap,
    andereKiReicht: e.capAndere !== undefined && e.korpusZeichen <= e.capAndere,
    andereKiLabel: ZIEL_LABEL[andere],
  };
}
