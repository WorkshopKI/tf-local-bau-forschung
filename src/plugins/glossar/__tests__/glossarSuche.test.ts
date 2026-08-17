import { describe, it, expect } from 'vitest';
import { GLOSSAR_BEGRIFFE } from '@/core/glossar';
import type { StatusFeldEintrag } from '@/core/status';
import type { KuerzelZeile } from '../glossarZeilen';
import {
  ART_REIHENFOLGE, begriffAlsEintrag, flacheIds, gruppiere as gruppiereRoh,
  gesamtZahl, kuerzelAlsEintrag, leseSuche, markiere as markiereRoh, naechsteId,
  passtKuerzel as passtKuerzelRoh, rang as rangRoh, verwandteIds, waehleEintrag,
  type GlossarEintrag,
} from '../glossarSuche';

const ALLE = GLOSSAR_BEGRIFFE.map(begriffAlsEintrag);

// Die Prüflinge nehmen einen gelesenen `Suchbegriff`; die Tests sollen aber
// lesbar bleiben und die EINGABE zeigen, nicht deren Zerlegung.
const gruppiere = (e: readonly GlossarEintrag[], q: string) => gruppiereRoh(e, leseSuche(q));
const markiere = (t: string, q: string) => markiereRoh(t, leseSuche(q));
const rang = (e: GlossarEintrag, q: string) => rangRoh(e, leseSuche(q));
const passtKuerzel = (z: KuerzelZeile, q: string) => passtKuerzelRoh(z, leseSuche(q));

const feld = (feldId: string): StatusFeldEintrag => ({
  feldId, label: feldId, typ: 'datum', ebene: 'tv',
  prominenzDefault: 'normal', aktiv: true, unkuratiert: false,
});

const kuerzel = (o: Partial<KuerzelZeile> & { code: string }): KuerzelZeile => ({
  feld: feld(`D_${o.code}`), label: '', csvSpalte: `D_${o.code}`,
  rollen: [], rollenText: '', neutral: true, ordner: '', vorkommen: null,
  verdraengt: [], ...o,
});

