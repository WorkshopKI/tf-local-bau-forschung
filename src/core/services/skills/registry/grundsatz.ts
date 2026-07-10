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
