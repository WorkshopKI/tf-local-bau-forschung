import { describe, expect, it } from 'vitest';
import {
  applyAkronymDedup,
  assembleFixture,
  buildStammdatenCsv,
  dedupeAkronym,
  mintFkz,
} from '../fixture-build';
import { extractHeuristisch, type ExtractedContent } from '../extract';
import { sha1Hex } from '../sha1';

const FKZ_RE = /^(16EP|16KN)\d{6}$/;

function ex(
  partnerNames: string[],
  titel: string | null = 'Beispiel-Vorhaben',
  akronym = 'BSP',
): ExtractedContent {
  return { titel, akronym, partner: partnerNames.map(name => ({ name, teilTitel: null })) };
}

describe('sha1Hex', () => {
  it('matcht die bekannten Test-Vektoren (sichert die Pure-Implementierung)', () => {
    expect(sha1Hex('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(sha1Hex('')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
  });
});

describe('mintFkz / assembleFixture — FKZ-Format', () => {
  it('(a) jedes knownIds-Element matcht das strikte FKZ-Format', () => {
    const ep = assembleFixture('ep.md', 'vb', ex(['Muster Technologie GmbH']), 'auto');
    const kn = assembleFixture('kn.md', 'vb', ex(['Lead AG', 'Partner GmbH', 'Dritt UG']), 'auto');
    for (const id of [...ep.context.knownIds, ...kn.context.knownIds]) {
      expect(id).toMatch(FKZ_RE);
    }
    // auch die TV-Aktenzeichen
    for (const tv of kn.context.teilvorhaben) {
      expect(tv.aktenzeichen).toMatch(FKZ_RE);
    }
  });

  it('mintFkz erzeugt immer Präfix + genau 6 Ziffern', () => {
    expect(mintFkz('16EP', 'a.md')).toMatch(FKZ_RE);
    expect(mintFkz('16KN', 'a.md', 7)).toMatch(FKZ_RE);
  });
});

describe('assembleFixture — EP/KN-Logik', () => {
  it('(b) 1 Partner → EP, keine Teilvorhaben', () => {
    const fx = assembleFixture('solo.md', 'vb', ex(['Einzel GmbH']), 'auto');
    expect(fx.antragstyp).toBe('EP');
    expect(fx.context.teilvorhaben).toHaveLength(0);
    expect(fx.context.knownIds).toEqual([fx.context.foerderkennzeichen]);
    expect(fx.context.antragsteller).toBe('Einzel GmbH');
    expect(fx.context.foerderkennzeichen.startsWith('16EP')).toBe(true);
  });

  it('(b) ≥2 Partner → KN mit korrekter TV-Anzahl + 1-basierter nr', () => {
    const fx = assembleFixture('verbund.md', 'vb', ex(['Lead AG', 'Partner GmbH', 'Dritt UG']), 'auto');
    expect(fx.antragstyp).toBe('KN');
    expect(fx.context.teilvorhaben).toHaveLength(3);
    fx.context.teilvorhaben.forEach((tv, i) => {
      expect(tv.nr).toBe(i + 1);
      expect(tv.antragsteller).toBe(['Lead AG', 'Partner GmbH', 'Dritt UG'][i]);
    });
    expect(fx.context.antragsteller).toBe('Lead AG'); // Konsortialführer = partner[0]
    expect(fx.context.foerderkennzeichen.startsWith('16KN')).toBe(true);
    expect(fx.context.knownIds[0]).toBe(fx.context.foerderkennzeichen);
    expect(fx.context.knownIds).toHaveLength(4); // Verbund + 3 TV
  });

  it('--typ erzwingt EP/KN unabhängig von der Partner-Anzahl', () => {
    const forcedKn = assembleFixture('x.md', 'vb', ex(['Nur Eine GmbH']), 'kn');
    expect(forcedKn.antragstyp).toBe('KN');
    expect(forcedKn.context.teilvorhaben).toHaveLength(1);

    const forcedEp = assembleFixture('x.md', 'vb', ex(['A AG', 'B GmbH']), 'ep');
    expect(forcedEp.antragstyp).toBe('EP');
    expect(forcedEp.context.teilvorhaben).toHaveLength(0);
  });
});

describe('Stabilität', () => {
  it('(c) zweimaliger Lauf mit gleichem Dateinamen → byte-identische FKZ', () => {
    const a = assembleFixture('gleich.md', 'vb1', ex(['A AG', 'B GmbH']), 'auto');
    const b = assembleFixture('gleich.md', 'vb2-anders', ex(['A AG', 'B GmbH']), 'auto');
    expect(b.context.foerderkennzeichen).toBe(a.context.foerderkennzeichen);
    expect(b.context.knownIds).toEqual(a.context.knownIds);
  });
});

describe('dedupeAkronym', () => {
  it('(d) Kollision → -2/-3, Cap auf ≤14 Zeichen', () => {
    const used = new Set<string>();
    expect(dedupeAkronym('SOL', used)).toBe('SOL');
    expect(dedupeAkronym('SOL', used)).toBe('SOL-2');
    expect(dedupeAkronym('SOL', used)).toBe('SOL-3');

    const long = 'ABCDEFGHIJKLMNOPQRST'; // 20 Zeichen
    const first = dedupeAkronym(long, used);
    expect(first).toBe('ABCDEFGHIJKLMN'); // auf 14 gekappt
    const second = dedupeAkronym(long, used);
    expect(second.length).toBeLessThanOrEqual(14);
    expect(second.endsWith('-2')).toBe(true);
  });

  it('applyAkronymDedup verteilt kollidierende Akronyme über alle Fixtures', () => {
    const fixtures = [
      assembleFixture('a.md', 'vb', ex(['A GmbH'], 'Titel', 'DUP'), 'ep'),
      assembleFixture('b.md', 'vb', ex(['B GmbH'], 'Titel', 'DUP'), 'ep'),
    ];
    const out = applyAkronymDedup(fixtures);
    expect(out[0]?.context.akronym).toBe('DUP');
    expect(out[1]?.context.akronym).toBe('DUP-2');
  });
});

describe('buildStammdatenCsv', () => {
  it('(e) quotet Titel mit Semikolon, doppelten Anführungszeichen und Newline', () => {
    const semikolon = assembleFixture('s.md', 'vb', ex(['X GmbH'], 'Titel; mit Semikolon'), 'ep');
    expect(buildStammdatenCsv([semikolon])).toContain('"Titel; mit Semikolon"');

    const quote = assembleFixture('q.md', 'vb', ex(['X GmbH'], 'Sag "Hallo"'), 'ep');
    expect(buildStammdatenCsv([quote])).toContain('"Sag ""Hallo"""');

    const newline = assembleFixture('n.md', 'vb', ex(['X GmbH'], 'Zeile1\nZeile2'), 'ep');
    expect(buildStammdatenCsv([newline])).toContain('"Zeile1\nZeile2"');
  });

  it('schreibt Header + eine Zeile pro Fixture mit anzahl_tv', () => {
    const ep = assembleFixture('ep.md', 'vb', ex(['Solo GmbH']), 'ep');
    const kn = assembleFixture('kn.md', 'vb', ex(['Lead AG', 'Partner GmbH']), 'kn');
    const csv = buildStammdatenCsv([ep, kn]);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('vb_datei;antragstyp;aktenzeichen;akronym;titel;antragsteller;anzahl_tv');
    expect(lines).toHaveLength(3); // Header + 2
    expect(lines[1]?.endsWith(';0')).toBe(true); // EP → 0 TV
    expect(lines[2]?.endsWith(';2')).toBe(true); // KN → 2 TV
  });
});

describe('extractHeuristisch', () => {
  it('(g) VB mit GmbH → Partner gefunden, Titel aus erster Zeile', () => {
    const vb = '# Smarte Sensorik SENSOR\n\nDie Muster Technologie GmbH entwickelt ...';
    const res = extractHeuristisch(vb, 'sensor.md');
    expect(res.titel).toBe('Smarte Sensorik SENSOR');
    expect(res.partner.map(p => p.name)).toContain('Muster Technologie GmbH');
    expect(res.akronym).toBe('SENSOR'); // längstes ALLCAPS-Token
  });

  it('(g) Verbund-Text: dieselbe Org über Satzgrenzen hinweg wird dedupliziert, keine Satz-Fragmente', () => {
    const vb = [
      '# Vernetzte Sensorik GRIDSENSE',
      '',
      'Im Verbund entwickeln die Nordlicht Energie AG und die Messtechnik Partner GmbH',
      'gemeinsam eine Sensorplattform. Die Nordlicht Energie AG ist Konsortialführer.',
    ].join('\n');
    const res = extractHeuristisch(vb, 'verbund.md');
    expect(res.partner.map(p => p.name)).toEqual(['Nordlicht Energie AG', 'Messtechnik Partner GmbH']);
  });

  it('(g) VB ohne Org → genau ein stabiles Fiktiv-Institut, deterministisch', () => {
    const vb = 'Ein Vorhaben ganz ohne genannte Organisation.';
    const a = extractHeuristisch(vb, 'ohne.md');
    const b = extractHeuristisch(vb, 'ohne.md');
    expect(a.partner).toHaveLength(1);
    expect(a.partner[0]?.name.startsWith('Institut ')).toBe(true);
    expect(b).toEqual(a); // deterministisch über zwei Aufrufe
  });
});
