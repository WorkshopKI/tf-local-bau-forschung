import { describe, it, expect } from 'vitest';
import {
  aendereKategorie, entdoppleKanonischeCodes, entferneKategorie, ergaenzeSeedFelder,
  ergaenzeVorgangssystemSeed, fuegeFeldHinzu, fuegeKategorieHinzu, kanonischeCodeDoppel,
  markiereRelevanz, relevanzLuecke, seedTextAbweichungen, uebernimmSeedTexte,
} from '@/core/status/katalog-edit';
import {
  baueSeedVersion, baueSeedCodeFelderOhneKanonische, KANONISCHE_CODE_FELDER,
} from '@/core/status/seed';
import { SEED_KATEGORIEN as SEED_KATEGORIEN_ECHT } from '@/core/status/seed-kategorien';
import type { MappingVersion, StatusFeldEintrag, StatusKategorie } from '@/core/status/typen';

/** Synthetische Ids mit `zz.`-Präfix: der ausgelieferte Seed führt inzwischen
 *  selbst einen vollständigen Baum, mit dem hier nichts kollidieren darf. */
function kat(id: string, elternId: string | null, label: string): StatusKategorie {
  return { id, elternId, label, ebene: 'tv', reihenfolge: 10, aktiv: true };
}

/** Basis ohne Baum und ohne Code-Felder — der Zuschnitt, den eine Fassung aus
 *  der Zeit vor dem Code-Inventar hat. */
function altfassung(): MappingVersion {
  const v = baueSeedVersion();
  return {
    ...v,
    kategorien: [],
    felder: v.felder.filter(f => f.code === undefined),
  };
}

function feld(feldId: string, kategorieId?: string): StatusFeldEintrag {
  return {
    feldId,
    label: feldId,
    typ: 'datum',
    ebene: 'tv',
    prominenzDefault: 'normal',
    aktiv: true,
    unkuratiert: false,
    ...(kategorieId ? { kategorieId } : {}),
  };
}

const SEED_KATEGORIEN: StatusKategorie[] = [kat('zz.ab', null, 'Antragsbearbeitung')];
const SEED_FELDER: StatusFeldEintrag[] = [feld('D_ZZ1', 'zz.ab'), feld('D_ZZ2', 'zz.ab')];

describe('katalog-edit — Kategoriebaum', () => {
  it('fügt eine Kategorie hinzu, doppelte Ids prallen ab', () => {
    const basis = altfassung();
    const v = fuegeKategorieHinzu(basis, kat('zz.ab', null, 'Antragsbearbeitung'));
    const nochmal = fuegeKategorieHinzu(v, kat('zz.ab', null, 'Anderer Name'));
    expect(nochmal.kategorien).toHaveLength(1);
    expect(nochmal.kategorien?.[0]?.label).toBe('Antragsbearbeitung');
  });

  it('verwirft ein Umhängen, das einen Ringschluss erzeugen würde — der Rest des Patches greift', () => {
    let v = altfassung();
    for (const k of [kat('zz.a', null, 'A'), kat('zz.b', 'zz.a', 'B')]) v = fuegeKategorieHinzu(v, k);
    const nachher = aendereKategorie(v, 'zz.a', { elternId: 'zz.b', label: 'A neu' });
    expect(nachher.kategorien?.find(k => k.id === 'zz.a')?.elternId).toBeNull();
    expect(nachher.kategorien?.find(k => k.id === 'zz.a')?.label).toBe('A neu');
  });

  it('lässt beim Entfernen keine toten Verweise zurück', () => {
    let v = altfassung();
    for (const k of [kat('zz.a', null, 'A'), kat('zz.b', 'zz.a', 'B')]) v = fuegeKategorieHinzu(v, k);
    v = fuegeFeldHinzu(v, feld('D_ZZTEST', 'zz.a'));

    const nachher = entferneKategorie(v, 'zz.a');
    // Kind rückt an den Elternknoten nach (hier: Wurzel)
    expect(nachher.kategorien?.find(k => k.id === 'zz.b')?.elternId).toBeNull();
    // Feld verliert die Zuordnung, bleibt aber erhalten
    const f = nachher.felder.find(x => x.feldId === 'D_ZZTEST');
    expect(f).toBeDefined();
    expect(f?.kategorieId).toBeUndefined();
  });
});

