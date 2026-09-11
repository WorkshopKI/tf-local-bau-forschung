/**
 * Pfad-Operationen auf `Bedingung`-Bäumen.
 *
 * Der Prüfstein ist nicht „läuft durch", sondern: **sagt der Baum danach noch
 * dasselbe, was die Geste versprach?** Deshalb steht neben jedem Umbau die
 * erwartete Struktur, nicht nur eine Länge.
 */
import { describe, expect, it } from 'vitest';
import type { Bedingung } from '../typen';
import {
  benenneBedingungsGruppe, darfBedingungAusruecken, darfBedingungEinruecken, darfBedingungVerschieben,
  entferneBedingungAn, ersetzeBedingungAn,
  fuegeBedingungEin, holeBedingungAn, istBedingungsGruppe, gruppenKinder, pfadLiegtUnter, mitGruppenKindern,
  mitVerknuepfung, rueckeBedingungAus,
  rueckeBedingungEin, bedingungsTiefe, verpackeBedingungInGruppe, verschiebeBedingung,
  verschiebeBedingungsGeschwister,
} from '../bedingung-baum';
import { baueKontext, pruefeBedingung } from '../bedingung';
import { bedingungAlsText, bedingungSatz } from '../bedingung-text';

const a: Bedingung = { feldId: 'tib_kuerz', op: 'gefuellt' };
const b: Bedingung = { feldId: 'bib_kuerz', op: 'gefuellt' };
const c: Bedingung = { feldId: 'status', op: 'ist', wert: 'beantragt' };

/** `{ alle: [a, b, { einige: [c] }] }` — ein Blatt, ein Blatt, eine Gruppe. */
const baum = (): Bedingung => ({ alle: [a, b, { einige: [c] }] });

describe('bedingung-baum · Zugriff', () => {
  it('holeBedingungAn findet Wurzel, Blatt und verschachteltes Blatt', () => {
    expect(holeBedingungAn(baum(), [])).toEqual(baum());
    expect(holeBedingungAn(baum(), [1])).toEqual(b);
    expect(holeBedingungAn(baum(), [2, 0])).toEqual(c);
  });

  it('holeBedingungAn gibt null, wenn der Pfad ins Leere zeigt', () => {
    expect(holeBedingungAn(baum(), [9])).toBeNull();
    // Durch ein BLATT hindurch gibt es keinen Weg.
    expect(holeBedingungAn(baum(), [0, 0])).toBeNull();
  });

  it('bedingungsTiefe zählt die Ebenen, Wurzel = 0', () => {
    expect(bedingungsTiefe([])).toBe(0);
    expect(bedingungsTiefe([2, 0])).toBe(2);
  });

  it('pfadLiegtUnter erkennt den eigenen Teilbaum', () => {
    expect(pfadLiegtUnter([2, 0], [2])).toBe(true);
    expect(pfadLiegtUnter([2], [2])).toBe(true);
    expect(pfadLiegtUnter([1], [2])).toBe(false);
  });

  it('gruppenKinder/mitGruppenKindern behalten die Verknüpfung', () => {
    const g: Bedingung = { einige: [a] };
    expect(istBedingungsGruppe(g)).toBe(true);
    expect(gruppenKinder(g)).toEqual([a]);
    expect(mitGruppenKindern(g, [b])).toEqual({ einige: [b] });
  });
});

describe('bedingung-baum · Einfügen und Entfernen', () => {
  it('ersetzeBedingungAn tauscht ein verschachteltes Blatt, ohne den Rest zu berühren', () => {
    const neu = ersetzeBedingungAn(baum(), [2, 0], a);
    expect(neu).toEqual({ alle: [a, b, { einige: [a] }] });
  });

  it('ersetzeBedingungAn mit leerem Pfad ersetzt den ganzen Baum', () => {
    expect(ersetzeBedingungAn(baum(), [], a)).toEqual(a);
  });

  it('lässt den Baum unverändert, wenn der Pfad ins Leere zeigt', () => {
    const vorher = baum();
    expect(ersetzeBedingungAn(vorher, [7], a)).toEqual(vorher);
    expect(entferneBedingungAn(vorher, [7])).toEqual(vorher);
    expect(fuegeBedingungEin(vorher, [0], 0, a)).toEqual(vorher);
  });

  it('entferneBedingungAn nimmt das Blatt heraus', () => {
    expect(entferneBedingungAn(baum(), [1])).toEqual({ alle: [a, { einige: [c] }] });
  });

  it('entferneBedingungAn rührt die Wurzel nicht an', () => {
    expect(entferneBedingungAn(baum(), [])).toEqual(baum());
  });

  it('fuegeBedingungEin hängt bei zu großem Index hinten an', () => {
    expect(fuegeBedingungEin(baum(), [], 99, c)).toEqual({ alle: [a, b, { einige: [c] }, c] });
  });

  it('gibt einen NEUEN Baum zurück (Referenz-Vergleich in React)', () => {
    const vorher = baum();
    const nachher = entferneBedingungAn(vorher, [0]);
    expect(nachher).not.toBe(vorher);
    expect(vorher).toEqual(baum());
  });
});

