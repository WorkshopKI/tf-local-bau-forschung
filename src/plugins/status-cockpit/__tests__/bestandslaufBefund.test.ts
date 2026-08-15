/**
 * Die **Wertung** des Bestandslaufs — die eine Schicht, die ohne IDB prüfbar ist.
 *
 * Am Bestand sind die Zusagen erfüllt und die meisten Auffälligkeiten leer. Eine
 * Funktion, die dort immer dasselbe liefert, ist ohne Gegenprobe nicht von einer
 * kaputten zu unterscheiden — jede Regel wird deshalb in beide Richtungen
 * geprüft, nicht nur im guten Ausgang.
 *
 * Geprüft werden `id` und `art`, nicht der Wortlaut: der darf umformuliert
 * werden, ohne dass ein Test bricht. Wo eine Zahl im Satz die Aussage IST, steht
 * sie trotzdem drin.
 */
import { describe, expect, it } from 'vitest';
import { leereBefunde, type VerlaufsBefunde } from '@/core/status/verlauf';
import { leereFristBefunde, type FristBefunde } from '../fristErhebung';
import { baueBefunde, type Befund } from '../bestandslaufBefund';

/** Ein Haltedatum-Lauf, wie er am gesunden Bestand aussieht: diagonal, nichts umdatiert. */
function fristLauf(teil: Partial<FristBefunde> = {}): FristBefunde {
  const b = leereFristBefunde();
  b.vorgaenge = 100;
  b.zustandsMatrix.set('angehalten→angehalten', 100);
  b.jeQuelle.set('datumsfeld', 100);
  return { ...b, ...teil };
}

/** Ein Verlaufslauf ohne jede Auffälligkeit — die Gegenprobe hängt Zahlen dran. */
function verlaufLauf(teil: Partial<VerlaufsBefunde> = {}): VerlaufsBefunde {
  const b = leereBefunde();
  b.teilvorhaben = 200;
  b.zustaendeTv.verlauf = 100;
  b.verbuende = 50;
  b.verbuendeMitStatuswechsel = 25;
  b.segmente = 80;
  b.dauerHistogramm.set(10, 40);
  return { ...b, ...teil };
}

const finde = (liste: Befund[], id: string): Befund | undefined => liste.find(b => b.id === id);
const ids = (liste: Befund[]): string[] => liste.map(b => b.id);

describe('Zusagen', () => {
  it('meldet die diagonale Matrix als erfüllt', () => {
    const b = finde(baueBefunde(null, fristLauf()), 'frist-zustand-unbewegt');
    expect(b?.art).toBe('zusage');
    expect(b?.erfuellt).toBe(true);
  });

  it('kippt, sobald ein Vorgang den Frist-Zustand wechselt', () => {
    const f = fristLauf();
    f.zustandsMatrix.set('angehalten→laeuft', 1);
    expect(finde(baueBefunde(null, f), 'frist-zustand-unbewegt')?.erfuellt).toBe(false);
  });

  it('kippt bei einem umdatierten Vorhaben und nennt die Zahl', () => {
    const b = finde(baueBefunde(null, fristLauf({ umdatiert: 3 })), 'frist-umdatiert');
    expect(b?.erfuellt).toBe(false);
    expect(b?.text).toContain('3');
  });
});

describe('Stumme Verlaufsquelle', () => {
  it('meldet nichts, wenn die Quelle datiert', () => {
    expect(finde(baueBefunde(null, fristLauf({ neuDatiert: 12, angehaltenOhneDatum: 40 })),
      'frist-quelle-stumm')).toBeUndefined();
  });

  it('meldet nichts, wenn zwar nichts datiert wurde, aber auch nichts offen ist', () => {
    expect(finde(baueBefunde(null, fristLauf()), 'frist-quelle-stumm')).toBeUndefined();
  });

  it('meldet genau den Fall aus null Datierungen NEBEN angehaltenen Vorgängen', () => {
    const b = finde(baueBefunde(null, fristLauf({ angehaltenOhneDatum: 42 })),
      'frist-quelle-stumm');
    expect(b?.art).toBe('auffaellig');
    expect(b?.text).toContain('42');
  });

  it('zählt NICHT jede unbekannte Quelle — laufende Vorgänge brauchen kein Haltedatum', () => {
    // 1 030 „Quelle unbekannt", davon nur 42 angehalten: die große Zahl behauptete
    // eine Lücke, die es nicht gibt.
    const f = fristLauf({ angehaltenOhneDatum: 0 });
    f.jeQuelle.set('unbekannt', 1030);
    expect(finde(baueBefunde(null, f), 'frist-quelle-stumm')).toBeUndefined();
  });
});

