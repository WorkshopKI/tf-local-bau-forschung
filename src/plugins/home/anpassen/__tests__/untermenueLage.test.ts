/**
 * Die Geometrie des Untermenüs — und die Reißleine gegen den Fehler, der sie
 * nötig gemacht hat (v4.7.0): das Menü ging mit bereits ausgeklapptem Untermenü
 * auf und sprang dabei nach links.
 *
 * Beides ist ohne DOM prüfbar: die Lage ist eine reine Funktion, und das
 * „öffnet nicht per Fokus" steht als Quelltext-Regel in `menueZeilen.tsx`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { berechneUntermenueLage, UNTERMENUE_LAGE_START } from '../useStartseiteMenue';

/** Hauptmenü mittig in einem 1480 px breiten Fenster, Panel 250 px. */
function lage(over: Partial<Parameters<typeof berechneUntermenueLage>[0]> = {}) {
  return berechneUntermenueLage({
    panel: { top: 100, left: 600, right: 850 },
    zeileOben: 130,
    breite: 268,
    abstand: 6,
    fensterBreite: 1480,
    fensterHoehe: 900,
    ...over,
  });
}

describe('berechneUntermenueLage — Seite, Versatz, Deckel', () => {
  it('legt das Untermenü rechts an, solange dort Platz ist', () => {
    expect(lage().seite).toBe('rechts');
  });

  it('klappt nach links, wenn rechts kein Platz mehr ist', () => {
    // Panel klebt am rechten Rand: 1480 − 1430 = 50 px, das reicht für 268 nicht.
    expect(lage({ panel: { top: 100, left: 1180, right: 1430 } }).seite).toBe('links');
  });

  it('bleibt rechts, wenn auch links kein Platz wäre', () => {
    // Schmales Fenster: beide Seiten zu eng — dann lieber rechts angeschnitten
    // als links aus dem Bild.
    expect(lage({
      panel: { top: 100, left: 40, right: 290 },
      fensterBreite: 380,
    }).seite).toBe('rechts');
  });

  it('hängt das Panel an seine Zeile, nicht an den Kopf des Menüs', () => {
    // Zeile 30 px unter der Panel-Oberkante, 4 px optischer Ausgleich.
    expect(lage().versatz).toBe(26);
  });

  it('kennt keinen negativen Versatz', () => {
    expect(lage({ zeileOben: 90 }).versatz).toBe(0);
  });

  it('deckelt die Höhe auf den Platz bis zum unteren Rand', () => {
    // 900 − 100 − 26 − 16 = 758
    expect(lage().maxHoehe).toBe(758);
  });

  it('verzichtet auf den Deckel, wenn unten ohnehin kaum Platz ist', () => {
    // Dann übernimmt die 78vh-Klasse; ein 40-px-Panel wäre unbedienbar.
    expect(lage({ panel: { top: 820, left: 600, right: 850 }, zeileOben: 850 }).maxHoehe).toBe(0);
  });

  it('hat eine Startlage, die sich als ungemessen ausweist', () => {
    // Der Nachtrag-Effekt erkennt daran, dass er noch messen muss — ein Flag
    // statt eines Vergleichs mit dieser Referenz, die ein Modul-Neustart bricht.
    expect(UNTERMENUE_LAGE_START).toEqual({
      versatz: 0, seite: 'rechts', maxHoehe: 0, gemessen: false,
    });
    expect(lage().gemessen).toBe(true);
  });
});

describe('MenueZeile öffnet Untermenüs nicht per Fokus', () => {
  it('verdrahtet onHover nicht an onFocus', () => {
    // Radix fokussiert beim Öffnen die erste Zeile. Hinge das Untermenü am
    // Fokus, ginge JEDES Menü sofort zweistöckig auf — genau der Fehler aus
    // v4.7.0. Erlaubt sind Überfahren, Klick und `→`.
    const quelle = readFileSync(
      resolve(process.cwd(), 'src/plugins/home/anpassen/menueZeilen.tsx'), 'utf8',
    );
    expect(quelle).not.toMatch(/onFocus=\{[^}]*onHover/);
    expect(quelle).toMatch(/onMouseEnter=\{[^}]*onHover/);
    expect(quelle).toMatch(/ArrowRight/);
  });
});

describe('Der Weg zum Untermenü darf es nicht schließen', () => {
  it('schließt nur an echten ZEILEN, nicht am Innenrand des Panels', () => {
    // `MenuePanel` trägt `p-[5px]`, die Zeilen sind `w-full` — rechts neben
    // jeder Zeile liegen also 5 px Panel, über die der Weg zum Untermenü führt.
    // Ein Handler, der bei allem schließt, was nicht `[data-untermenue]` ist,
    // trifft diesen Streifen: langsam nach rechts gezogen verschwand das
    // Untermenü, schnell gezogen nicht (v6.19). Erst `[data-menue-zeile]`
    // fragen, dann ob die Zeile ein eigenes Untermenü führt.
    const quelle = readFileSync(
      resolve(process.cwd(), 'src/plugins/home/anpassen/StartseiteMenue.tsx'), 'utf8',
    );
    expect(quelle).toMatch(/closest\('\[data-menue-zeile\]'\)/);
    expect(quelle).toMatch(/zeile && !zeile\.hasAttribute\('data-untermenue'\)/);
    // Die Marke muss auch gesetzt werden, sonst schlösse nie etwas.
    const zeilen = readFileSync(
      resolve(process.cwd(), 'src/plugins/home/anpassen/menueZeilen.tsx'), 'utf8',
    );
    expect(zeilen).toMatch(/data-menue-zeile=""/);
  });
});

describe('Das Untermenü verändert die Breite des Popovers nicht', () => {
  it('hängt absolut am Hauptmenü statt als Flex-Geschwister daneben', () => {
    // Als Geschwister im Fluss misst Radix 250 + 6 + 268 px, hält die Gruppe für
    // zu breit und schiebt sie vom Auslöser weg (v4.7.0).
    const quelle = readFileSync(
      resolve(process.cwd(), 'src/plugins/home/anpassen/StartseiteMenue.tsx'), 'utf8',
    );
    expect(quelle).toMatch(/className="absolute top-0"/);
    expect(quelle).not.toMatch(/flex-row items-start/);
    expect(quelle).toMatch(/onOpenAutoFocus/);
  });
});