describe('bedingung-baum · Verschieben', () => {
  it('schiebt ein Blatt in die Gruppe daneben', () => {
    const neu = verschiebeBedingung(baum(), [0], [2], 0);
    expect(neu).toEqual({ alle: [b, { einige: [a, c] }] });
  });

  it('holt ein Blatt aus der Gruppe an die Wurzel', () => {
    const neu = verschiebeBedingung(baum(), [2, 0], [], 0);
    expect(neu).toEqual({ alle: [c, a, b, { einige: [] }] });
  });

  it('korrigiert den Index beim Zug nach unten in derselben Liste', () => {
    // Ohne Korrektur landete „a eins nach hinten" wieder auf Position 0, weil
    // das Entfernen die Liste vorher schon verkürzt hat.
    const neu = verschiebeBedingung(baum(), [0], [], 2);
    expect(neu).toEqual({ alle: [b, a, { einige: [c] }] });
  });

  it('lässt den Zug nach oben in derselben Liste unkorrigiert', () => {
    const neu = verschiebeBedingung(baum(), [1], [], 0);
    expect(neu).toEqual({ alle: [b, a, { einige: [c] }] });
  });

  it('verweigert das Verschieben einer Gruppe in den eigenen Teilbaum', () => {
    const vorher = baum();
    expect(darfBedingungVerschieben(vorher, [2], [2])).toBe(false);
    expect(verschiebeBedingung(vorher, [2], [2], 0)).toEqual(vorher);
  });

  it('verweigert das Verschieben der Wurzel und das Ablegen auf einem Blatt', () => {
    const vorher = baum();
    expect(darfBedingungVerschieben(vorher, [], [2])).toBe(false);
    expect(darfBedingungVerschieben(vorher, [0], [1])).toBe(false);
  });

  it('verschiebeBedingungsGeschwister tauscht Nachbarn und hält an den Rändern', () => {
    expect(verschiebeBedingungsGeschwister(baum(), [1], 'hoch')).toEqual({ alle: [b, a, { einige: [c] }] });
    expect(verschiebeBedingungsGeschwister(baum(), [0], 'hoch')).toEqual(baum());
    expect(verschiebeBedingungsGeschwister(baum(), [2], 'runter')).toEqual(baum());
  });
});

