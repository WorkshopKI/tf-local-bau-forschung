/**
 * Seit dem htmx-Umbau spricht die Bridge den Server DIREKT an — und übernimmt
 * damit die zweite Hälfte von htmx mit: das Einhängen der Antwort in die Seite.
 * Ohne das bleibt der sichtbare Chat der internen KI leer, obwohl Frage und
 * Antwort längst gelaufen sind (Befund aus dem Echtbetrieb, v6.3).
 *
 * **Was dieser Test NICHT kann:** prüfen, dass die Anzeige wirklich erscheint.
 * Dafür bräuchte es das echte Antwort-Fragment der fremden Seite; ein selbst
 * erfundenes Fixture würde nur die eigene Annahme bestätigen. Das bleibt der
 * Abnahme am Produktivsystem.
 *
 * Geprüft werden die zwei Invarianten, die ein späterer Eingriff plausibel
 * bricht und die beide echten Schaden anrichten — beide sind am Quelltext
 * ablesbar, brauchen also kein DOM.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const SRC = readFileSync(
  fileURLToPath(new URL('../bridge-snippet.source.js', import.meta.url)),
  'utf-8',
);

/** Zeilen ohne Kommentare — sonst zählt die Begründung als Verstoß. */
const CODE = SRC.split('\n')
  .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
  .join('\n');

describe('Bridge-Snippet: Renderauftrag der Seite', () => {
  it('entschärft fremde Fragmente vor dem Einhängen (kein zweiter Antwortstrom)', () => {
    // Ein eingehängtes Fragment trägt die Strom-Adresse noch in sich. Bliebe sie
    // stehen, könnte die Mechanik der fremden Seite daran einen ZWEITEN
    // EventSource öffnen — derselbe Lauf zweimal, auf Kosten der internen KI,
    // und mit zwei Schreibern auf derselben Antwortblase.
    expect(CODE, 'entschaerfe() fehlt — ohne sie wird data-url mit eingehängt').toContain(
      'function entschaerfe(',
    );
    expect(CODE).toMatch(/removeAttribute\('data-url'\)/);
    // Nur die EINHÄNGENDEN Pfade müssen entschärfen — parseFragment() wird
    // daneben auch zum bloßen Lesen benutzt (Strom-Adresse, Fehlertext), und
    // dort wäre die Forderung sinnlos. Es gibt genau zwei Einhänge-Pfade:
    for (const pfad of ['wendeSwapAn', 'aktualisiereTokenleiste']) {
      const koerper = CODE.slice(CODE.indexOf(`function ${pfad}(`));
      const bisEnde = koerper.slice(0, koerper.indexOf('\n  }'));
      expect(
        bisEnde,
        `${pfad}() hängt ein Fragment ein, ohne es zu entschärfen — die fremde Seite könnte daran einen zweiten Antwortstrom öffnen`,
      ).toContain('entschaerfe(parseFragment(');
    }
  });

  it('fällt bei fehlendem hx-swap auf beforeend zurück, nie auf innerHTML', () => {
    // htmx' echter Standard ist innerHTML. Ihn hier zu übernehmen hieße: fehlt
    // das Attribut, LÖSCHEN wir den sichtbaren Verlauf der fremden Seite.
    // Anhängen an falscher Stelle ist der ungleich mildere Fehler.
    // An den Funktionskörper gebunden, nicht an die Datei: `hx-swap` steht
    // inzwischen auch in der Diagnose-Ausgabe, und ein dateiweiter Ausdruck
    // träfe irgendwann die falsche Stelle und bliebe trotzdem grün.
    const koerper = CODE.slice(CODE.indexOf('function wendeSwapAn('));
    const m = /hxAttr\(\w+, 'hx-swap', '([^']+)'\)/.exec(koerper.slice(0, koerper.indexOf('\n  }')));
    expect(m, 'Rückfall für hx-swap in wendeSwapAn() nicht gefunden').not.toBeNull();
    expect(
      m?.[1],
      'Rückfall auf innerHTML würde bei fehlendem Attribut den Verlauf der fremden Seite löschen',
    ).toBe('beforeend');
  });

  it('holt den Renderauftrag an allen drei Stellen nach', () => {
    // Senden, Antwortstrom, Zurücksetzen. Fehlt der Reset, steht der GELÖSCHTE
    // Verlauf weiter sichtbar da, während der Server ihn schon vergessen hat —
    // ein falscher Verlauf ist irreführender als gar keiner.
    expect(CODE, 'Senden hängt das Fragment nicht ein').toContain('zeigeImChat(form, res.text)');
    expect(CODE, 'Antwortstrom schreibt nicht in die Antwortblase').toMatch(
      /antwortEl\.innerHTML = String\(ev\.data/,
    );
    expect(CODE, 'Zurücksetzen hängt sein Fragment nicht ein').toMatch(
      /if \(res\.ok\) wendeSwapAn\(form, res\.text/,
    );
  });

  it('wertet die Tokenleiste des Stroms aus, statt sie wegzuwerfen', () => {
    // Die Leiste ist nicht bloß Anzeige: kontextStand() liest genau sie, und aus
    // ihr kommt das „Fenster voll"-Signal (data-over) an die App. Ohne Nachziehen
    // meldet die Bridge bis zum nächsten Neuladen einen veralteten Stand.
    expect(CODE).toContain('aktualisiereTokenleiste(ev.data)');
    expect(CODE, 'tokenbar-Ereignis ohne Nutzlast-Parameter → Payload fällt weg').not.toMatch(
      /addEventListener\('tokenbar', function \(\)/,
    );
  });
});
