import { describe, it, expect } from 'vitest';
import { berechneAuswege, teileAuswege, type AuswegLage, type Ausweg, type Probelauf } from '../auswege';

const LAGE: AuswegLage = {
  query: 'additive Fertigung Quantenkryptografie',
  verknuepfung: 'und',
  stammSuche: false,
  bereich: 'alles',
  aktiveFilter: [],
  richtlinien: null,
};

/** Probelauf, der nur für bestimmte Anfragen/Optionen etwas liefert. */
function probeFuer(
  regel: (q: string, o: Parameters<Probelauf>[1]) => number,
): Probelauf {
  return (q, o) => regel(q, o);
}

describe('berechneAuswege', () => {
  it('bietet NUR an, was tatsächlich Treffer bringt', () => {
    const probe = probeFuer(q => (q === 'additive Fertigung' ? 570 : 0));
    const auswege = berechneAuswege(LAGE, probe);
    expect(auswege).toHaveLength(1);
    expect(auswege[0]?.text).toContain('Quantenkryptografie');
    expect(auswege[0]?.treffer).toBe(570);
  });

  it('trägt die ECHTE Trefferzahl, nicht eine Schätzung', () => {
    const probe = probeFuer(q => (q === 'additive Fertigung' ? 42 : 0));
    expect(berechneAuswege(LAGE, probe)[0]?.treffer).toBe(42);
  });

  it('bietet ODER an, wenn das Lockern hilft', () => {
    const probe = probeFuer((_q, o) => (o.verknuepfung === 'oder' ? 963 : 0));
    const ids = berechneAuswege(LAGE, probe).map(a => a.id);
    expect(ids).toContain('oder');
  });

  it('bietet die Wortstämme an, wenn sie helfen', () => {
    const probe = probeFuer((_q, o) => (o.stammSuche ? 12 : 0));
    expect(berechneAuswege(LAGE, probe).map(a => a.id)).toContain('stamm');
  });

  it('bietet als ERSTES an, gesetzte Filter zu lösen', () => {
    const probe = probeFuer(() => 5);
    const auswege = berechneAuswege({ ...LAGE, aktiveFilter: ['Jahr: 2013'] }, probe);
    expect(auswege[0]?.id).toBe('filter');
    expect(auswege[0]?.text).toContain('Jahr: 2013');
  });

  it('fasst mehrere Filter zu einer Zahl zusammen', () => {
    const probe = probeFuer(() => 5);
    const auswege = berechneAuswege(
      { ...LAGE, aktiveFilter: ['Jahr: 2013', 'Status: Bewilligt'] }, probe,
    );
    expect(auswege[0]?.text).toContain('2 Filter');
  });

  it('bietet die Kombination erst an, wenn einzeln nichts hilft', () => {
    // Nur wenn ODER UND Stammsuche gemeinsam gesetzt sind, gibt es Treffer.
    const probe = probeFuer((_q, o) => (o.verknuepfung === 'oder' && o.stammSuche ? 7 : 0));
    const auswege = berechneAuswege(LAGE, probe);
    expect(auswege).toHaveLength(1);
    expect(auswege[0]?.id).toBe('kombiniert');
    expect(auswege[0]?.treffer).toBe(7);
  });

  it('sagt nichts zu, wenn wirklich nichts hilft', () => {
    expect(berechneAuswege(LAGE, () => 0)).toEqual([]);
  });

  it('schlägt bei EINEM Wort kein Weglassen vor', () => {
    const probe = probeFuer(() => 3);
    const auswege = berechneAuswege({ ...LAGE, query: 'Quantenkryptografie' }, probe);
    expect(auswege.some(a => a.id.startsWith('ohne:'))).toBe(false);
  });

  it('bietet bei genauer Wortfolge das Lockern an', () => {
    const probe = probeFuer((_q, o) => (o.verknuepfung === 'und' ? 4 : 0));
    const auswege = berechneAuswege({ ...LAGE, verknuepfung: 'wortfolge' }, probe);
    expect(auswege.map(a => a.id)).toContain('und');
  });

  it('bietet an, den Suchbereich zu öffnen', () => {
    const probe = probeFuer((_q, o) => (o.bereich === 'alles' ? 9 : 0));
    const auswege = berechneAuswege({ ...LAGE, bereich: 'inhalt' }, probe);
    expect(auswege.map(a => a.id)).toContain('bereich');
  });

  it('überflutet nicht — höchstens eine Handvoll Vorschläge', () => {
    const probe = probeFuer(() => 1);
    expect(berechneAuswege(
      { ...LAGE, aktiveFilter: ['a', 'b'], bereich: 'inhalt', verknuepfung: 'wortfolge' }, probe,
    ).length).toBeLessThanOrEqual(4);
  });
});