describe('bedingung-baum · Ein- und Ausrücken', () => {
  it('rückt nur ein, wenn der Vorgänger eine Gruppe ist', () => {
    // `{ alle: [{ einige: [c] }, a] }` — a hat eine Gruppe vor sich.
    const mitGruppeVorn: Bedingung = { alle: [{ einige: [c] }, a] };
    expect(darfBedingungEinruecken(mitGruppeVorn, [1])).toBe(true);
    expect(rueckeBedingungEin(mitGruppeVorn, [1])).toEqual({ alle: [{ einige: [c, a] }] });
  });

  it('rückt NICHT ein, wenn der Vorgänger ein Blatt ist', () => {
    // Sonst entstünde stillschweigend eine Gruppe, die niemand gewählt hat.
    const vorher = baum();
    expect(darfBedingungEinruecken(vorher, [1])).toBe(false);
    expect(rueckeBedingungEin(vorher, [1])).toEqual(vorher);
  });

  it('rückt am ersten Kind und an der Wurzel nicht ein', () => {
    expect(darfBedingungEinruecken(baum(), [0])).toBe(false);
    expect(darfBedingungEinruecken(baum(), [])).toBe(false);
  });

  it('rückt hinter die eigene Gruppe aus', () => {
    expect(darfBedingungAusruecken([2, 0])).toBe(true);
    expect(rueckeBedingungAus(baum(), [2, 0])).toEqual({ alle: [a, b, { einige: [] }, c] });
  });

  it('rückt auf der obersten Ebene nicht aus', () => {
    expect(darfBedingungAusruecken([0])).toBe(false);
    expect(rueckeBedingungAus(baum(), [0])).toEqual(baum());
  });

  it('Einrücken und Ausrücken heben sich auf', () => {
    const start: Bedingung = { alle: [{ einige: [c] }, a] };
    const rein = rueckeBedingungEin(start, [1]);
    expect(rein).toEqual({ alle: [{ einige: [c, a] }] });
    expect(rueckeBedingungAus(rein, [0, 1])).toEqual(start);
  });

  it('trägt eine dritte Ebene (die alte Grenze lag bei zwei)', () => {
    const tief: Bedingung = { alle: [{ einige: [{ alle: [a] }, b] }] };
    expect(holeBedingungAn(tief, [0, 0, 0])).toEqual(a);
    expect(darfBedingungEinruecken(tief, [0, 1])).toBe(true);
    expect(rueckeBedingungEin(tief, [0, 1])).toEqual({ alle: [{ einige: [{ alle: [a, b] }] }] });
  });
});

describe('bedingung-baum · Verpacken', () => {
  const namen = (feldId: string): string => feldId;

  it('legt eine Gruppe um genau ein Blatt', () => {
    expect(verpackeBedingungInGruppe(baum(), [1]))
      .toEqual({ alle: [a, { alle: [b] }, { einige: [c] }] });
  });

  it('legt eine Gruppe auch um eine Gruppe', () => {
    expect(verpackeBedingungInGruppe(baum(), [2]))
      .toEqual({ alle: [a, b, { alle: [{ einige: [c] }] }] });
  });

  it('nimmt die gewünschte Verknüpfung', () => {
    expect(verpackeBedingungInGruppe(baum(), [0], 'einige'))
      .toEqual({ alle: [{ einige: [a] }, b, { einige: [c] }] });
  });

  it('lässt die Wurzel und tote Pfade unangetastet', () => {
    expect(verpackeBedingungInGruppe(baum(), [])).toEqual(baum());
    expect(verpackeBedingungInGruppe(baum(), [9])).toEqual(baum());
    expect(verpackeBedingungInGruppe(baum(), [0, 0])).toEqual(baum());
  });

  it('ändert die Aussage nicht — nur eine Klammer kommt dazu', () => {
    const vorher = bedingungAlsText(baum(), namen);
    const nachher = bedingungAlsText(verpackeBedingungInGruppe(baum(), [1]), namen);
    expect(vorher).toBe('(tib_kuerz gefüllt UND bib_kuerz gefüllt UND (status ist „beantragt"))');
    expect(nachher).toBe('(tib_kuerz gefüllt UND (bib_kuerz gefüllt) UND (status ist „beantragt"))');
    // Dieselben Teilaussagen, dieselbe Reihenfolge, dieselbe Verknüpfung.
    expect(nachher.replace(/[()]/g, '')).toBe(vorher.replace(/[()]/g, ''));
  });

  it('ist mit Ausrücken wieder rückgängig zu machen', () => {
    const verpackt = verpackeBedingungInGruppe(baum(), [1]);
    expect(darfBedingungAusruecken([1, 0])).toBe(true);
    expect(rueckeBedingungAus(verpackt, [1, 0]))
      .toEqual({ alle: [a, { alle: [] }, b, { einige: [c] }] });
  });
});

/*
 * Der Gruppenname ist ein Etikett ohne Aussage — aber er darf bei keinem Umbau
 * verloren gehen. Die Gefahr liegt dort, wo eine Gruppe NEU gebaut wird
 * (`mitGruppenKindern`, Umschalten der Verknüpfung): ein `{ alle: kinder }`
 * statt einer Kopie, und der Name ist beim nächsten Klick still weg.
 */
