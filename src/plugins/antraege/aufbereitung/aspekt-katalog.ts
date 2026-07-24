/**
 * Prüfaspekt-Katalog A–J — **Leaf-Modul ohne Laufzeit-Abhängigkeiten** (nur diese
 * Konstante + ihre ID-Menge).
 *
 * Bewusst aus `aspekte.ts` herausgelöst: dessen Aspekt-Mapping-Logik zieht die
 * Transport-/IDB-/Converter-Kette (pdfjs) mit, sobald man es importiert. Wer nur den
 * Katalog braucht (Werkbank, Aspekt-Chips), importiert HIER — sonst schleppt jeder
 * Konsument den ganzen Aufbereitungs-Stack in seinen Modulgraphen (und Node-Tests
 * scheitern am pdfjs-Worker). `aspekte.ts` und das Aufbereitungs-Barrel re-exportieren
 * von hier, damit es weiter genau eine Quelle gibt.
 */

/** Ein fester Prüfaspekt (A–J) mit Name + knappem Fokus-Satz für den Prompt. */
export interface PruefAspekt {
  id: string;
  name: string;
  fokus: string;
}

/**
 * Prüfaspekt-Katalog A–J (Code-Konstante, NICHT Registry). Die Fokus-Sätze steuern
 * die LLM-Zuordnung; sie beschreiben knapp, was inhaltlich in den Aspekt gehört.
 */
export const PRUEF_ASPEKTE: PruefAspekt[] = [
  { id: 'A', name: 'Ausgangssituation & Marktbedarf', fokus: 'Warum das Vorhaben nötig ist: Problem, Ausgangslage, Bedarf im Markt.' },
  { id: 'B', name: 'Projektgegenstand', fokus: 'Was im Kern entwickelt wird — das FuE-Vorhaben als Ganzes.' },
  { id: 'C', name: 'Technische Funktionalitäten', fokus: 'Welche technischen Funktionen und Merkmale das Ergebnis haben soll.' },
  { id: 'D', name: 'Technische Risiken', fokus: 'Technische Herausforderungen, Unwägbarkeiten und Entwicklungsrisiken.' },
  { id: 'E', name: 'Stand der Technik & Konkurrenz', fokus: 'Abgrenzung zum aktuellen Stand der Technik und zu Wettbewerbern.' },
  { id: 'F', name: 'Realisierbarkeit', fokus: 'Machbarkeit: vorhandene Ausstattung, Vorarbeiten, Zeit- und Ressourcenrahmen.' },
  { id: 'G', name: 'Fachliche Eignung', fokus: 'Qualifikation und Kompetenz des Teams für dieses Vorhaben.' },
  { id: 'H', name: 'Projektplan', fokus: 'Arbeitspakete, Zeitplan und Personaleinsatz (Anlage 5).' },
  { id: 'I', name: 'Märkte & Marktanteile', fokus: 'Zielmärkte, Marktvolumen, angestrebte Marktanteile/Absatzzahlen und Preisvorstellungen.' },
  { id: 'J', name: 'Meilensteine & Zielkriterien', fokus: 'Explizite Meilensteine + messbare Abbruch-/Erfolgs-/Zielkriterien — oft ein eigenes Unterkapitel („Zielkriterien"/„Meilensteine"), AUCH innerhalb eines Markteinführungs-/Verwertungskapitels. Die angestrebten Marktanteile selbst zählen NICHT zu J (die sind I).' },
];

/** Menge der gültigen Aspekt-IDs (A–J). */
export const ASPEKT_IDS: ReadonlySet<string> = new Set(PRUEF_ASPEKTE.map(a => a.id));