describe('ergaenzeSeedFelder', () => {
  it('fügt fehlende Kategorien und Felder an', () => {
    const r = ergaenzeSeedFelder(altfassung(), SEED_FELDER, SEED_KATEGORIEN);
    expect(r.neueKategorien).toBe(1);
    expect(r.neueFelder).toBe(2);
    expect(r.version.felder.map(f => f.feldId)).toContain('D_ZZ1');
  });

  it('holt eine Altfassung auf den Auslieferungsstand', () => {
    const alt = altfassung();
    const r = ergaenzeSeedFelder(alt, baueSeedVersion().felder, SEED_KATEGORIEN_ECHT);
    expect(r.neueFelder).toBeGreaterThan(150);
    expect(r.version.felder.map(f => f.code)).toContain('XTEC');
  });

  it('ist idempotent — der zweite Lauf ändert nichts', () => {
    const erst = ergaenzeSeedFelder(altfassung(), SEED_FELDER, SEED_KATEGORIEN);
    const zweit = ergaenzeSeedFelder(erst.version, SEED_FELDER, SEED_KATEGORIEN);
    expect(zweit.neueFelder).toBe(0);
    expect(zweit.neueKategorien).toBe(0);
    // Gleiche Objektreferenz: nichts zu tun heißt nichts anfassen.
    expect(zweit.version).toBe(erst.version);
  });

  it('lässt kuratierte Einträge unangetastet, auch wenn der Seed sie anders sieht', () => {
    const basis = ergaenzeSeedFelder(altfassung(), SEED_FELDER, SEED_KATEGORIEN).version;
    const kuratiert: MappingVersion = {
      ...basis,
      felder: basis.felder.map(f =>
        f.feldId === 'D_ZZ1' ? { ...f, label: 'Von der PL umbenannt', zahPhaseId: 'pruefung' } : f),
    };
    const nachher = ergaenzeSeedFelder(kuratiert, SEED_FELDER, SEED_KATEGORIEN).version;
    const f = nachher.felder.find(x => x.feldId === 'D_ZZ1');
    expect(f?.label).toBe('Von der PL umbenannt');
    expect(f?.zahPhaseId).toBe('pruefung');
  });

  it('ergänzt nur die Lücke, wenn ein Teil schon da ist', () => {
    const teil = ergaenzeSeedFelder(altfassung(), [SEED_FELDER[0]!], SEED_KATEGORIEN).version;
    const r = ergaenzeSeedFelder(teil, SEED_FELDER, SEED_KATEGORIEN);
    expect(r.neueFelder).toBe(1);
    expect(r.neueKategorien).toBe(0);
  });
});

