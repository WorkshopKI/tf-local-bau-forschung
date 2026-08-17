/**
 * Der Verfahrensschnitt reist allein (v4.79) — die Zusagen des Phasen-Pakets.
 *
 * Der Anlass ist ein realer Schaden: auf einem veraltet geladenen Katalog wurden
 * Kürzel gepflegt und veröffentlicht, der zuvor gepflegte Schnitt fiel damit
 * zurück. Deshalb steht hier ein Test im Mittelpunkt, der nichts über Phasen
 * sagt — **„Kürzel bleiben unberührt"**. Alles andere ist Mechanik; das ist der
 * Zweck.
 *
 * Fünf Zusagen:
 *
 * 1. Was ausgebaut wurde, kommt am Zielort wieder an (Rundlauf, auch über JSON).
 * 2. Die Übernahme fasst NUR die Phasen-Achse an.
 * 3. Sie mischt: was das Paket nicht nennt, bleibt; was das Ziel nicht kennt,
 *    wird gemeldet statt angelegt.
 * 4. Steht etwas im Weg, passiert **nichts** — kein halb übernommener Schnitt.
 * 5. Voll-Export und Paket werden auseinandergehalten, in beide Richtungen.
 */
import { describe, it, expect } from 'vitest';
import {
  bauePhasenPaket, exportierePhasenPaket, uebernimmPhasen,
  validierePhasenPaket, istPhasenPaket, PHASEN_PAKET_ART,
} from '@/core/status/phasen-paket';
import { exportiereVersion, validiereImport } from '@/core/status/export-import';
import { MAX_PHASEN } from '@/core/status/zah-phasen-edit';
import type {
  MappingVersion, PhasenPaket, StatusFeldEintrag, StatusWertEintrag, ZahPhase,
} from '@/core/status';

// --- Bausteine --------------------------------------------------------------

const phase = (id: string, label: string, reihenfolge: number): ZahPhase => ({
  id, label, reihenfolge, zieltageRelevant: false, kategorieVorgabe: 'offen', fristLaeuft: true,
});

const wert = (p: Partial<StatusWertEintrag> & { id: string }): StatusWertEintrag => ({
  feldId: 'status', wert: p.id, kategorie: 'offen', prominenz: 'normal',
  aktiv: true, unkuratiert: false, ...p,
});

const feld = (p: Partial<StatusFeldEintrag> & { feldId: string }): StatusFeldEintrag => ({
  label: p.feldId, typ: 'datum', ebene: 'tv',
  prominenzDefault: 'normal', aktiv: true, unkuratiert: false,
  ...p,
} as StatusFeldEintrag);

const version = (p: Partial<MappingVersion> = {}): MappingVersion => ({
  version: 1, autor: null, zeitstempel: '2026-01-01T00:00:00.000Z', felder: [], werte: [], ...p,
});

/**
 * **Quelle** — der gepflegte Schnitt, den es zu retten gilt. Drei Phasen; Code 11
 * steht wie im echten Katalog zweimal (`status` UND `verbund_status`), 29 ist
 * Marker, 50 trägt einen Zieltag, 81 kennt nur diese Fassung.
 */
const quelle = (): MappingVersion => version({
  version: 12,
  autor: 'PL',
  zahPhasen: [phase('eingang', 'Eingang', 10), phase('pruefung', 'In Prüfung', 20), phase('ende', 'Abgeschlossen', 30)],
  werte: [
    wert({ id: 'status::11', code: 11, zahPhaseId: 'eingang' }),
    wert({ id: 'verbund_status::11', feldId: 'verbund_status', code: 11, zahPhaseId: 'eingang' }),
    wert({ id: 'status::29', code: 29, zahPhaseId: null, marker: true }),
    wert({ id: 'status::50', code: 50, zahPhaseId: 'pruefung', zieltage: 14 }),
    wert({ id: 'status::81', code: 81, zahPhaseId: 'ende' }),
    wert({ id: 'status::ohne-code' }),
  ],
  felder: [
    feld({ feldId: 'D_XTEC', zahPhaseId: 'pruefung' }),
    feld({ feldId: 'D_AAI' }),
  ],
});

/**
 * **Ziel** — der live geltende Stand: richtige Kürzel, zurückgefallener Schnitt.
 * Vier Phasen mit anderen Kennungen, Code 77 kennt nur diese Fassung, kein 81.
 */
