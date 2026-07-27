import { describe, it, expect } from 'vitest';
import {
  aendereKategorie, entferneKategorie, ergaenzeSeedFelder, fuegeFeldHinzu, fuegeKategorieHinzu,
  seedTextAbweichungen, uebernimmSeedTexte,
} from '@/core/status/katalog-edit';
import { baueSeedVersion } from '@/core/status/seed';
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
        f.feldId === 'D_ZZ1' ? { ...f, label: 'Von der PL umbenannt', rang: 42 } : f),
    };
    const nachher = ergaenzeSeedFelder(kuratiert, SEED_FELDER, SEED_KATEGORIEN).version;
    const f = nachher.felder.find(x => x.feldId === 'D_ZZ1');
    expect(f?.label).toBe('Von der PL umbenannt');
    expect(f?.rang).toBe(42);
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
        ? { ...f, label: 'Alte Bezeichnung', zustaendigkeit: 'beide' as const, rang: 42 }
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
    // Der Rang ist eine Entscheidung der PL und überlebt die Übernahme.
    expect(f.rang).toBe(42);
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
