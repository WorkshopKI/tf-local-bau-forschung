import { describe, it, expect } from 'vitest';
import { verbindungsAnzeige } from '../verbindungsAnzeige';

describe('verbindungsAnzeige — die Status-Karte der internen KI', () => {
  it('bleibt verbunden, wenn das Test-Echo verfaellt', () => {
    // DER Defekt: `testErgebnis` raeumt sich 5 s nach dem Test selbst weg.
    // Wurde es allein gelesen, zeigte die Karte „Verbunden" genau fuenf
    // Sekunden lang und danach „Nicht verbunden" — waehrend die Bridge lief
    // und der KI-Tab „✅ Verbunden" im Titel trug. Am 22.08.2026 gemessen:
    // ein echter Frage-Lauf ging durch, waehrend die Karte „Nicht verbunden"
    // behauptete.
    expect(verbindungsAnzeige('connected', 'success').text).toBe('Verbunden');
    expect(verbindungsAnzeige('connected', null).text).toBe('Verbunden');
    expect(verbindungsAnzeige('connected', null).verbunden).toBe(true);
  });

  it('nimmt einen frischen Test an, bevor der Store etwas gesehen hat', () => {
    // Die Gegenrichtung: `ping()` kann Erfolg melden, bevor eine Inbound-
    // Nachricht `markActivity` ausgeloest hat. Das Test-Echo ergaenzt den
    // Store, es ersetzt ihn nicht.
    expect(verbindungsAnzeige('unknown', 'success').verbunden).toBe(true);
  });

  it('laesst einen alten Fehlversuch einer lebenden Bridge NICHT widersprechen', () => {
    // „Nicht erreichbar" ist die Auskunft eines fehlgeschlagenen Tests. Meldet
    // sich die Bridge danach, ist sie ueberholt.
    expect(verbindungsAnzeige('disconnected', 'error').text).toBe('Nicht erreichbar');
    expect(verbindungsAnzeige('connected', 'error').text).toBe('Verbunden');
  });

  it('faerbt dreiwertig, benennt zweiwertig — wie der BridgeStatusIndicator', () => {
    // Die einzige andere Stelle, die den Zustand ANZEIGT statt ihn zu einem
    // Ja/Nein zu verrechnen, traegt die dritte Stufe in der Farbe und laesst
    // den Text bei zwei Worten. Ein drittes Wort waere eine Erfindung.
    expect(verbindungsAnzeige('connected', null).punktFarbe).toBe('var(--tf-success-text)');
    // amber, nicht rot: „getrennt" ist handlungsbar, kein harter Fehler.
    expect(verbindungsAnzeige('disconnected', null).punktFarbe).toBe('var(--tf-warning-text)');
    // grau: vor dem ersten KI-Tab kein falsches „getrennt".
    expect(verbindungsAnzeige('unknown', null).punktFarbe).toBe('var(--tf-text-tertiary)');

    const worte = new Set(
      (['connected', 'disconnected', 'unknown'] as const).flatMap(s =>
        ([null, 'success', 'error'] as const).map(t => verbindungsAnzeige(s, t).text),
      ),
    );
    expect(worte).toEqual(new Set(['Verbunden', 'Nicht verbunden', 'Nicht erreichbar']));
  });

  it('sagt „Nicht verbunden" nur ohne Bridge UND ohne Fehlversuch', () => {
    expect(verbindungsAnzeige('unknown', null).text).toBe('Nicht verbunden');
    expect(verbindungsAnzeige('disconnected', null).text).toBe('Nicht verbunden');
  });
});
