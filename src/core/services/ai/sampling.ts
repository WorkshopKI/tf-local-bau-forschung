/**
 * Sampling-Temperatur der Skill-Läufe — zwei Werte, fest im Code.
 *
 * Bis v2.372 sendete die App **gar keinen** Sampling-Parameter: der Body in
 * [direct-llm.ts] bestand aus `model`, `messages`, `max_tokens`. Damit galt für
 * jeden Gutachten-Lauf still die Server-Voreinstellung — beim internen llama.cpp
 * `temperature: 1.0` bei zufälligem Seed. Ein streng quellenbasierter Text, der
 * eine Zeichenzahl treffen soll, lief also auf der Kreativ-Einstellung, während
 * die Node-Eval, mit der die Skills vermessen wurden, auf `temperature: 0` fuhr
 * ([node-transport.ts]). Gemessen wurde unter anderen Bedingungen als gearbeitet.
 *
 * **Nicht 0**: Modelle mit Reasoning (Qwen3.x, gpt-oss) degradieren bei Greedy
 * Decoding und laufen in Wiederholschleifen; die Modellkarten empfehlen für den
 * Thinking-Modus ausdrücklich einen Wert deutlich über null. `SICHER` liegt darunter,
 * `MUTIG` knapp unter der Server-Voreinstellung — der Abstand soll den Unterschied
 * zwischen zwei Fassungen tragen, nicht ein anderes Modell simulieren.
 *
 * Bewusst **keine Einstellung in der Oberfläche**: eine weitere Stellschraube,
 * die falsch stehen kann, ohne dass es jemand merkt — genau die Klasse Defekt,
 * die v2.372 aufgeräumt hat.
 */

/** Standard aller Skill-Läufe: quellentreu, wenig Streuung. */
export const TEMPERATUR_SICHER = 0.4;

/** Zweitfassung „mutigere Einstellung": mehr Streuung für einen echten Vergleich. */
export const TEMPERATUR_MUTIG = 0.9;
