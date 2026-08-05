/**
 * Was diese Datei festnagelt:
 *
 * 1. Der Satz nennt innerhalb der Phasen das Substantiv NUR einmal
 *    („1 Phase entfernt · 2 umbenannt"). Fünfmal „Phase" läse sich wie fünf
 *    verschiedene Gegenstände.
 * 2. Ohne Drift ist der Satz leer — die Zeile erscheint dann gar nicht.
 * 3. Einzahl und Mehrzahl stimmen (die Zählwort-Hilfe wird auch benutzt).
 * 4. Eine Zuordnung nennt links die AUSGELIEFERTE und rechts die GEPFLEGTE
 *    Beschriftung. Nähme man nur eine, hieße eine umbenannte Zielphase auf
 *    beiden Seiten gleich („Prüfung → Prüfung").
 * 5. Leere Gruppen fallen weg.
 */
import { describe, it, expect } from 'vitest';
import { driftSatz, driftGruppen, DRIFT_ZWECK } from '@/plugins/status-cockpit/katalogDriftAnsicht';
import { leereKatalogDrift, type KatalogDrift } from '@/core/status';
import { SEED_ZAH_PHASEN } from '@/core/status/zah-phasen';
import type { ZahPhase } from '@/core/status';

/** Die Fassung vom 05.08. als Bilanz — ohne den Katalog dafür bauen zu müssen. */
function bilanzV16(): KatalogDrift {
  const d = leereKatalogDrift();
  d.phasen.entfernt = [{ id: 'vollstaendigkeit', label: 'Vollständigkeit' }];
  d.phasen.umbenannt = [
    { id: 'pruefung', alt: 'Prüfung', neu: 'In Prüfung' },
    { id: 'entscheidung', alt: 'Entscheidung', neu: 'Erstentscheidung' },
  ];
  d.zuordnungen = [32, 33, 34, 35, 36, 37, 72, 75].map(code => ({
    code, bezeichnung: `Text ${code}`, vorher: 'entscheidung', nachher: 'pruefung',
  }));
  d.zuordnungen.push(
    { code: 90, bezeichnung: 'Text 90', vorher: 'abgeschlossen', nachher: 'begleitung' },
    { code: 91, bezeichnung: 'Text 91', vorher: 'abgeschlossen', nachher: 'begleitung' },
  );
  d.zieltage = Array.from({ length: 39 }, (_, i) => ({
    id: `status::w${i}`, code: null, wert: `Wert ${i}`, alt: null, neu: 14,
  }));
  d.statuswerte.stillgelegt = Array.from({ length: 26 }, (_, i) => ({
    id: `status::alt${i}`, code: null, wert: `Alt ${i}`,
  }));
  return d;
}

/** Die Phasen der Fassung: „Prüfung" heißt darin „In Prüfung". */
const FASSUNG_PHASEN: ZahPhase[] = SEED_ZAH_PHASEN
  .filter(p => p.id !== 'vollstaendigkeit')
  .map(p => (p.id === 'pruefung' ? { ...p, label: 'In Prüfung' } : { ...p }));

describe('driftSatz', () => {
  it('nennt das Substantiv der Phasen nur einmal', () => {
    expect(driftSatz(bilanzV16())).toBe(
      '1 Phase entfernt · 2 umbenannt · 10 Zuordnungen geändert · 39 Zieltage gepflegt '
      + '· 26 Werte stillgelegt',
    );
  });

  it('ohne Drift bleibt der Satz leer', () => {
    expect(driftSatz(leereKatalogDrift())).toBe('');
  });

  it('dekliniert die Einzahl mit', () => {
    const d = leereKatalogDrift();
    d.zuordnungen = [{ code: 32, bezeichnung: '', vorher: null, nachher: 'pruefung' }];
    d.zieltage = [{ id: 'x', code: 38, wert: 'x', alt: null, neu: 1 }];
    d.statuswerte.stillgelegt = [{ id: 'y', code: null, wert: 'y' }];
    expect(driftSatz(d)).toBe('1 Zuordnung geändert · 1 Zieltag gepflegt · 1 Wert stillgelegt');
  });

  it('nennt auch die stille Sorte: eine geänderte Vorgabe ohne Umhängung', () => {
    const d = leereKatalogDrift();
    d.phasen.vorgabeGeaendert = [{
      id: 'begleitung', label: 'Begleitung',
      arbeitsliste: { alt: 'begleitung', neu: 'abgeschlossen' }, codeAnzahl: 5,
    }];
    expect(driftSatz(d)).toBe('1 Phase mit geänderter Vorgabe');
  });
});

describe('driftGruppen', () => {
  const gruppen = driftGruppen(bilanzV16(), FASSUNG_PHASEN, SEED_ZAH_PHASEN);

  it('lässt leere Gruppen weg', () => {
    expect(gruppen.map(g => g.titel)).toEqual([
      'Verfahrensschritte', 'Zuordnungen', 'Zieltage (die Auslieferung führt keine)', 'Statuswerte',
    ]);
  });

  it('nennt Entfernung und Umbenennung im Klartext', () => {
    const texte = (gruppen[0]?.zeilen ?? []).map(z => z.text);
    expect(texte).toContain('„Vollständigkeit“ entfernt');
    expect(texte).toContain('„Prüfung“ heißt jetzt „In Prüfung“');
  });

  it('eine Zuordnung nennt links die ausgelieferte, rechts die gepflegte Beschriftung', () => {
    expect(gruppen[1]?.zeilen[0]?.text).toBe('32 Text 32: Entscheidung → In Prüfung');
  });

  it('die Zeilen-Ids kommen aus den Daten, nicht aus dem Text', () => {
    // Zwei Katalogzeilen desselben Codes ergeben denselben Satz; als React-Key
    // getaugt hätte der Text nicht (beobachtet in der Abnahme).
    const ids = gruppen.flatMap(g => g.zeilen.map(z => z.id));
    expect(new Set(ids).size, 'jede Zeile hat einen eigenen Schlüssel').toBe(ids.length);
  });

  it('„ohne Phase" steht als Marker-Beschriftung, nicht als leerer Wert', () => {
    const d = leereKatalogDrift();
    d.zuordnungen = [{ code: 11, bezeichnung: 'Skizze', vorher: 'eingang', nachher: null }];
    const g = driftGruppen(d, FASSUNG_PHASEN, SEED_ZAH_PHASEN);
    expect(g[0]?.zeilen[0]?.text).toBe('11 Skizze: Eingang → Marker (ohne Phase)');
  });

  it('der Zieltage-Titel sagt, dass die Auslieferung keine kennt', () => {
    const d = leereKatalogDrift();
    d.seedKenntZieltage = true;
    d.zieltage = [{ id: 'x', code: 38, wert: 'techn geprüft', alt: 10, neu: 21 }];
    const g = driftGruppen(d, FASSUNG_PHASEN, SEED_ZAH_PHASEN);
    expect(g[0]?.titel).toBe('Zieltage');
    expect(g[0]?.zeilen[0]?.text).toBe('38 techn geprüft: 21 Tage (war 10)');
  });

  it('der Zweck-Satz sagt ausdrücklich, dass nichts übernommen wird', () => {
    expect(DRIFT_ZWECK).toContain('nichts davon wird automatisch übernommen');
  });
});
