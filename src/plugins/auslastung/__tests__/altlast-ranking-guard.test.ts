/**
 * Convention-Test: Ranking-Schutz fuer den Altlast-Indikator.
 *
 * Der Altlast-Sub-Track (siehe `services/altlast.ts`) ist explizit informativ
 * und darf NIEMALS in den Pool-Matching-Score einfliessen. Sonst wuerden
 * langsame MAs durch ihren Backlog indirekt bevorzugt werden (weniger Score
 * → weniger neue Antraege → bleibt langsam, Teufelskreis).
 *
 * Diese Regel ist nur sinnvoll als Code-Convention durchsetzbar — kein
 * Type-System / kein Runtime-Check kann das schuetzen. Daher: simple
 * Source-Inspection.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('Ranking-Guard: kapazitaetsScore darf nicht auf Altlast-Daten zugreifen', () => {
  it('kapazitaet.ts erwähnt "altlast" nirgends (Imports oder Body)', () => {
    const src = readFileSync(resolve(HERE, '../services/kapazitaet/kapazitaet.ts'), 'utf-8');
    // Wir pruefen den GANZEN File-Inhalt, nicht nur den Score-Body — damit auch
    // Imports / Hilfsfunktionen drumherum sauber bleiben. `kapazitaet.ts`
    // soll die Existenz von Altlast schlichtweg nicht kennen.
    expect(src.toLowerCase()).not.toContain('altlast');
  });

  it('matching-engine.ts liest keine Altlast-Daten', () => {
    const src = readFileSync(resolve(HERE, '../services/matching/matching-engine.ts'), 'utf-8');
    // Falls die Datei nicht existiert (Refactor): Test soll erst rot werden
    // wenn das Pattern auftaucht, nicht wenn die Datei fehlt.
    expect(src.toLowerCase()).not.toContain('altlast');
  });
});