describe('berechneAuswege — Richtlinien', () => {
  it('bietet das Öffnen an, sobald eine Einschränkung gilt', () => {
    const eng = new Set(['136']);
    const probe = probeFuer((_q, o) => (o.richtlinien === null ? 88 : 0));
    const auswege = berechneAuswege({ ...LAGE, richtlinien: eng }, probe);
    expect(auswege.map(a => a.id)).toContain('richtlinien');
    expect(auswege.find(a => a.id === 'richtlinien')?.treffer).toBe(88);
  });

  it('schweigt, wenn ohnehin alle Richtlinien gelten', () => {
    const probe = probeFuer(() => 5);
    expect(berechneAuswege(LAGE, probe).map(a => a.id)).not.toContain('richtlinien');
  });

  it('reicht die geltende Einschränkung an JEDEN Probelauf durch — sonst verspricht ein anderer Ausweg zu viel', () => {
    const eng = new Set(['136']);
    const gesehen: Array<ReadonlySet<string> | null> = [];
    berechneAuswege({ ...LAGE, richtlinien: eng }, (_q, o) => { gesehen.push(o.richtlinien); return 0; });
    // Jeder ANDERE Ausweg rechnet mit der Einschränkung — sonst verspräche
    // „Wort weglassen" eine Zahl, die nach dem Klick nicht eintritt.
    expect(gesehen.some(r => r === eng)).toBe(true);
    expect(gesehen.some(r => r === null)).toBe(true);
  });
});

describe('teileAuswege — welcher Ausweg über der Liste steht', () => {
  const ausweg = (id: string, aenderung: Ausweg['aenderung']): Ausweg =>
    ({ id, text: id, aenderung, treffer: 29 });

  it('hebt das Öffnen der Richtlinien heraus, die übrigen bleiben in der Liste', () => {
    const oeffnen = ausweg('richtlinien', { richtlinienOeffnen: true });
    const wort = ausweg('ohne:laser', { query: 'nafatech' });
    const { versteckt, rest } = teileAuswege([wort, oeffnen]);
    expect(versteckt).toBe(oeffnen);
    expect(rest).toEqual([wort]);
  });

  it('ohne Richtlinien-Ausweg bleibt die Liste unangetastet', () => {
    const a = ausweg('stamm', { stammSuche: true });
    const b = ausweg('bereich', { bereich: 'alles' });
    const { versteckt, rest } = teileAuswege([a, b]);
    expect(versteckt).toBeNull();
    expect(rest).toEqual([a, b]);
  });

  // Der Knopf im Kasten heißt „Alle Richtlinien einbeziehen". Der
  // zusammengelegte Ausweg leert zusätzlich Filter und lockert Regler — unter
  // dieser Beschriftung wäre er eine Wirkung, die ihren Namen verschweigt.
  it('hebt den zusammengelegten Ausweg NICHT heraus, obwohl er die Richtlinien mit öffnet', () => {
    const kombiniert = ausweg('kombiniert', {
      richtlinienOeffnen: true, filterLeeren: true, verknuepfung: 'oder',
    });
    const { versteckt, rest } = teileAuswege([kombiniert]);
    expect(versteckt).toBeNull();
    expect(rest).toEqual([kombiniert]);
  });
});
