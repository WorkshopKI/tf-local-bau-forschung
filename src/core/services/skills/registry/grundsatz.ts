/**
 * Geteilter Grundsatz-Block der Prompt-Komposition — „streng quellenbasiert,
 * nichts erfinden, aktive Sprache".
 *
 * Bis v2.221 war dieser Block WORTGLEICH in `seed.ts` an zwei Stellen kopiert
 * (`buildKurzfassungPrompt` + `abschnittTemplate`). Seit dem Assistenten-Panel
 * (Phase 1) referenzieren ihn mehrere Aufrufer → EINE Heimat, kein Copy-Paste.
 *
 * **BYTE-IDENTITÄT ist kritisch:** die Journey-Paket-4-Rollout-Migration
 * (`GA_BELEG_KONTRAKT_MIGRATION`) vergleicht den Share-Stand gegen
 * `buildKurzfassungPrompt(false)` byte-genau, um kuratierte Edits zu schützen.
 * Diese Konstante reproduziert die 4 Zeilen (Header + 3 Bullets) EXAKT wie zuvor
 * inline — jede Änderung hier ändert das Seed-Template und mis-triggert die
 * Migration. Guard: `grundsatz.test.ts`.
 */
export const GRUNDSATZ_REGELN = `Regeln:
- **Streng quellenbasiert:** Nutze ausschließlich Inhalte der VB. Erfinde nichts.
- Fehlende Angaben kennzeichne wörtlich mit „[Im Antrag nicht genannt]".
- **Aktiver Stil:** Formuliere „Das Vorhaben…" statt „Der Antragsteller plant…". Keine Arbeitspaket-Verweise („AP1").`;

/**
 * Quellentreue für Kontexte, in denen KEIN Gutachtentext entsteht (Assistent-Panel,
 * Gedächtnis-Konsolidierung).
 *
 * `GRUNDSATZ_REGELN` ist auf die Erstellung von ZIM-Gutachtentext gemünzt. Wörtlich in
 * einen Frage-Antwort- oder JSON-Operationen-Kontext eingebettet, erzeugte er dort drei
 * Widersprüche pro Aufrufer (Prompt-Audit 2026-07):
 *
 *  - „Nutze ausschließlich Inhalte der **VB**" — im Assistenten steht der tragende Teil
 *    des Kontexts (Status, Fristen, nächster Schritt) gerade NICHT in der VB; im
 *    Gedächtnis-Prompt existiert überhaupt keine VB. Das Modell wurde auf eine Quelle
 *    verpflichtet, die es nicht hat, und die naheliegende Auflösung („keine zulässige
 *    Quelle → nichts tun") ist ein stiller Totalausfall.
 *  - Der Token `[Im Antrag nicht genannt]` beginnt mit `[`. Der Gedächtnis-Parser bindet
 *    an das ERSTE `[` der Antwort — die Stilregel und die Parser-Heuristik kollidierten
 *    also auf demselben Zeichen.
 *  - „Formuliere „Das Vorhaben…"" ist im Gedächtnis das Gegenteil des Gewollten (dort
 *    sind Einträge Fakten über den NUTZER), und „keine AP-Verweise" verbietet dem
 *    Assistenten die Antwort auf „Was steckt in AP1?", ohne eine Alternative zu nennen.
 *
 * Diese Variante behält den einzigen Teil, der überall gilt — belegte Aussagen, nichts
 * erfinden — und formuliert ihn quellen-agnostisch. Die Byte-Identität von
 * `GRUNDSATZ_REGELN` bleibt davon unberührt (sie wird nur gegen `seed.ts` verlangt).
 */
export const QUELLENTREUE_REGELN = `Regeln:
- **Streng quellenbasiert:** Stütze dich ausschließlich auf die oben bereitgestellten Angaben. Erfinde nichts.
- Reicht das Bereitgestellte für eine Aussage nicht aus, sage das offen, statt zu ergänzen.`;
