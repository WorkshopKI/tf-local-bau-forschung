/**
 * Was die Status-Karte der internen KI anzeigt — Punkt, Wort, Farbe.
 *
 * Eigenes Modul, weil genau diese Entscheidung einmal falsch war und sich in
 * der `.tsx` nicht festnageln liess: die Karte las allein `testErgebnis`, und
 * das raeumt sich fuenf Sekunden nach dem Test selbst weg
 * ([VerbindungGruppe.tsx](./VerbindungGruppe.tsx)). Die Pille zeigte
 * „Verbunden" also genau fuenf Sekunden lang und danach „Nicht verbunden",
 * waehrend die Bridge weiterlief und der KI-Tab „✅ Verbunden" im Titel trug.
 *
 * Zehn andere Stellen lasen `useBridgeStatus` laengst; diese eine blieb beim
 * Nachzug uebrig — in [AiAssistantCard](src/plugins/home/AiAssistantCard.tsx)
 * wurde derselbe Fall schon einmal behoben („kein hartkodiertes «Nicht
 * verbunden» mehr").
 */
import type { BridgeStatus } from '@/core/services/ai/bridge-status';

/** Ergebnis des Knopfs „Verbindung testen"; `null` = kein Test im Fenster. */
export type TestErgebnis = 'success' | 'error' | null;

export interface VerbindungsAnzeige {
  verbunden: boolean;
  text: string;
  /** CSS-Custom-Property, kein Farbwert — das Thema entscheidet. */
  punktFarbe: string;
}

/**
 * Der lebende Bridge-Status entscheidet, das Test-Echo ergaenzt ihn nur.
 *
 * **Dreiwertig in der FARBE, zweiwertig im WORT** — genau wie
 * [BridgeStatusIndicator](src/components/ui/BridgeStatusIndicator.tsx), die
 * einzige andere Stelle, die den Zustand anzeigt statt ihn zu einem Ja/Nein zu
 * verrechnen. Ein drittes Wort waere eine Erfindung; die Farbe traegt die
 * dritte Stufe.
 */
export function verbindungsAnzeige(
  bridgeStatus: BridgeStatus,
  testErgebnis: TestErgebnis,
): VerbindungsAnzeige {
  const verbunden = bridgeStatus === 'connected' || testErgebnis === 'success';
  return {
    verbunden,
    // „Nicht erreichbar" ist die Auskunft eines FEHLGESCHLAGENEN Tests und darf
    // einer inzwischen lebenden Bridge nicht widersprechen.
    text: verbunden
      ? 'Verbunden'
      : testErgebnis === 'error'
        ? 'Nicht erreichbar'
        : 'Nicht verbunden',
    // gruen verbunden / amber getrennt (handlungsbarer Zustand, kein harter
    // Fehler) / grau `unknown` — vor dem ersten KI-Tab kein falsches „getrennt".
    punktFarbe: verbunden
      ? 'var(--tf-success-text)'
      : bridgeStatus === 'disconnected'
        ? 'var(--tf-warning-text)'
        : 'var(--tf-text-tertiary)',
  };
}