const ziel = (): MappingVersion => version({
  version: 30,
  autor: 'AB',
  zahPhasen: [
    phase('alt-a', 'Alt A', 10), phase('alt-b', 'Alt B', 20),
    phase('alt-c', 'Alt C', 30), phase('alt-d', 'Alt D', 40),
  ],
  werte: [
    wert({ id: 'status::11', code: 11, zahPhaseId: 'alt-a' }),
    wert({ id: 'verbund_status::11', feldId: 'verbund_status', code: 11, zahPhaseId: 'alt-a' }),
    wert({ id: 'status::29', code: 29, zahPhaseId: 'alt-b', marker: false }),
    wert({ id: 'status::50', code: 50, zahPhaseId: 'alt-b', zieltage: 7 }),
    wert({ id: 'status::77', code: 77, zahPhaseId: 'alt-c', zieltage: 21 }),
  ],
  felder: [
    // Genau die Arbeit, die NICHT verloren gehen darf.
    feld({
      feldId: 'D_XTEC', label: 'Technische Prüfung abgeschlossen', zahPhaseId: 'alt-d',
      rollen: ['ab', 'qs'], kategorieId: 'pruefung', relevant: true, code: 'XTEC',
      textSpalte: 'T_XTEC',
    }),
    feld({ feldId: 'D_AAI', label: 'Antrag angelegt', rollen: ['ab'], kategorieId: 'eingang' }),
  ],
});

/** Alles am Kürzel AUSSER der Phase — die Achse, die das Paket anfassen darf. */
const ohnePhase = (f: StatusFeldEintrag): Omit<StatusFeldEintrag, 'zahPhaseId'> => {
  const { zahPhaseId: _weg, ...rest } = f;
  return rest;
};

// --- 1. Rundlauf ------------------------------------------------------------

describe('Der Schnitt kommt am Zielort an', () => {
  it('trägt Phasenliste, Zuordnungen und Zieltage der Quelle in das Ziel', () => {
    const { version: neu, bericht } = uebernimmPhasen(ziel(), bauePhasenPaket(quelle()));

    expect(neu.zahPhasen?.map(p => p.id)).toEqual(['eingang', 'pruefung', 'ende']);
    expect(neu.zahPhasen?.map(p => p.label)).toEqual(['Eingang', 'In Prüfung', 'Abgeschlossen']);
    expect(neu.werte.find(w => w.id === 'status::11')?.zahPhaseId).toBe('eingang');
    expect(neu.werte.find(w => w.id === 'status::50')?.zahPhaseId).toBe('pruefung');
    expect(neu.werte.find(w => w.id === 'status::50')?.zieltage).toBe(14);
    expect(neu.felder.find(f => f.feldId === 'D_XTEC')?.zahPhaseId).toBe('pruefung');
    expect(bericht.fehler).toEqual([]);
    expect(bericht).toMatchObject({ phasen: 3, codes: 3, felder: 1, zieltage: 1 });
  });

  it('überlebt den Weg durch die Datei', () => {
    const gelesen = validierePhasenPaket(JSON.parse(exportierePhasenPaket(quelle())));
    expect(gelesen.ok).toBe(true);
    expect(gelesen.paket).toEqual(bauePhasenPaket(quelle()));
  });

  it('nennt seine Herkunft, damit die Rückmeldung sie zeigen kann', () => {
    expect(bauePhasenPaket(quelle()).herkunft)
      .toEqual({ fassung: 12, autor: 'PL', zeitstempel: '2026-01-01T00:00:00.000Z' });
  });

  it('führt jeden Code EINMAL, setzt ihn aber auf allen seinen Zeilen', () => {
    const paket = bauePhasenPaket(quelle());
    expect(paket.codePhasen.filter(z => z.code === 11)).toHaveLength(1);

    const { version: neu } = uebernimmPhasen(ziel(), paket);
    expect(neu.werte.filter(w => w.code === 11).map(w => w.zahPhaseId))
      .toEqual(['eingang', 'eingang']);
  });

  it('hält `marker` mit der Marker-Gruppe synchron', () => {
    const { version: neu } = uebernimmPhasen(ziel(), bauePhasenPaket(quelle()));
    const m = neu.werte.find(w => w.code === 29)!;
    expect(m.zahPhaseId).toBeNull();
    expect(m.marker).toBe(true);
  });

  it('nimmt einen Wert ohne Entscheidung (`undefined`) nicht mit — eine offene '
    + 'Frage darf am Zielort keine Antwort werden', () => {
    const q = quelle();
    q.werte.push(wert({ id: 'status::90', code: 90 }));
    expect(bauePhasenPaket(q).codePhasen.some(z => z.code === 90)).toBe(false);
  });
});