describe('bedingung-baum · Gruppenname', () => {
  const namen = (feldId: string): string => feldId;
  /** `{ alle: [a, { einige: [b, c], name: 'PreCheck' }] }` */
  const benannt = (): Bedingung => ({ alle: [a, { einige: [b, c], name: 'PreCheck' }] });
  const nameAn = (root: Bedingung, pfad: number[]): string | undefined => {
    const k = holeBedingungAn(root, pfad);
    return k && istBedingungsGruppe(k) ? k.name : undefined;
  };

  it('mitGruppenKindern behält den Namen', () => {
    expect(mitGruppenKindern({ einige: [a], name: 'X' }, [b])).toEqual({ einige: [b], name: 'X' });
  });

  it('mitVerknuepfung schaltet um und behält Name und Kinder', () => {
    expect(mitVerknuepfung({ einige: [a, b], name: 'X' }, 'alle')).toEqual({ alle: [a, b], name: 'X' });
    expect(mitVerknuepfung({ alle: [a] }, 'einige')).toEqual({ einige: [a] });
  });

  it('benenneBedingungsGruppe setzt, trimmt und entfernt den Namen', () => {
    expect(nameAn(benenneBedingungsGruppe(benannt(), [1], '  PreCheck AB  '), [1])).toBe('PreCheck AB');
    const geleert = benenneBedingungsGruppe(benannt(), [1], '   ');
    expect(holeBedingungAn(geleert, [1])).toEqual({ einige: [b, c] });
    expect('name' in (holeBedingungAn(geleert, [1]) as object)).toBe(false);
  });

  it('benenneBedingungsGruppe lässt Blätter und tote Pfade unangetastet', () => {
    expect(benenneBedingungsGruppe(benannt(), [0], 'X')).toEqual(benannt());
    expect(benenneBedingungsGruppe(benannt(), [9], 'X')).toEqual(benannt());
  });

  it('überlebt jeden Umbau in und um die Gruppe', () => {
    expect(nameAn(ersetzeBedingungAn(benannt(), [1, 0], a), [1])).toBe('PreCheck');
    expect(nameAn(entferneBedingungAn(benannt(), [1, 0]), [1])).toBe('PreCheck');
    expect(nameAn(fuegeBedingungEin(benannt(), [1], 0, a), [1])).toBe('PreCheck');
    expect(nameAn(verschiebeBedingungsGeschwister(benannt(), [1, 1], 'hoch'), [1])).toBe('PreCheck');
    // Die Gruppe selbst wandert — ihr Name wandert mit.
    expect(nameAn(verschiebeBedingungsGeschwister(benannt(), [1], 'hoch'), [0])).toBe('PreCheck');
    expect(nameAn(verschiebeBedingung(benannt(), [0], [1], 0), [0])).toBe('PreCheck');
    expect(nameAn(rueckeBedingungEin({ alle: [{ einige: [b], name: 'N' }, a] }, [1]), [0])).toBe('N');
    expect(nameAn(rueckeBedingungAus(benannt(), [1, 0]), [1])).toBe('PreCheck');
  });

  it('verpacken legt eine UNBENANNTE Hülle um die benannte Gruppe', () => {
    const verpackt = verpackeBedingungInGruppe(benannt(), [1]);
    expect(nameAn(verpackt, [1])).toBeUndefined();
    expect(nameAn(verpackt, [1, 0])).toBe('PreCheck');
  });

  it('der Evaluator ignoriert den Namen', () => {
    const ctx = baueKontext({ bib_kuerz: 'AB' });
    const ohne: Bedingung = { alle: [a, { einige: [b, c] }] };
    expect(pruefeBedingung(benannt(), ctx)).toBe(pruefeBedingung(ohne, ctx));
    expect(pruefeBedingung({ einige: [b], name: 'N' }, ctx)).toBe(true);
  });

  it('der Formatierer stellt den Namen VOR den Inhalt', () => {
    expect(bedingungAlsText({ einige: [b, c], name: 'PreCheck' }, namen))
      .toBe('PreCheck: (bib_kuerz gefüllt ODER status ist „beantragt")');
    expect(bedingungSatz(benannt(), namen))
      .toBe('tib_kuerz gefüllt UND PreCheck: (bib_kuerz gefüllt ODER status ist „beantragt")');
    // Ohne Namen bleibt der Satz wie bisher.
    expect(bedingungSatz({ alle: [a, { einige: [b, c] }] }, namen))
      .toBe('tib_kuerz gefüllt UND (bib_kuerz gefüllt ODER status ist „beantragt")');
  });
});
