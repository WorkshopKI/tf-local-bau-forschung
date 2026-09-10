/**
 * Der Fragen-Katalog: jede Frage erscheint nur, wenn ihr Signal vorliegt.
 * Geprüft wird je Eintrag mit UND ohne Signal — eine Frage, die immer
 * erscheint, obwohl sie ein Signal braucht, ist eine Einladung ins Leere.
 */
import { describe, expect, it } from 'vitest';
import { folgefragen, fragenFuer, fragenNachGruppe, mitBloecken, type FragenKontext } from '../fragenKatalog';
import { leseNutzerRolle } from '../nutzerRolle';
import type { KontextEntitaet, VorgangsAkte } from '@/core/services/assistent/kontext';

const verbund: KontextEntitaet = { art: 'verbund', id: 'VB-1', titel: 'Muster' };
const antrag: KontextEntitaet = { art: 'antrag', id: 'AZ-1', titel: 'Muster-TV' };

function akte(over: Partial<VorgangsAkte> = {}): VorgangsAkte {
  return { fuer: 'VB-1', aufgaben: [], offenePaare: [], teilvorhaben: [], ...over };
}

function k(over: Partial<FragenKontext> = {}): FragenKontext {
  return {
    entitaet: verbund,
    routeBeschreibung: 'Detailansicht Verbund',
    akte: akte(),
    nutzer: { fachrolle: 'alle', projektleitung: false },
    hatIndex: false,
    ...over,
  };
}

const ids = (x: FragenKontext): string[] => fragenFuer(x).map(f => f.id);

const zweiTv = [
  { aktenzeichen: 'AZ-1', titel: 'A', status: 'beantragt', eingang: '01.07.2026' },
  { aktenzeichen: 'AZ-2', titel: 'B', status: 'in QS', eingang: '03.07.2026' },
];

