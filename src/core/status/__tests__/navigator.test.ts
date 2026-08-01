/**
 * Der Navigator schlägt vor, was im Foyer als Nächstes gesetzt werden kann —
 * und die Tests halten vor allem fest, was er dabei NICHT tun darf:
 *
 * - einen Kandidaten verwerfen, nur weil eine Bedingung nicht auswertbar war
 * - ein Kürzel wegen EINER verletzten Zeile fallen lassen, wenn eine andere
 *   Zeile desselben Kürzels noch feuern könnte
 * - ein neutrales Kürzel aus einer Rollen-Auswahl kippen (Pitfall #43)
 * - die Liste leer laufen lassen, solange niemand Relevanz gepflegt hat
 */
import { describe, it, expect } from 'vitest';
import { navigatorKandidaten, wirkungSaetze } from '@/core/status/navigator';
import { parseTriggerZeile } from '@/core/status/trigger-parser';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import type { Rolle, StatusFeldEintrag, TriggerZeile } from '@/core/status/typen';

const zeile = (kuerzel: string, folge: number, prozedur: string, parameter: string): TriggerZeile =>
  parseTriggerZeile({ kuerzel, folge, prozedur, parameter });

/** Trigger-Fixtures aus `todo-regeln-ab-seed.md` (Richtlinie 76). */
const TRIGGER: TriggerZeile[] = [
  zeile('AAE', 1, 'TRG_TVs_Status_TV_VB', '<59|ABB|YIRR|||||31|31'),
  zeile('AAE', 3, 'TRG.VorgEintragNeu', 'XAAE|210|0'),
  zeile('AAR', 1, 'TRG_TVs_Status_TV_VB', '<59|ABB|||||73|73'),
  zeile('AAR', 2, 'TRG.VorgEintragMail', 'TIB|!.055.VorgInfo.01|BIB'),
  zeile('ABA', 1, 'TRG.Status.TV.VB', '211|74'),
  zeile('ABLW', 1, 'TRG_TVs_Status_TV_VB', '<59|ABB|||||75|'),
];

const feld = (code: string, over: Partial<StatusFeldEintrag> = {}): StatusFeldEintrag => ({
  feldId: `D_${code}`,
  label: `Bezeichnung ${code}`,
  typ: 'datum',
  ebene: code.startsWith('X') ? 'verbund' : 'tv',
  herkunft: 'tv-record',
  code,
  kategorieId: 'tv.antragsbearbeitung',
  rollen: [],
  prominenzDefault: 'normal',
  aktiv: true,
  unkuratiert: false,
  ...over,
});

const FELDER: StatusFeldEintrag[] = [
  feld('AAE', { rollen: ['pa'] }),
  feld('AAR', { rollen: ['ab'] }),
  feld('ABA', { rollen: ['fb'] }),
  feld('ABLW'),                       // neutral: jeder darf setzen
  feld('ABB', { rollen: ['ab'] }),
  feld('YIRR'),
];

const vorkommen = (...codes: string[]): FeldVorkommen[] =>
  codes.map(c => ({ feld: feld(c), wert: '2026-06-01' }));

const lauf = (over: Partial<Parameters<typeof navigatorKandidaten>[0]> = {}): ReturnType<typeof navigatorKandidaten> =>
  navigatorKandidaten({
    trigger: TRIGGER, felder: FELDER, vorkommen: [], statusCode: 31, ...over,
  });

const kuerzelVon = (r: ReturnType<typeof navigatorKandidaten>): string[] =>
  r.kandidaten.map(k => k.kuerzel);