// --- 2. Der eigentliche Zweck ----------------------------------------------

describe('Die Kürzel bleiben unberührt', () => {
  it('ändert an einem Kürzel ausschließlich die Phase', () => {
    const vorher = ziel();
    const { version: neu } = uebernimmPhasen(vorher, bauePhasenPaket(quelle()));

    expect(neu.felder.map(ohnePhase)).toEqual(vorher.felder.map(ohnePhase));
    // Und die Phase hat sich sehr wohl geändert — sonst prüfte der Satz oben nichts.
    expect(neu.felder.find(f => f.feldId === 'D_XTEC')?.zahPhaseId)
      .not.toBe(vorher.felder.find(f => f.feldId === 'D_XTEC')?.zahPhaseId);
  });

  it('lässt ein Kürzel, das das Paket nicht nennt, vollständig in Ruhe', () => {
    const vorher = ziel();
    const { version: neu } = uebernimmPhasen(vorher, bauePhasenPaket(quelle()));
    expect(neu.felder.find(f => f.feldId === 'D_AAI'))
      .toEqual(vorher.felder.find(f => f.feldId === 'D_AAI'));
  });

  it('rührt Kategorien, To-do-Regeln und Textbausteine nicht an', () => {
    const vorher = version({
      ...ziel(),
      kategorien: [{
        id: 'k1', label: 'Prüfung', ebene: 'tv', elternId: null, reihenfolge: 10, aktiv: true,
      }],
      todoRegeln: [],
      betrachtungsbereich: { programme: ['4711'] },
    });
    const { version: neu } = uebernimmPhasen(vorher, bauePhasenPaket(quelle()));
    expect(neu.kategorien).toBe(vorher.kategorien);
    expect(neu.todoRegeln).toBe(vorher.todoRegeln);
    expect(neu.betrachtungsbereich).toBe(vorher.betrachtungsbereich);
  });
});

// --- 3. Mischen, nicht überrollen ------------------------------------------

describe('Die Übernahme mischt', () => {
  it('lässt einen Code, den das Paket nicht nennt, wie er ist', () => {
    const vorher = ziel();
    const { version: neu } = uebernimmPhasen(vorher, bauePhasenPaket(quelle()));
    expect(neu.werte.find(w => w.code === 77)).toEqual(vorher.werte.find(w => w.code === 77));
  });

  it('meldet fremde Codes und Kürzel, statt sie anzulegen', () => {
    const paket = bauePhasenPaket(quelle());
    const { version: neu, bericht } = uebernimmPhasen(ziel(), paket);
    expect(bericht.unbekannteCodes).toEqual([81]);
    expect(bericht.unbekannteFelder).toEqual([]);
    expect(neu.werte.some(w => w.code === 81)).toBe(false);
    expect(neu.werte).toHaveLength(ziel().werte.length);
  });

  it('meldet ein Kürzel, das nur die Quelle führt', () => {
    const paket = bauePhasenPaket(quelle());
    paket.feldPhasen.push({ feldId: 'D_NEU', phaseId: 'ende' });
    const { version: neu, bericht } = uebernimmPhasen(ziel(), paket);
    expect(bericht.unbekannteFelder).toEqual(['D_NEU']);
    expect(neu.felder).toHaveLength(2);
  });

  it('zählt Änderungen, nicht Fundstellen', () => {
    // Dasselbe Paket zweimal: der zweite Lauf ändert nichts mehr.
    const paket = bauePhasenPaket(quelle());
    const einmal = uebernimmPhasen(ziel(), paket);
    const zweimal = uebernimmPhasen(einmal.version, paket);
    expect(zweimal.bericht).toMatchObject({ codes: 0, felder: 0, zieltage: 0 });
  });
});

// --- 4. Alles oder nichts ---------------------------------------------------