describe('fragenFuer — nur, was ein Signal trägt', () => {
  it('ohne Signale bleiben die Grundfragen des Vorgangs', () => {
    expect(ids(k())).toEqual(['naechster-schritt', 'wo-stehe-ich', 'worum-geht-es']);
  });

  it('ohne Vorgang: die Fragen zum Arbeitsvorrat', () => {
    expect(ids(k({ entitaet: null, akte: null }))).toEqual(['fristen', 'heute-dran']);
  });

  it('„Meine Aufgabe" nur mit Fachrolle, im Wortlaut der Rolle', () => {
    expect(ids(k())).not.toContain('meine-aufgabe');
    const fb = fragenFuer(k({ nutzer: { fachrolle: 'fb', projektleitung: false } }))
      .find(f => f.id === 'meine-aufgabe');
    expect(fb?.frage).toBe('Was muss ich als FB hier tun?');
  });

  it('„Worauf wartet er?" braucht eine wartende Rolle oder ein offenes Paar', () => {
    const liegt = akte({ aufgaben: [{ rolle: 'AB', text: 'GA schreiben', adresse: 'liegt bei AB', abgeleitet: false }] });
    expect(ids(k({ akte: liegt }))).not.toContain('worauf-wartet');
    const wartet = akte({ aufgaben: [{ rolle: 'AB', text: 'in QS', adresse: 'wartet auf QS', abgeleitet: false }] });
    expect(ids(k({ akte: wartet }))).toContain('worauf-wartet');
    const paar = akte({ offenePaare: [{ tv: 'AZ-1', gesetzt: 'AK4', fehlt: 'AT4', fehltLabel: 'GA techn.', seit: '01.07.2026', tage: 30 }] });
    expect(ids(k({ akte: paar }))).toContain('worauf-wartet');
  });

  it('die Frist-Fragen folgen dem Frist-Zustand', () => {
    const laeuft = ids(k({ akte: akte({ frist: { zustand: 'laeuft', text: 'läuft, noch 3 Tage' } }) }));
    expect(laeuft).toContain('frist-rest');
    expect(laeuft).not.toContain('frist-angehalten');
    const steht = ids(k({ akte: akte({ frist: { zustand: 'angehalten', text: 'angehalten' } }) }));
    expect(steht).toContain('frist-angehalten');
    expect(steht).not.toContain('frist-rest');
    const ohne = ids(k({ akte: akte({ frist: { zustand: 'nicht_berechenbar', text: 'nicht berechenbar' } }) }));
    expect(ohne.filter(i => i.startsWith('frist'))).toEqual([]);
  });

  it('der Plan nur mit laufender Prognose, der Stillstand nur bei „hängt"', () => {
    const ms = (prognose: string): VorgangsAkte =>
      akte({ meilensteine: { prognose, restTage: 10, gerissen: [], faellig: [] } });
    expect(ids(k({ akte: ms('gefährdet') }))).toContain('plan-halten');
    expect(ids(k({ akte: ms('abgeschlossen') }))).not.toContain('plan-halten');
    expect(ids(k({ akte: akte({ stillstand: { urteil: 'haengt', text: 'x' } }) }))).toContain('liegt-zu-lange');
    expect(ids(k({ akte: akte({ stillstand: { urteil: 'unbewertet', text: 'x' } }) }))).not.toContain('liegt-zu-lange');
  });

  it('die Verlaufsfragen brauchen Termine bzw. mehrere Eingänge', () => {
    expect(ids(k())).not.toContain('seit-eingang');
    const mitTerminen = akte({
      verlauf: { von: '01.07.2026', bis: '02.07.2026', schritte: 1, datumsangaben: 1, nichtGesetzt: 0, termine: [{ tag: '01.07.2026', label: 'Eingang', rollen: 'alle', traeger: 'Verbund' }] },
    });
    expect(ids(k({ akte: mitTerminen }))).toContain('seit-eingang');
    expect(ids(k({ akte: akte({ teilvorhaben: zweiTv }) }))).toContain('tv-eingaenge');
    expect(ids(k({ entitaet: antrag, akte: akte({ fuer: 'AZ-1', teilvorhaben: zweiTv }) }))).not.toContain('tv-eingaenge');
  });

  it('der Vergleich der Teilvorhaben nur, wenn sie sich unterscheiden', () => {
    expect(ids(k({ akte: akte({ teilvorhaben: zweiTv }) }))).toContain('tv-vergleich');
    const gleich = zweiTv.map(t => ({ ...t, status: 'beantragt' }));
    expect(ids(k({ akte: akte({ teilvorhaben: gleich }) }))).not.toContain('tv-vergleich');
  });

  it('die Fragen der Projektleitung nur mit PL-Schalter', () => {
    const mitSignal = akte({ frist: { zustand: 'laeuft', text: 'x' }, zuweisung: { ab: 1, fb: 0, von: 1 } });
    expect(ids(k({ akte: mitSignal })).filter(i => i.startsWith('pl-'))).toEqual([]);
    expect(ids(k({ akte: mitSignal, nutzer: { fachrolle: 'alle', projektleitung: true } })))
      .toEqual(expect.arrayContaining(['pl-gefaehrdet', 'pl-zugewiesen']));
  });

  it('die Akte eines anderen Vorgangs trägt kein Signal', () => {
    const fremd = akte({ fuer: 'ANDERER', frist: { zustand: 'laeuft', text: 'x' } });
    expect(ids(k({ akte: fremd }))).not.toContain('frist-rest');
  });

  it('„Zusammenfassen" braucht den Suchindex', () => {
    expect(ids(k())).not.toContain('zusammenfassen');
    expect(ids(k({ hatIndex: true }))).toContain('zusammenfassen');
  });
});

describe('fragenNachGruppe', () => {
  it('ordnet nach Gruppe und lässt leere Gruppen weg', () => {
    const g = fragenNachGruppe(k({ akte: akte({ frist: { zustand: 'laeuft', text: 'x' } }) }));
    expect(g.map(x => x.gruppe)).toEqual(['lage', 'fristen', 'inhalt']);
    expect(g[1]?.titel).toBe('Fristen und Plan');
  });
});

describe('folgefragen', () => {
  const reich = akte({
    frist: { zustand: 'laeuft', text: 'x' },
    stillstand: { urteil: 'haengt', text: 'x' },
    meilensteine: { prognose: 'gefährdet', restTage: 3, gerissen: [], faellig: [] },
  });

  it('lässt Gestelltes weg und nimmt zuerst die Gruppe der letzten Frage', () => {
    const f = folgefragen(k({ akte: reich }), ['Wie viel Zeit bleibt bis zur Frist – und ab wann zählt sie?']);
    expect(f.map(x => x.id)).toEqual(['plan-halten', 'liegt-zu-lange', 'naechster-schritt']);
  });

  it('eine getippte Frage ohne Katalogtreffer: Katalogreihenfolge', () => {
    const f = folgefragen(k({ akte: reich }), ['Was steht in Anlage 5?']);
    expect(f.map(x => x.id)).toEqual(['naechster-schritt', 'wo-stehe-ich', 'frist-rest']);
  });
});