describe('Abgleich mit der Kürzel-Zuarbeit', () => {
  /** Fassung mit einem Feld, das anders heißt und die abgelöste Zuständigkeit trägt. */
  function fassungMitAltstand(): MappingVersion {
    const basis = ergaenzeSeedFelder(altfassung(), SEED_FELDER, SEED_KATEGORIEN).version;
    return {
      ...basis,
      felder: basis.felder.map(f => (f.feldId === 'D_ZZ1'
        ? { ...f, label: 'Alte Bezeichnung', zustaendigkeit: 'beide' as const, zahPhaseId: 'pruefung' as const }
        : f)),
    };
  }

  const AUSLIEFERUNG: StatusFeldEintrag[] = [
    { ...feld('D_ZZ1', 'zz.ab'), label: 'Neue Bezeichnung', rollen: ['qs'] },
    { ...feld('D_ZZ2', 'zz.ab'), rollen: [] },
  ];

  it('meldet abweichende Bezeichnung und Rollen', () => {
    const a = seedTextAbweichungen(fassungMitAltstand(), AUSLIEFERUNG);
    expect(a).toHaveLength(1);
    expect(a[0]!.altesLabel).toBe('Alte Bezeichnung');
    expect(a[0]!.neuesLabel).toBe('Neue Bezeichnung');
    expect(a[0]!.alteRollen).toEqual(['ab', 'fb']); // aus `beide` übersetzt
    expect(a[0]!.neueRollen).toEqual(['qs']);
  });

  it('meldet nichts, wenn beides übereinstimmt', () => {
    const gleich = ergaenzeSeedFelder(altfassung(), AUSLIEFERUNG, SEED_KATEGORIEN).version;
    expect(seedTextAbweichungen(gleich, AUSLIEFERUNG)).toEqual([]);
  });

  it('übernimmt Bezeichnung und Rollen — und lässt die Kuration in Ruhe', () => {
    const nachher = uebernimmSeedTexte(fassungMitAltstand(), AUSLIEFERUNG);
    const f = nachher.felder.find(x => x.feldId === 'D_ZZ1')!;
    expect(f.label).toBe('Neue Bezeichnung');
    expect(f.rollen).toEqual(['qs']);
    // Die ZAH-Phase ist eine Entscheidung der PL und überlebt die Übernahme.
    expect(f.zahPhaseId).toBe('pruefung');
    // Der abgelöste Wert wird ausgebucht, sonst widerspräche er den Rollen.
    expect(f.zustaendigkeit).toBeUndefined();
  });

  it('ist idempotent und gibt bei Gleichstand dieselbe Referenz zurück', () => {
    const einmal = uebernimmSeedTexte(fassungMitAltstand(), AUSLIEFERUNG);
    expect(uebernimmSeedTexte(einmal, AUSLIEFERUNG)).toBe(einmal);
  });

  it('rührt Felder nicht an, die die Auslieferung nicht kennt', () => {
    const v = fassungMitAltstand();
    const nachher = uebernimmSeedTexte(v, [AUSLIEFERUNG[0]!]);
    const unberuehrt = nachher.felder.find(x => x.feldId === 'D_ZZ2');
    expect(unberuehrt).toEqual(v.felder.find(x => x.feldId === 'D_ZZ2'));
  });
});

describe('Doppelt geführte Codes (kanonisches Feld + eigene D_-Spalte)', () => {
  const KANONISCH = new Map([['AAE', 'antragsdatum'], ['ABB', 'bewilligung_datum']]);

  /** Der Zuschnitt, den ein „Nachziehen" mit der ungefilterten Liste erzeugte. */
  function doppelt(): MappingVersion {
    const v = altfassung();
    return {
      ...v,
      felder: [
        // Das kanonische Feld trägt den Wert, aber (in Bestandsfassungen) keinen Code.
        { ...feld('antragsdatum', 'zz.ab'), label: 'Antragseingang' },
        { ...feld('D_AAE', 'zz.ab'), code: 'AAE', label: 'Antragseingang' },
        { ...feld('D_ZZ9', 'zz.ab'), code: 'ZZ9' },
      ],
    };
  }

  it('erkennt genau die doppelt geführten Codes', () => {
    expect(kanonischeCodeDoppel(doppelt(), KANONISCH)).toEqual(['AAE']);
  });

  it('meldet nichts, wenn der Code nur am kanonischen Feld hängt', () => {
    const sauber: MappingVersion = {
      ...altfassung(),
      felder: [{ ...feld('antragsdatum', 'zz.ab'), code: 'AAE' }],
    };
    expect(kanonischeCodeDoppel(sauber, KANONISCH)).toEqual([]);
  });

  it('gibt den Code ans kanonische Feld und entfernt die überzählige Spalte', () => {
    const nachher = entdoppleKanonischeCodes(doppelt(), KANONISCH);
    expect(nachher.felder.find(f => f.feldId === 'antragsdatum')?.code).toBe('AAE');
    expect(nachher.felder.find(f => f.feldId === 'D_AAE')).toBeUndefined();
    // Unbeteiligte Code-Felder bleiben unangetastet.
    expect(nachher.felder.find(f => f.feldId === 'D_ZZ9')?.code).toBe('ZZ9');
  });

  it('ist idempotent und gibt bei Gleichstand dieselbe Referenz zurück', () => {
    const einmal = entdoppleKanonischeCodes(doppelt(), KANONISCH);
    expect(entdoppleKanonischeCodes(einmal, KANONISCH)).toBe(einmal);
  });

  it('der Auslieferungs-Seed ist von sich aus dublettenfrei', () => {
    expect(kanonischeCodeDoppel(baueSeedVersion(), KANONISCHE_CODE_FELDER)).toEqual([]);
  });

  it('und die gefilterte Code-Liste bringt keine Dubletten mit', () => {
    const codes = baueSeedCodeFelderOhneKanonische().map(f => f.code);
    for (const code of KANONISCHE_CODE_FELDER.keys()) {
      expect(codes, `${code} gehört ans kanonische Feld`).not.toContain(code);
    }
  });

  it('ergaenzeVorgangssystemSeed räumt beim Nachziehen mit auf', () => {
    const nachher = ergaenzeVorgangssystemSeed(doppelt(), [], [], KANONISCH);
    expect(kanonischeCodeDoppel(nachher, KANONISCH)).toEqual([]);
  });
});

