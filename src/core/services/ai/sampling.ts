/**
 * Sampling-Temperatur der Skill-Läufe — zwei Werte, fest im Code.
 *
 * Bis v2.372 sendete die App **gar keinen** Sampling-Parameter: der Body in
 * [direct-llm.ts] bestand aus `model`, `messages`, `max_tokens`. Damit galt für
 * jeden Gutachten-Lauf still die Server-Voreinstellung — beim internen llama.cpp
 * `temperature: 1.0`. Welcher Wert wirkte, hing also an den Startflags des
 * Servers und stand nirgends im Projekt. Genau das beheben diese Konstanten.
 *
 * **Der Wert steuert die Regeltreue nicht.** v2.373 senkte den Standard auf 0,4
 * in der Annahme, ein streng quellenbasierter Text brauche wenig Streuung. Die
 * Messung widerlegt das: 125 Läufe (25 fiktive Vorhabensbeschreibungen × fünf
 * Temperaturen von 0,2 bis 1,0, Abschnitt A gegen das interne Modell) liegen bei
 * 88–96 % regelkonformer Entwürfe — der gesamte Abstand ist kleiner als der
 * Standardfehler von rund sechs Punkten bei 25 Läufen. Zahlen und Aufbau der
 * Messung: [gutachten-kurzfassung.md](../../../../docs/architecture/gutachten-kurzfassung.md).
 *
 * Daher `STANDARD = 1.0`: der Wert, der vor v2.372 ohnehin wirkte, jetzt
 * ausdrücklich gesetzt statt vom Server geerbt. Er ist keine Qualitätsaussage.
 * Wer die Ausgabe besser treffen will, ändert Prompt und Regeln, nicht diese Zahl.
 *
 * **Nicht 0**: Modelle mit Reasoning (Qwen3.x, gpt-oss) degradieren bei Greedy
 * Decoding und laufen in Wiederholschleifen; die Modellkarten empfehlen
 * ausdrücklich einen Wert deutlich über null.
 *
 * Bewusst **keine Einstellung in der Oberfläche**: eine weitere Stellschraube,
 * die falsch stehen kann, ohne dass es jemand merkt — genau die Klasse Defekt,
 * die v2.372 aufgeräumt hat. Erst recht, seit gemessen ist, dass sie nichts trägt.
 */

/** Standard aller Skill-Läufe — die Server-Voreinstellung, hier festgeschrieben. */
export const TEMPERATUR_STANDARD = 1.0;

/**
 * Zweitfassung ohne Bridge: dasselbe Modell, aber eine engere Auswahl bei jedem
 * Wort. Der Abstand zum Standard soll den Unterschied zwischen zwei Fassungen
 * tragen; die Messung zeigt, dass er die Regeltreue dabei nicht verschlechtert.
 */
export const TEMPERATUR_ZWEITFASSUNG = 0.4;

/**
 * Marker an einer erzeugten Fassung: sie entstand NICHT mit `TEMPERATUR_STANDARD`.
 *
 * `'mutig'` stammt aus v2.373, als der zweite Lauf eine höhere Temperatur fuhr.
 * Der Wert wird nur noch GELESEN (bereits gespeicherte Fassungen) und nie mehr
 * geschrieben — eine Migration wäre teurer als diese Zeile, denn beide Werte
 * bedeuten für den Leser dasselbe: „nicht die Standard-Einstellung".
 */
export type FassungMarker = 'abweichend' | 'mutig';