describe('fragenFuer — Verlauf, Journal, eigene Arbeit, Umfeld', () => {
  const termin = { tag: '01.07.2026', label: 'Eingang', rollen: 'alle', traeger: 'Verbund' };
  const verlauf = (statusAbschnitte?: number): VorgangsAkte['verlauf'] => ({
    von: null, bis: null, schritte: 1, datumsangaben: 1, nichtGesetzt: 0, termine: [termin],
    ...(statusAbschnitte !== undefined ? { statusAbschnitte } : {}),
  });
  const frage = (x: FragenKontext, id: string) => fragenFuer(x).find(f => f.id === id);

  it('„Was ist passiert?" schaltet den vollen Verlauf zu', () => {
    expect(frage(k({ akte: akte({ verlauf: verlauf() }) }), 'seit-eingang')?.bloecke).toEqual(['verlauf']);
  });

  it('„Wie lange in welchem Status?" nur mit Statusabschnitten', () => {
    expect(ids(k({ akte: akte({ verlauf: verlauf() }) }))).not.toContain('status-dauer');
    expect(frage(k({ akte: akte({ verlauf: verlauf(3) }) }), 'status-dauer')?.bloecke).toEqual(['verlauf']);
  });

  it('die Journal-Fragen nur mit geladenem Journal und passendem Zähler', () => {
    const j = (aenderungen: number, zurueckgenommen: number): VorgangsAkte =>
      akte({ journal: { hinweis: 'ab 05.08.2026 belegt', aenderungen, zurueckgenommen } });
    expect(ids(k({ akte: j(0, 0) })).filter(i => i === 'seit-export' || i === 'zurueckgenommen')).toEqual([]);
    expect(ids(k({ akte: j(4, 0) }))).toContain('seit-export');
    expect(ids(k({ akte: j(4, 0) }))).not.toContain('zurueckgenommen');
    expect(frage(k({ akte: j(4, 1) }), 'zurueckgenommen')?.bloecke).toEqual(['journal']);
  });

  it('Eigene Arbeit und Umfeld folgen ihren Signalen', () => {
    expect(ids(k()).filter(i => ['gutachten-stand', 'nf-stand', 'pruefer', 'vorgaenger'].includes(i))).toEqual([]);
    const voll = akte({
      artefakte: { gutachten: 'Gutachten: …', nachforderung: 'Nachforderungen: …', pruefHinweise: ['Abschnitt B · Kohärenz: …'] },
      vorgaenger: ['(MUSTER) (VB-0) — 1 Teilvorhaben'],
    });
    const g = fragenNachGruppe(k({ akte: voll }));
    expect(g.find(x => x.gruppe === 'arbeit')?.fragen.map(f => f.id)).toEqual(['gutachten-stand', 'nf-stand', 'pruefer']);
    expect(g.find(x => x.gruppe === 'umfeld')?.fragen.map(f => f.id)).toEqual(['vorgaenger']);
  });
});

describe('mitBloecken', () => {
  it('vereinigt ohne Doppel und in stabiler Reihenfolge', () => {
    expect(mitBloecken(['verlauf'], ['journal', 'verlauf'])).toEqual(['verlauf', 'journal']);
    expect(mitBloecken([], undefined)).toEqual([]);
  });
});

describe('leseNutzerRolle', () => {
  it('liest Fachrolle und Projektleitung unabhängig voneinander', () => {
    expect(leseNutzerRolle({ status_rolle: 'fb', projektleitung: true })).toEqual({ fachrolle: 'fb', projektleitung: true });
    expect(leseNutzerRolle({ status_rolle: 'beide' })).toEqual({ fachrolle: 'alle', projektleitung: false });
    expect(leseNutzerRolle(null)).toEqual({ fachrolle: 'alle', projektleitung: false });
  });
});