describe('navigatorKandidaten — Vorbedingungen', () => {
  it('lässt Kandidaten zu, deren Status-Bedingung erfüllt ist', () => {
    // Status 31 < 59 → alle vier Kürzel kommen in Frage.
    expect(kuerzelVon(lauf())).toEqual(expect.arrayContaining(['AAE', 'AAR', 'ABLW', 'ABA']));
  });

  it('verwirft, wenn die einzige Zeile eine verletzte Status-Bedingung hat', () => {
    // ABLW hat NUR die Zeile `<59` — bei Status 73 bleibt nichts übrig.
    const r = lauf({ statusCode: 73 });
    expect(kuerzelVon(r)).not.toContain('ABLW');
    expect(kuerzelVon(r)).toContain('ABA');   // unbedingt
    expect(r.verletzt).toBe(1);
  });

  it('verwirft ein Kürzel NICHT, solange eine andere seiner Zeilen feuern kann', () => {
    // AAE/1 (<59) ist bei Status 73 verletzt, AAE/3 (Vorgangseintrag) ist
    // unbedingt — das Kürzel bleibt, aber nur mit der übrigen Zeile.
    const r = lauf({ statusCode: 73 });
    const aae = r.kandidaten.find(k => k.kuerzel === 'AAE');
    expect(aae).toBeDefined();
    expect(aae?.wirkung.map(w => w.folge)).toEqual([3]);
  });

  it('wertet die Negativ-Bedingung gegen die gesetzten Spalten aus', () => {
    const r = lauf({ vorkommen: vorkommen('ABB') });
    // ABLW fällt ganz weg (nur die eine Zeile). AAE und AAR verlieren ihre
    // Status-Zeile, behalten aber die unbedingte — genau das soll die Anzeige
    // dann auch zeigen und nicht mehr.
    expect(kuerzelVon(r)).not.toContain('ABLW');
    expect(r.kandidaten.find(k => k.kuerzel === 'AAE')?.wirkung.map(w => w.folge)).toEqual([3]);
    expect(r.kandidaten.find(k => k.kuerzel === 'AAR')?.wirkung.map(w => w.folge)).toEqual([2]);
  });

  it('prüft die Verbund-Negativ-Bedingung (YIRR) ebenso', () => {
    const r = lauf({ vorkommen: vorkommen('YIRR') });
    // Nur AAE führt „kein TV des Verbunds hat YIRR" — dessen Status-Zeile fällt.
    expect(r.kandidaten.find(k => k.kuerzel === 'AAE')?.wirkung.map(w => w.folge)).toEqual([3]);
    expect(r.kandidaten.find(k => k.kuerzel === 'AAR')?.wirkung.map(w => w.folge)).toEqual([1, 2]);
  });
});

describe('navigatorKandidaten — Ehrlichkeit', () => {
  it('behält den Kandidaten bei unbekanntem Status und sagt, warum nicht geprüft', () => {
    const r = lauf({ statusCode: null });
    const aar = r.kandidaten.find(k => k.kuerzel === 'AAR');
    expect(aar?.unpruefbar).toBe(true);
    expect(aar?.wirkung[0]?.gruende.join(' ')).toContain('nicht im Katalog');
  });

  it('behält den Kandidaten, wenn das Bedingungs-Kürzel im Katalog fehlt', () => {
    const ohneAbb = FELDER.filter(f => f.code !== 'ABB');
    const r = lauf({ felder: ohneAbb });
    const aar = r.kandidaten.find(k => k.kuerzel === 'AAR');
    expect(aar?.unpruefbar).toBe(true);
    expect(aar?.wirkung[0]?.gruende.join(' ')).toContain('ABB');
  });

  it('führt undeutbare Zusatz-Argumente als nicht prüfbar mit', () => {
    const r = navigatorKandidaten({
      trigger: [zeile('AX', 1, 'TRG_TVs_Status_TV_VB', '<59|||WASAUCHIMMER||31|31')],
      felder: [feld('AX')], vorkommen: [], statusCode: 31,
    });
    expect(r.kandidaten[0]?.unpruefbar).toBe(true);
    expect(r.kandidaten[0]?.wirkung[0]?.gruende.join(' ')).toContain('WASAUCHIMMER');
  });

  it('zählt nicht interpretierte Zeilen, statt sie zu verschlucken', () => {
    const r = navigatorKandidaten({
      trigger: [...TRIGGER, zeile('AAE', 9, 'TRG.Unbekannt', 'irgendwas')],
      felder: FELDER, vorkommen: [], statusCode: 31,
    });
    expect(r.nichtInterpretiert).toBe(1);
    const aae = r.kandidaten.find(k => k.kuerzel === 'AAE');
    expect(aae?.wirkung.some(w => w.gruende.includes('Zeile nicht interpretiert.'))).toBe(true);
  });

  it('schließt bereits gesetzte Kürzel aus und zählt sie', () => {
    const r = lauf({ vorkommen: vorkommen('AAR') });
    expect(kuerzelVon(r)).not.toContain('AAR');
    expect(r.bereitsGesetzt).toBe(1);
  });

  it('markiert Kürzel, die der Katalog nicht kennt, als unbekannt', () => {
    const r = navigatorKandidaten({
      trigger: [zeile('ZZZ', 1, 'TRG.Status.TV.VB', '211|74')],
      felder: FELDER, vorkommen: [], statusCode: 31,
    });
    expect(r.kandidaten[0]?.unbekannt).toBe(true);
    expect(r.kandidaten[0]?.label).toBe('ZZZ');
    expect(r.kandidaten[0]?.rollenText).toBe('alle');
  });
});