describe('Steht etwas im Weg, passiert nichts', () => {
  const mitPhasen = (phasen: ZahPhase[]): PhasenPaket => ({
    ...bauePhasenPaket(quelle()), phasen,
  });

  it('weist einen Schnitt unter der Untergrenze ab — unverändert, nicht nur gleich', () => {
    const vorher = ziel();
    const { version: neu, bericht } = uebernimmPhasen(vorher, mitPhasen([phase('a', 'A', 10), phase('b', 'B', 20)]));
    expect(neu).toBe(vorher);
    expect(bericht.fehler.some(f => f.includes('mindestens'))).toBe(true);
  });

  it('weist einen Schnitt über der Obergrenze ab', () => {
    const zuViele = Array.from({ length: MAX_PHASEN + 1 }, (_, i) => phase(`p${i}`, `P${i}`, (i + 1) * 10));
    const vorher = ziel();
    const { version: neu, bericht } = uebernimmPhasen(vorher, mitPhasen(zuViele));
    expect(neu).toBe(vorher);
    expect(bericht.fehler[0]).toContain('Höchstens');
  });

  it('weist eine Zuordnung ins Leere ab, statt sie verwaisen zu lassen', () => {
    const paket = bauePhasenPaket(quelle());
    paket.codePhasen.push({ code: 11, phaseId: 'gibt-es-nicht' });
    const vorher = ziel();
    const { version: neu, bericht } = uebernimmPhasen(vorher, paket);
    expect(neu).toBe(vorher);
    expect(bericht.fehler[0]).toContain('gibt-es-nicht');
  });

  it('meldet bei Abbruch keine Änderungszahlen', () => {
    const { bericht } = uebernimmPhasen(ziel(), mitPhasen([phase('a', 'A', 10)]));
    expect(bericht).toMatchObject({ phasen: 0, codes: 0, felder: 0, zieltage: 0 });
  });
});

// --- 5. Die Formatweiche ----------------------------------------------------

describe('Paket und Voll-Katalog werden auseinandergehalten', () => {
  it('erkennt das Paket an seiner Marke', () => {
    expect(istPhasenPaket(bauePhasenPaket(quelle()))).toBe(true);
    expect(istPhasenPaket(quelle())).toBe(false);
    expect(istPhasenPaket(null)).toBe(false);
    expect(bauePhasenPaket(quelle()).art).toBe(PHASEN_PAKET_ART);
  });

  it('`validierePhasenPaket` weist einen Voll-Katalog ab', () => {
    expect(validierePhasenPaket(quelle())).toEqual({ ok: false, fehler: 'Kein Phasen-Paket.' });
  });

  it('`validiereImport` weist ein Phasen-Paket mit einem brauchbaren Satz ab', () => {
    const ergebnis = validiereImport(exportierePhasenPaket(quelle()));
    expect(ergebnis.ok).toBe(false);
    expect(ergebnis.fehler).toContain('Phasen-Paket');
  });

  it('lässt den Voll-Katalog weiterhin durch — die Weiche kostet nichts', () => {
    // Ein in sich stimmiger Katalog (jeder Wert an einem bekannten Feld) —
    // `validiereImport` prüft mehr als die Form, und das soll so bleiben.
    const voll = version({
      felder: [feld({ feldId: 'status', typ: 'wert' })],
      werte: [wert({ id: 'status::11', code: 11 })],
    });
    expect(validiereImport(exportiereVersion(voll)).ok).toBe(true);
  });

  it('lehnt ein Paket mit unbekanntem Format ab', () => {
    const fremd = { ...bauePhasenPaket(quelle()), version: 99 };
    expect(validierePhasenPaket(fremd).ok).toBe(false);
    expect(validierePhasenPaket(fremd).fehler).toContain('Format');
  });

  it('lehnt kaputte Einträge ab, statt sie halb zu lesen', () => {
    const paket = bauePhasenPaket(quelle());
    expect(validierePhasenPaket({ ...paket, phasen: [{ id: 'a' }] }).ok).toBe(false);
    expect(validierePhasenPaket({ ...paket, codePhasen: [{ code: '11', phaseId: 'a' }] }).ok).toBe(false);
    expect(validierePhasenPaket({ ...paket, zieltage: [{ code: 11, tage: 'viele' }] }).ok).toBe(false);
    expect(validierePhasenPaket({ ...paket, herkunft: undefined }).ok).toBe(false);
  });
});
