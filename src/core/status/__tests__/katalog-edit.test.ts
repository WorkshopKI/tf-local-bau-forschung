import { describe, it, expect } from 'vitest';
import {
  aendereKategorie, entferneKategorie, ergaenzeSeedFelder, fuegeFeldHinzu, fuegeKategorieHinzu,
} from '@/core/status/katalog-edit';
import { baueSeedVersion } from '@/core/status/seed';
import type { MappingVersion, StatusFeldEintrag, StatusKategorie } from '@/core/status/typen';

function kat(id: string, elternId: string | null, label: string): StatusKategorie {
  return { id, elternId, label, ebene: 'tv', reihenfolge: 10, aktiv: true };
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

const SEED_KATEGORIEN: StatusKategorie[] = [kat('tv.ab', null, 'Antragsbearbeitung')];
const SEED_FELDER: StatusFeldEintrag[] = [feld('D_AAE', 'tv.ab'), feld('D_ADV', 'tv.ab')];

describe('katalog-edit — Kategoriebaum', () => {
  it('fügt eine Kategorie hinzu, doppelte Ids prallen ab', () => {
    const v = fuegeKategorieHinzu(baueSeedVersion(), kat('tv.ab', null, 'Antragsbearbeitung'));
    const nochmal = fuegeKategorieHinzu(v, kat('tv.ab', null, 'Anderer Name'));
    expect(nochmal.kategorien).toHaveLength(1);
    expect(nochmal.kategorien?.[0]?.label).toBe('Antragsbearbeitung');
  });

  it('verwirft ein Umhängen, das einen Ringschluss erzeugen würde — der Rest des Patches greift', () => {
    let v = baueSeedVersion();
    for (const k of [kat('a', null, 'A'), kat('b', 'a', 'B')]) v = fuegeKategorieHinzu(v, k);
    const nachher = aendereKategorie(v, 'a', { elternId: 'b', label: 'A neu' });
    expect(nachher.kategorien?.find(k => k.id === 'a')?.elternId).toBeNull();
    expect(nachher.kategorien?.find(k => k.id === 'a')?.label).toBe('A neu');
  });

  it('lässt beim Entfernen keine toten Verweise zurück', () => {
    let v = baueSeedVersion();
    for (const k of [kat('a', null, 'A'), kat('b', 'a', 'B')]) v = fuegeKategorieHinzu(v, k);
    v = fuegeFeldHinzu(v, feld('D_TEST', 'a'));

    const nachher = entferneKategorie(v, 'a');
    // Kind rückt an den Elternknoten nach (hier: Wurzel)
    expect(nachher.kategorien?.find(k => k.id === 'b')?.elternId).toBeNull();
    // Feld verliert die Zuordnung, bleibt aber erhalten
    const f = nachher.felder.find(x => x.feldId === 'D_TEST');
    expect(f).toBeDefined();
    expect(f?.kategorieId).toBeUndefined();
  });
});

describe('ergaenzeSeedFelder', () => {
  it('fügt fehlende Kategorien und Felder an', () => {
    const r = ergaenzeSeedFelder(baueSeedVersion(), SEED_FELDER, SEED_KATEGORIEN);
    expect(r.neueKategorien).toBe(1);
    expect(r.neueFelder).toBe(2);
    expect(r.version.felder.map(f => f.feldId)).toContain('D_AAE');
  });

  it('ist idempotent — der zweite Lauf ändert nichts', () => {
    const erst = ergaenzeSeedFelder(baueSeedVersion(), SEED_FELDER, SEED_KATEGORIEN);
    const zweit = ergaenzeSeedFelder(erst.version, SEED_FELDER, SEED_KATEGORIEN);
    expect(zweit.neueFelder).toBe(0);
    expect(zweit.neueKategorien).toBe(0);
    // Gleiche Objektreferenz: nichts zu tun heißt nichts anfassen.
    expect(zweit.version).toBe(erst.version);
  });

  it('lässt kuratierte Einträge unangetastet, auch wenn der Seed sie anders sieht', () => {
    const basis = ergaenzeSeedFelder(baueSeedVersion(), SEED_FELDER, SEED_KATEGORIEN).version;
    const kuratiert: MappingVersion = {
      ...basis,
      felder: basis.felder.map(f =>
        f.feldId === 'D_AAE' ? { ...f, label: 'Von der PL umbenannt', rang: 42 } : f),
    };
    const nachher = ergaenzeSeedFelder(kuratiert, SEED_FELDER, SEED_KATEGORIEN).version;
    const f = nachher.felder.find(x => x.feldId === 'D_AAE');
    expect(f?.label).toBe('Von der PL umbenannt');
    expect(f?.rang).toBe(42);
  });

  it('ergänzt nur die Lücke, wenn ein Teil schon da ist', () => {
    const teil = ergaenzeSeedFelder(baueSeedVersion(), [SEED_FELDER[0]!], SEED_KATEGORIEN).version;
    const r = ergaenzeSeedFelder(teil, SEED_FELDER, SEED_KATEGORIEN);
    expect(r.neueFelder).toBe(1);
    expect(r.neueKategorien).toBe(0);
  });
});