describe('navigatorKandidaten — Relevanz und Rollen', () => {
  it('filtert NICHT, solange keine Fassung Relevanz markiert', () => {
    const r = lauf();
    expect(r.relevanzGefiltert).toBe(false);
    expect(r.kandidaten.length).toBeGreaterThan(1);
  });

  it('filtert auf die markierten Kürzel, sobald es welche gibt', () => {
    const felder = FELDER.map(f => (f.code === 'AAR' ? { ...f, relevant: true } : f));
    const r = lauf({ felder });
    expect(r.relevanzGefiltert).toBe(true);
    expect(kuerzelVon(r)).toEqual(['AAR']);
  });

  it('zeigt unter einer Rollenwahl auch die neutralen Kürzel (Pitfall #43)', () => {
    const r = lauf({ rolle: 'ab' as Rolle });
    expect(kuerzelVon(r)).toContain('AAR');    // Rolle AB
    expect(kuerzelVon(r)).toContain('ABLW');   // neutral
    expect(kuerzelVon(r)).not.toContain('ABA'); // Rolle FB
  });
});

describe('navigatorKandidaten — Anzeige-Ordnung und Zusatzangaben', () => {
  it('stellt Kandidaten, die den Status bewegen, nach vorn', () => {
    // ABA setzt Status unbedingt, AAE/3 legt bei Status 73 nur einen
    // Vorgangseintrag an — ABA muss davor stehen.
    const r = lauf({ statusCode: 73 });
    expect(r.kandidaten[0]?.kuerzel).toBe('ABA');
  });

  it('sammelt Mail-Platzhalter, ohne sie zu deuten', () => {
    const r = navigatorKandidaten({
      trigger: [zeile('AX', 1, 'TRG.VorgEintragMail', '#TB1|!.055.VorgInfo.01|#BA1')],
      felder: [feld('AX')], vorkommen: [], statusCode: 31,
    });
    expect(r.kandidaten[0]?.platzhalter).toEqual(['#TB1', '#BA1']);
  });

  it('lässt echte Empfänger unangetastet (kein Platzhalter)', () => {
    const r = lauf();
    const aar = r.kandidaten.find(k => k.kuerzel === 'AAR');
    expect(aar?.platzhalter).toEqual([]);
  });

  it('meldet, wie viele Kürzel überhaupt geprüft wurden', () => {
    expect(lauf().geprueft).toBe(4);
  });
});

describe('wirkungSaetze', () => {
  it('liefert die Sätze eines Kürzels in Folge-Reihenfolge', () => {
    expect(wirkungSaetze(TRIGGER, 'aar')).toEqual([
      'Wenn VB-Status vor 59, TV hat kein ABB → setze TV-Status 73 und VB-Status 73.',
      'Mail an TIB, Textbaustein VorgInfo.01, CC BIB.',
    ]);
  });

  it('liefert eine leere Liste für ein Kürzel ohne Trigger', () => {
    expect(wirkungSaetze(TRIGGER, 'XYZ')).toEqual([]);
  });
});