describe('Relevanz-Häkchen', () => {
  /** Ein Code-Feld: die Relevanz hängt am `code`, nicht an der `feldId`. */
  const codeFeld = (code: string): StatusFeldEintrag => ({ ...feld(`D_${code}`, 'zz.ab'), code });

  /** Fassung mit drei Code-Feldern, alle ohne Relevanz. */
  function fassung(): MappingVersion {
    const v = altfassung();
    return { ...v, felder: [...v.felder, codeFeld('ZZ1'), codeFeld('ZZ2'), codeFeld('ZZ3')] };
  }

  it('zählt nur, was sich wirklich ändern würde', () => {
    expect(relevanzLuecke(fassung(), ['ZZ1', 'ZZ2'])).toBe(2);
    const schon = markiereRelevanz(fassung(), ['ZZ1']);
    expect(relevanzLuecke(schon, ['ZZ1', 'ZZ2'])).toBe(1);
  });

  it('ignoriert Codes, die die Fassung nicht führt', () => {
    expect(relevanzLuecke(fassung(), ['GIBTSNICHT'])).toBe(0);
  });

  it('setzt die Häkchen und lässt die übrigen Felder unberührt', () => {
    const nachher = markiereRelevanz(fassung(), ['ZZ1', 'ZZ3']);
    expect(nachher.felder.find(f => f.code === 'ZZ1')?.relevant).toBe(true);
    expect(nachher.felder.find(f => f.code === 'ZZ3')?.relevant).toBe(true);
    expect(nachher.felder.find(f => f.code === 'ZZ2')?.relevant).toBeUndefined();
  });

  it('nimmt NIE ein Häkchen weg — zwei Vorschläge ergänzen sich', () => {
    const erst = markiereRelevanz(fassung(), ['ZZ1']);
    const dann = markiereRelevanz(erst, ['ZZ2']);
    expect(dann.felder.find(f => f.code === 'ZZ1')?.relevant).toBe(true);
    expect(dann.felder.find(f => f.code === 'ZZ2')?.relevant).toBe(true);
  });

  it('trifft auch bei abweichender Schreibweise (NFC, Casing)', () => {
    const nachher = markiereRelevanz(fassung(), [' zz1 ']);
    expect(nachher.felder.find(f => f.code === 'ZZ1')?.relevant).toBe(true);
  });

  it('ist idempotent und gibt bei Gleichstand dieselbe Referenz zurück', () => {
    const einmal = markiereRelevanz(fassung(), ['ZZ1']);
    expect(markiereRelevanz(einmal, ['ZZ1'])).toBe(einmal);
  });
});