describe('Auffälligkeiten des Verlaufslaufs', () => {
  it('schweigt, solange keine vorkommt', () => {
    const alle = baueBefunde(verlaufLauf(), null);
    expect(alle.filter(b => b.art === 'auffaellig')).toHaveLength(0);
  });

  it('reicht die Belege zum unbekannten Zielcode durch', () => {
    const v = verlaufLauf({ zielCodeUnbekannt: 16 });
    v.beispiele.zielCodeUnbekannt.push({ text: 'VV → 47', kuerzel: 'VV' });
    const b = finde(baueBefunde(v, null), 'zielcode-unbekannt');
    expect(b?.beispiele).toEqual([{ text: 'VV → 47', kuerzel: 'VV' }]);
  });

  it('nennt beim Widerspruch die Lücken daneben — sonst liest er sich als Ausreißer', () => {
    const b = finde(
      baueBefunde(verlaufLauf({ abweichungWiderspruch: 940, abweichungNichtAbleitbar: 1941 }), null),
      'abweichung-widerspruch',
    );
    expect(b?.text).toContain('940');
    expect(b?.hinweis).toContain('1.941');
  });

  it('meldet negative Dauern und strittige Anleihen einzeln', () => {
    const v = verlaufLauf({ segmenteRueckwaerts: 14, bezeichnungGeliehenUneindeutig: 6 });
    expect(ids(baueBefunde(v, null))).toContain('dauer-negativ');
    expect(ids(baueBefunde(v, null))).toContain('geliehen-strittig');
  });
});

describe('Kennzahlen', () => {
  it('trägt kein Symbol — sie beschreiben, sie werten nicht', () => {
    const b = finde(baueBefunde(verlaufLauf(), null), 'bahn-deckung');
    expect(b?.art).toBe('kennzahl');
    expect(b?.erfuellt).toBeUndefined();
  });

  it('nennt je Anteil seine eigene Grundgesamtheit', () => {
    const b = finde(baueBefunde(verlaufLauf(), null), 'bahn-deckung');
    // 100/200 Teilvorhaben, 25/50 Verbünde, 40/80 Abschnitte messbar.
    expect(b?.text).toContain('50,0 %');
    expect(b?.hinweis).toContain('50,0 %');
  });

  it('sortiert die Haltedatum-Quellen nach Gewicht', () => {
    const f = fristLauf();
    f.jeQuelle.set('unbekannt', 1030);
    f.jeQuelle.set('datumsfeld', 5585);
    const b = finde(baueBefunde(null, f), 'haltedatum-quellen');
    expect(b?.text.indexOf('5.585')).toBeLessThan(b?.text.indexOf('1.030') ?? -1);
  });
});

describe('Reihenfolge und halbe Läufe', () => {
  it('stellt Zusagen vor Auffälligkeiten vor Kennzahlen', () => {
    const f = fristLauf({ umdatiert: 1 });
    f.jeQuelle.set('unbekannt', 5);
    const arten = baueBefunde(verlaufLauf({ zielCodeUnbekannt: 2 }), f).map(b => b.art);
    expect(arten).toEqual([...arten].sort(
      (a, b) => ['zusage', 'auffaellig', 'kennzahl'].indexOf(a)
        - ['zusage', 'auffaellig', 'kennzahl'].indexOf(b),
    ));
  });

  it('löscht bei einem fehlenden Lauf nur dessen Zeilen', () => {
    expect(ids(baueBefunde(verlaufLauf(), null))).toEqual(['bahn-deckung']);
    expect(ids(baueBefunde(null, fristLauf())))
      .toEqual(['frist-zustand-unbewegt', 'frist-umdatiert', 'haltedatum-quellen']);
    expect(baueBefunde(null, null)).toEqual([]);
  });
});
