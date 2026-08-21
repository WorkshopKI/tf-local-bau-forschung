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
import { MODELL_LABEL } from '@/core/services/ai/modell-wahl';
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
  /**
   * Wessen Fenster gemessen wurde, im Dativ („passt nicht ins Fenster …").
   * Ohne Bridge gibt es weder Standard- noch Qwen3.6-35B — dann benennt der
   * Text schlicht das Modell, statt einen Tab zu behaupten, den es nicht gibt.
   */
  fensterLabel: string;
}

/**
 * Beschriftung der Modelle — der Name, den auch die interne KI in ihrer
 * Auswahlliste zeigt.
 *
 * Bis v5.0 standen hier „Standard-KI" und „agentische KI" — Namen für zwei Tabs.
 * Seit die Achse das Modell wählt, benennt sie es auch: „passt nicht ins Fenster
 * von gpt-oss-120b" sagt, was zu tun ist; „passt nicht ins Fenster der
 * Standard-KI" verlangte, den Namen erst zu übersetzen.
 *
 * EINE Form für beide Verwendungen („Zweitfassung mit …", „ins Fenster von …");
 * die frühere Dativ-Zweitform entfällt, weil ein Eigenname sich nicht beugt.
 *
 * Weitergereicht aus [modell-wahl.ts] statt hier zweitgeschrieben — der
 * Eskalations-Hinweis und die Modell-Auswahl lesen dieselbe Zuordnung.
 */
export const ZIEL_LABEL: Record<BridgeZiel, string> = MODELL_LABEL;

/**
 * `null`, wenn alles passt — der Normalfall soll keine Zeile erzeugen. Sonst der
 * Befund mit der konkreten Lücke und der Auskunft, ob ein KI-Wechsel reicht.
 */
export function pruefeKontextPasst(e: KontextBefundEingabe): KontextBefund | null {
  if (e.korpusZeichen <= e.cap) return null;
  const andere: BridgeZiel = e.ziel === 'qwen35' ? 'gpt-oss' : 'qwen35';
  return {
    zeichen: e.korpusZeichen,
    cap: e.cap,
    fehlend: e.korpusZeichen - e.cap,
    andereKiReicht: e.capAndere !== undefined && e.korpusZeichen <= e.capAndere,
    andereKiLabel: ZIEL_LABEL[andere],
    // `capAndere` fehlt genau dann, wenn das Ziel nicht wirkt (siehe dort) —
    // dieselbe Bedingung entscheidet, ob ein Tab-Name überhaupt zutrifft.
    fensterLabel: e.capAndere === undefined ? 'des Modells' : 'von ' + ZIEL_LABEL[e.ziel],
  };
}