describe('Glossar-Seed', () => {
  it('vergibt jede Id genau einmal', () => {
    const ids = GLOSSAR_BEGRIFFE.map(b => b.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('verweist nur auf Eintraege, die es gibt', () => {
    const ids = new Set(GLOSSAR_BEGRIFFE.map(b => b.id));
    const tot = GLOSSAR_BEGRIFFE.flatMap(
      b => (b.verwandt ?? []).filter(v => !ids.has(v)).map(v => `${b.id} → ${v}`),
    );
    expect(tot, `Verweise ins Leere:\n${tot.join('\n')}`).toEqual([]);
  });

  it('fuehrt die Abkuerzungen, die der Auftrag verlangt', () => {
    // Bewusst NICHT dabei (im Repo nirgends ausgeschrieben): TB, MAP, DMS.
    const pflicht = [
      'fkz', 'tv', 'verbund', 'nf', 'nl', 'rne', 'abl', 'sv', 'zuwb', 'vn',
      'precheck', 'ga', 'qs', 'foerdervariante', 'richtlinie', 'meilenstein',
      'zieltage', 'verfahrensschritt', 'arbeitsliste', 'fassung',
      'betrachtungsbereich', 'vorgang',
    ];
    const ids = new Set(GLOSSAR_BEGRIFFE.map(b => b.id));
    expect(pflicht.filter(p => !ids.has(p))).toEqual([]);
  });

  it('erklaert jeden Eintrag in ganzen Saetzen', () => {
    const duenn = GLOSSAR_BEGRIFFE
      .filter(b => b.erklaerung.trim().length < 20 || !b.erklaerung.trim().endsWith('.'))
      .map(b => b.id);
    expect(duenn).toEqual([]);
  });
});

describe('gruppiere', () => {
  it('liefert ohne Suchbegriff alle Eintraege in einer Gruppe', () => {
    const g = gruppiere(ALLE, '');
    expect(g).toHaveLength(1);
    expect(g[0]?.art).toBe('begriff');
    expect(gesamtZahl(g)).toBe(GLOSSAR_BEGRIFFE.length);
  });

  it('laesst leere Gruppen weg statt sie leer zu zeigen', () => {
    expect(gruppiere(ALLE, 'gibtesnicht')).toEqual([]);
  });

  it('sucht auch im Erklaerungstext, nicht nur im Titel', () => {
    const treffer = gruppiere(ALLE, 'zwischenbericht');
    expect(gesamtZahl(treffer)).toBeGreaterThan(0);
    expect(treffer[0]?.eintraege.some(e => e.titel === 'VN')).toBe(true);
  });

  it('stellt den Titel-Treffer vor den Fliesstext-Treffer', () => {
    const treffer = gruppiere(ALLE, 'nf');
    expect(treffer[0]?.eintraege[0]?.titel).toBe('NF');
  });

  it('ignoriert Gross-/Kleinschreibung und Rand-Leerzeichen', () => {
    const a = gruppiere(ALLE, '  ZuwB ');
    const b = gruppiere(ALLE, 'zuwb');
    expect(gesamtZahl(a)).toBe(gesamtZahl(b));
  });

  it('haelt die Gruppen in der festgelegten Reihenfolge', () => {
    const arten = gruppiere(ALLE, '').map(g => g.art);
    const erwartet = ART_REIHENFOLGE.filter(a => arten.includes(a));
    expect(arten).toEqual(erwartet);
  });
});

describe('rang', () => {
  const nf = begriffAlsEintrag(GLOSSAR_BEGRIFFE.find(b => b.id === 'nf')!);

  it('wertet die exakte Uebereinstimmung am hoechsten', () => {
    expect(rang(nf, 'nf')).toBe(0);
  });

  it('wertet einen reinen Fliesstext-Treffer am niedrigsten', () => {
    expect(rang(nf, 'antragsteller')).toBe(3);
  });
});

describe('waehleEintrag', () => {
  it('leitet die Auswahl aus den sichtbaren Gruppen ab', () => {
    const g = gruppiere(ALLE, '');
    expect(waehleEintrag(g, 'begriff:nf')?.titel).toBe('NF');
  });

  it('gibt null, wenn der gewaehlte Eintrag weggefiltert wurde', () => {
    // Genau der Fall „Detail schliesst sich beim Weitertippen von selbst".
    expect(waehleEintrag(gruppiere(ALLE, 'zuwb'), 'begriff:nf')).toBeNull();
  });
});

describe('leseSuche', () => {
  it('faltet und zerlegt in Woerter', () => {
    expect(leseSuche('  Brief   NF ')).toEqual({
      roh: 'Brief   NF', ganz: 'brief   nf', woerter: ['brief', 'nf'],
    });
  });

  it('meldet den leeren Begriff als leere Wortliste', () => {
    expect(leseSuche('').woerter).toEqual([]);
    expect(leseSuche('   ').woerter).toEqual([]);
  });
});

describe('Faltung in der Suche', () => {
  const nf = begriffAlsEintrag(GLOSSAR_BEGRIFFE.find(b => b.id === 'nf')!);
  const pruefung = [begriffAlsEintrag({
    id: 'p', begriff: 'Prüfung', erklaerung: 'Die fachliche Prüfung eines Antrags.',
  })];

  it('findet Umlaute ohne Umlaut getippt', () => {
    // Der eigentliche Zweck: „Prufung" soll „Prüfung" finden.
    expect(gesamtZahl(gruppiere(pruefung, 'prüfung'))).toBe(1);
    expect(gesamtZahl(gruppiere(pruefung, 'prufung'))).toBe(1);
    expect(gesamtZahl(gruppiere(pruefung, 'PRUFUNG'))).toBe(1);
  });

  it('faellt „ss" und „ß" aufeinander', () => {
    const z = kuerzel({ code: 'STR', label: 'Straße im Vorhaben' });
    expect(passtKuerzel(z, 'strasse')).toBe(true);
    expect(passtKuerzel(z, 'straße')).toBe(true);
  });

  it('wertet den Titel-Treffer weiter am hoechsten, auch gefaltet', () => {
    expect(rang(nf, 'nf')).toBe(0);
  });
});

describe('Mehrwort-Suche', () => {
  const z = kuerzel({
    code: 'ALT', label: 'Brief NF von BB angelegt/ergaenzt',
    csvSpalte: 'D_ALT', ordner: 'Antragsbearbeitung',
  });

  it('verknuepft die Woerter mit UND', () => {
    expect(passtKuerzel(z, 'brief bb')).toBe(true);
    expect(passtKuerzel(z, 'brief gibtesnicht')).toBe(false);
  });

  it('ignoriert die Reihenfolge — wer nachschlaegt, kennt sie nicht', () => {
    expect(passtKuerzel(z, 'bb brief')).toBe(true);
  });

  it('darf die Woerter aus VERSCHIEDENEN Feldern nehmen', () => {
    // „alt" steht im Code, „antrags" im Ordner — zusammen ein Treffer.
    expect(passtKuerzel(z, 'alt antrags')).toBe(true);
  });

  it('stellt den woertlichen Anfang vor den blossen Wort-Treffer', () => {
    // Beim Kürzel IST der Titel der Code — also über Begriffe geprüft, deren
    // Titel der Fließtext ist.
    const anfang = begriffAlsEintrag({ id: 'a', begriff: 'Brief NF an ASt', erklaerung: '.' });
    const verstreut = begriffAlsEintrag({ id: 'b', begriff: 'NF ohne Brief', erklaerung: '.' });
    expect(rang(anfang, 'brief nf')).toBe(1);
    expect(rang(verstreut, 'brief nf')).toBe(2);
  });
});

describe('flacheIds', () => {
  it('reiht die Eintraege ueber die Gruppen hinweg in Anzeigereihenfolge', () => {
    const ids = flacheIds(gruppiere(ALLE, ''));
    expect(ids).toHaveLength(GLOSSAR_BEGRIFFE.length);
    expect(ids[0]).toBe(gruppiere(ALLE, '')[0]?.eintraege[0]?.id);
  });

  it('ist leer, wenn nichts sichtbar ist', () => {
    expect(flacheIds(gruppiere(ALLE, 'gibtesnicht'))).toEqual([]);
  });
});

describe('naechsteId', () => {
  const ids = ['a', 'b', 'c'];

  it('steigt ohne Auswahl am passenden Ende ein', () => {
    expect(naechsteId(ids, null, 1)).toBe('a');
    expect(naechsteId(ids, null, -1)).toBe('c');
  });

  it('geht einen Schritt in die gewuenschte Richtung', () => {
    expect(naechsteId(ids, 'b', 1)).toBe('c');
    expect(naechsteId(ids, 'b', -1)).toBe('a');
  });

  it('klemmt an den Enden, statt umzubrechen', () => {
    expect(naechsteId(ids, 'c', 1)).toBe('c');
    expect(naechsteId(ids, 'a', -1)).toBe('a');
  });

  it('faengt eine weggefilterte Auswahl am Ende auf', () => {
    // Genau der Fall „weitergetippt, Auswahl verschwunden, dann Pfeil".
    expect(naechsteId(ids, 'weg', 1)).toBe('a');
    expect(naechsteId([], 'a', 1)).toBeNull();
  });
});

describe('markiere', () => {
  const text = (s: readonly { text: string }[]): string => s.map(t => t.text).join('');

  it('zeichnet ALLE Vorkommen aus, nicht nur das erste', () => {
    const s = markiere('NF an ASt, NF an BB', 'nf');
    expect(s.filter(t => t.treffer)).toHaveLength(2);
    expect(text(s)).toBe('NF an ASt, NF an BB');
  });

  it('gibt den Text unveraendert zurueck, wenn nichts gesucht wird', () => {
    expect(markiere('Brief NF', '')).toEqual([{ text: 'Brief NF', treffer: false }]);
    expect(markiere('Brief NF', '   ')).toEqual([{ text: 'Brief NF', treffer: false }]);
  });

  it('gibt den Text unveraendert zurueck, wenn nichts trifft', () => {
    expect(markiere('Brief NF', 'xyz')).toEqual([{ text: 'Brief NF', treffer: false }]);
  });

  it('behaelt die Schreibweise des Originals, nicht die der Eingabe', () => {
    const s = markiere('Brief NF von BB', 'nf');
    expect(s.find(t => t.treffer)?.text).toBe('NF');
  });

  it('verliert kein Zeichen — auch nicht am Anfang oder Ende', () => {
    for (const q of ['b', 'brief', 'bb', 'brief bb']) {
      expect(text(markiere('Brief NF von BB', q))).toBe('Brief NF von BB');
    }
  });

  it('markiert JEDES Wort der Eingabe, nicht nur das erste', () => {
    const s = markiere('Brief NF von BB', 'bb brief');
    expect(s.filter(t => t.treffer).map(t => t.text)).toEqual(['Brief', 'BB']);
  });

  it('markiert das Wort, das hier gar nicht vorkommt, einfach nicht', () => {
    // Es hat den Eintrag über einen anderen Text getroffen (Ordner, Erklärung).
    const s = markiere('Brief NF', 'brief antragsbearbeitung');
    expect(s.filter(t => t.treffer).map(t => t.text)).toEqual(['Brief']);
  });

  it('trifft trotz Faltung die richtigen Zeichen im Original', () => {
    // „ü" wird beim Falten zerlegt — eine Markierung, die auf dem gefalteten
    // Text schneidet, säße hier um ein Zeichen daneben.
    const s = markiere('Vor Prüfung danach', 'prufung');
    expect(s.filter(t => t.treffer).map(t => t.text)).toEqual(['Prüfung']);
    expect(text(s)).toBe('Vor Prüfung danach');
  });

  it('markiert ein ganzes „ß", auch wenn nur dessen halbe Faltung getroffen ist', () => {
    // „ß" faltet auf „ss"; „stras" endet mitten drin. Ein halbes „ß" gibt es
    // nicht — markiert wird das ganze Zeichen.
    const s = markiere('Die Straße', 'stras');
    expect(s.filter(t => t.treffer).map(t => t.text)).toEqual(['Straß']);
    expect(text(s)).toBe('Die Straße');
  });

  it('verschmilzt ueberlappende und angrenzende Treffer zu einem Feld', () => {
    const s = markiere('Brief', 'brie rief');
    expect(s).toEqual([{ text: 'Brief', treffer: true }]);
  });
});

describe('passtKuerzel', () => {
  const z = kuerzel({
    code: 'ALT', label: 'Brief NF von BB angelegt/ergaenzt',
    csvSpalte: 'D_ALT', ordner: 'Antragsbearbeitung',
  });

  it('trifft ueber Code, Label, Spalte und Ordner', () => {
    expect(passtKuerzel(z, 'alt')).toBe(true);
    expect(passtKuerzel(z, 'brief nf')).toBe(true);
    expect(passtKuerzel(z, 'd_alt')).toBe(true);
    expect(passtKuerzel(z, 'antragsbearbeitung')).toBe(true);
  });

  it('laesst ohne Suchbegriff alles stehen', () => {
    expect(passtKuerzel(z, '')).toBe(true);
    expect(passtKuerzel(z, '  ')).toBe(true);
  });

  it('urteilt gleich wie die Liste im Reiter „Nachschlagen"', () => {
    // Eine Formel für beide Reiter: sonst findet dieselbe Eingabe hier etwas
    // und dort nichts, ohne dass sich das erklären liesse.
    for (const q of ['alt', 'd_alt', 'brief', 'antrags', 'gibtesnicht']) {
      const inListe = gesamtZahl(gruppiere([kuerzelAlsEintrag(z)], q)) > 0;
      expect(passtKuerzel(z, q), q).toBe(inListe);
    }
  });
});

describe('verwandteIds', () => {
  it('ergaenzt die Gegenrichtung eines einseitig gepflegten Verweises', () => {
    // `fkz` nennt `tv`; `tv` nennt `fkz` NICHT — trotzdem muss der Verweis
    // von beiden Seiten sichtbar sein.
    const tv = GLOSSAR_BEGRIFFE.find(b => b.id === 'tv')!;
    expect(tv.verwandt).not.toContain('fkz');
    expect(verwandteIds(tv, GLOSSAR_BEGRIFFE)).toContain('fkz');
  });

  it('nennt keinen Eintrag doppelt und sich selbst nie', () => {
    for (const b of GLOSSAR_BEGRIFFE) {
      const ids = verwandteIds(b, GLOSSAR_BEGRIFFE);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).not.toContain(b.id);
    }
  });
});
