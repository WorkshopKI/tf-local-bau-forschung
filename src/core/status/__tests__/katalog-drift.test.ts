/**
 * Was diese Datei festnagelt:
 *
 * 1. Der unveränderte Seed erzeugt eine LEERE Bilanz. Meldete sie hier etwas,
 *    wäre jede echte Zahl darunter wertlos.
 * 2. Jede Gruppe hat ihren eigenen Fall — und jede Änderung erscheint in GENAU
 *    einer Gruppe. Eine Umhängung, die auch als Arbeitslisten-Wechsel zählte,
 *    läse sich als zwei Änderungen.
 * 3. `umsortiert` zählt nur die gemeinsamen Phasen: das Entfernen einer Phase
 *    verschiebt die nachfolgenden, ist aber keine Umsortierung.
 * 4. „Ohne Phase" ist auf BEIDEN Seiten möglich — Marker → Phase und Phase →
 *    Marker sind beide erfasst.
 * 5. Ein Status steht ZWEIMAL im Katalog (TV- und Verbund-Feld). Gleiche Aussage
 *    zählt einmal, verschiedene Aussage zweimal — sonst behauptete die Bilanz
 *    den doppelten Abstand bzw. verschwiege ein Auseinanderlaufen.
 * 6. Die Gegenprobe mit den Ist-Zahlen der Fassung vom 05.08. (1 Phase entfernt,
 *    2 umbenannt, 10 Zuordnungen, 39 Zieltage, 26 stillgelegt).
 */
import { describe, it, expect } from 'vitest';
import { baueSeedVersion } from '@/core/status/seed';
import { katalogDrift, hatDrift } from '@/core/status/katalog-drift';
import { SEED_ZAH_PHASEN } from '@/core/status/zah-phasen';
import type { MappingVersion, StatusWertEintrag, ZahPhaseId } from '@/core/status/typen';

const SEED = baueSeedVersion();

/** Erster Wert-Eintrag mit diesem Code — dieselbe Regel wie `schnittVon`. */
function wertMitCode(v: MappingVersion, code: number): StatusWertEintrag {
  const w = v.werte.find(x => x.code === code);
  if (!w) throw new Error(`Seed führt keinen Statuswert mit Code ${code}`);
  return w;
}

/** ALLE Katalogzeilen eines Codes — TV- und Verbund-Feld tragen dasselbe Vokabular. */
function zeilenMitCode(v: MappingVersion, code: number): StatusWertEintrag[] {
  const treffer = v.werte.filter(x => x.code === code);
  if (treffer.length < 2) throw new Error(`Code ${code} steht nicht an beiden Wert-Feldern`);
  return treffer;
}

/** Fassung mit umgehängten Codes — `null` heißt bewusst „ohne Phase". */
function mitPhasen(
  basis: MappingVersion, zuordnung: ReadonlyMap<number, ZahPhaseId | null>,
): MappingVersion {
  return {
    ...basis,
    werte: basis.werte.map(w => {
      if (w.code === undefined || !zuordnung.has(w.code)) return w;
      return { ...w, zahPhaseId: zuordnung.get(w.code) ?? null };
    }),
  };
}

describe('katalogDrift — der unveränderte Seed meldet nichts', () => {
  it('Seed gegen Seed ⇒ leere Bilanz', () => {
    const d = katalogDrift(baueSeedVersion(), SEED);
    expect(hatDrift(d), 'ohne Kuration gibt es nichts zu berichten').toBe(false);
    expect(d.zuordnungen).toEqual([]);
    expect(d.phasen.entfernt).toEqual([]);
    expect(d.phasen.umsortiert).toEqual([]);
    expect(d.zieltage).toEqual([]);
    expect(d.statuswerte.stillgelegt).toEqual([]);
    expect(d.prominenz).toEqual([]);
  });

  it('die Auslieferung führt keine Zieltage — das wird abgeleitet, nicht behauptet', () => {
    expect(katalogDrift(SEED, SEED).seedKenntZieltage).toBe(false);
  });
});

describe('katalogDrift — Phasen', () => {
  it('eine entfernte Phase steht als entfernt und erzeugt KEINE Umsortierung', () => {
    const fassung: MappingVersion = {
      ...SEED,
      zahPhasen: SEED_ZAH_PHASEN.filter(p => p.id !== 'vollstaendigkeit').map(p => ({ ...p })),
    };
    const d = katalogDrift(fassung, SEED);
    expect(d.phasen.entfernt.map(p => p.id)).toEqual(['vollstaendigkeit']);
    expect(d.phasen.umsortiert, 'Positionen rutschen, die Reihenfolge bleibt').toEqual([]);
  });

  it('eine hinzugefügte Phase steht als hinzugefügt', () => {
    const fassung: MappingVersion = {
      ...SEED,
      zahPhasen: [
        ...SEED_ZAH_PHASEN.map(p => ({ ...p })),
        { id: 'widerspruch', reihenfolge: 45, label: 'Widerspruch' },
      ],
    };
    const d = katalogDrift(fassung, SEED);
    expect(d.phasen.hinzugefuegt).toEqual([{ id: 'widerspruch', label: 'Widerspruch' }]);
    expect(d.phasen.umsortiert, 'die bestehenden Phasen stehen weiter zueinander').toEqual([]);
  });

  it('eine Umbenennung nennt alt und neu — und ist keine Zuordnungs-Drift', () => {
    const fassung: MappingVersion = {
      ...SEED,
      zahPhasen: SEED_ZAH_PHASEN.map(p => (p.id === 'pruefung' ? { ...p, label: 'In Prüfung' } : { ...p })),
    };
    const d = katalogDrift(fassung, SEED);
    expect(d.phasen.umbenannt).toEqual([{ id: 'pruefung', alt: 'Prüfung', neu: 'In Prüfung' }]);
    expect(d.zuordnungen, 'ein anderer Name hängt keinen Code um').toEqual([]);
  });

  it('getauschte Reihenfolge steht als umsortiert', () => {
    const fassung: MappingVersion = {
      ...SEED,
      zahPhasen: SEED_ZAH_PHASEN.map(p => (p.id === 'begleitung'
        ? { ...p, reihenfolge: 65 }   // hinter „Abgeschlossen"
        : { ...p })),
    };
    const d = katalogDrift(fassung, SEED);
    expect(d.phasen.umsortiert.map(p => p.id).sort()).toEqual(['abgeschlossen', 'begleitung']);
    const begleitung = d.phasen.umsortiert.find(p => p.id === 'begleitung');
    expect(begleitung).toMatchObject({ vorher: 4, nachher: 5 });
  });

  it('eine geänderte Vorgabe steht mit dem Gewicht daneben, ohne Umhängung', () => {
    const fassung: MappingVersion = {
      ...SEED,
      zahPhasen: SEED_ZAH_PHASEN.map(p => (p.id === 'begleitung'
        ? { ...p, kategorieVorgabe: 'abgeschlossen' as const, zieltageRelevant: true }
        : { ...p })),
    };
    const d = katalogDrift(fassung, SEED);
    expect(d.phasen.vorgabeGeaendert).toHaveLength(1);
    expect(d.phasen.vorgabeGeaendert[0]).toMatchObject({
      id: 'begleitung',
      arbeitsliste: { alt: 'begleitung', neu: 'abgeschlossen' },
      zieltageRelevant: { alt: false, neu: true },
    });
    // 59/89/92/95/97 hängen an „Begleitung" — die Zahl macht das Gewicht sichtbar.
    expect(d.phasen.vorgabeGeaendert[0]?.codeAnzahl).toBe(5);
    expect(d.zuordnungen, 'kein Code ist umgezogen').toEqual([]);
  });
});

describe('katalogDrift — Zuordnungen', () => {
  it('ein umgehängter Code nennt beide Seiten und seine Bezeichnung', () => {
    const fassung = mitPhasen(SEED, new Map([[32, 'pruefung' as ZahPhaseId]]));
    const d = katalogDrift(fassung, SEED);
    expect(d.zuordnungen).toHaveLength(1);
    expect(d.zuordnungen[0]).toMatchObject({ code: 32, vorher: 'entscheidung', nachher: 'pruefung' });
    expect(d.zuordnungen[0]?.bezeichnung, 'die amtliche Bezeichnung kommt aus dem Code-Katalog')
      .not.toBe('');
  });

  it('„ohne Phase" gilt auf beiden Seiten: Phase → Marker und Marker → Phase', () => {
    const fassung = mitPhasen(SEED, new Map<number, ZahPhaseId | null>([
      [11, null],                 // Eingang → ohne Phase
      [29, 'abgeschlossen'],      // Marker → Abgeschlossen
    ]));
    const d = katalogDrift(fassung, SEED);
    expect(d.zuordnungen).toEqual([
      expect.objectContaining({ code: 11, vorher: 'eingang', nachher: null }),
      expect.objectContaining({ code: 29, vorher: null, nachher: 'abgeschlossen' }),
    ]);
  });

  it('ein Code, der auf beiden Seiten ohne Phase steht, ist keine Änderung', () => {
    const d = katalogDrift(mitPhasen(SEED, new Map([[88, null]])), SEED);
    expect(d.zuordnungen).toEqual([]);
  });

  it('die Zeilen sind nach Code sortiert', () => {
    const fassung = mitPhasen(SEED, new Map<number, ZahPhaseId>([
      [90, 'begleitung'], [33, 'pruefung'], [72, 'pruefung'],
    ]));
    expect(katalogDrift(fassung, SEED).zuordnungen.map(z => z.code)).toEqual([33, 72, 90]);
  });
});

describe('katalogDrift — Zieltage, Stilllegung, Prominenz', () => {
  it('ein gepflegter Zieltag ist Drift, weil die Auslieferung keinen kennt', () => {
    const ziel = wertMitCode(SEED, 38);
    const fassung: MappingVersion = {
      ...SEED,
      werte: SEED.werte.map(w => (w.id === ziel.id ? { ...w, zieltage: 21 } : w)),
    };
    const d = katalogDrift(fassung, SEED);
    expect(d.zieltage).toHaveLength(1);
    expect(d.zieltage[0]).toMatchObject({ id: ziel.id, code: 38, alt: null, neu: 21 });
    expect(d.seedKenntZieltage).toBe(false);
  });

  it('stillgelegt und wieder aktiviert stehen getrennt', () => {
    const [a, b] = [SEED.werte[0], SEED.werte[1]];
    if (!a || !b) throw new Error('Seed ohne Statuswerte');
    const fassung: MappingVersion = {
      ...SEED,
      werte: SEED.werte.map(w => (w.id === a.id ? { ...w, aktiv: false } : w)),
    };
    const d = katalogDrift(fassung, SEED);
    expect(d.statuswerte.stillgelegt.map(w => w.id)).toEqual([a.id]);
    expect(d.statuswerte.wiederAktiviert).toEqual([]);

    // Gegenrichtung: der Seed legt still, die Fassung aktiviert wieder.
    const seedStill: MappingVersion = {
      ...SEED,
      werte: SEED.werte.map(w => (w.id === b.id ? { ...w, aktiv: false } : w)),
    };
    expect(katalogDrift(SEED, seedStill).statuswerte.wiederAktiviert.map(w => w.id)).toEqual([b.id]);
  });

  it('ein Statuswert ohne Gegenpart in der Auslieferung ist keine Drift', () => {
    const fassung: MappingVersion = {
      ...SEED,
      werte: [
        ...SEED.werte,
        {
          id: 'status::frisch entdeckt', feldId: 'status', wert: 'frisch entdeckt',
          kategorie: 'sonstige', prominenz: 'nebensaechlich', aktiv: false, unkuratiert: true,
        },
      ],
    };
    const d = katalogDrift(fassung, SEED);
    expect(d.statuswerte.stillgelegt, 'ein neuer Fund ist Beobachtung, keine Abweichung').toEqual([]);
    expect(d.prominenz).toEqual([]);
  });

  it('eine geänderte Prominenz nennt alt und neu', () => {
    const ziel = wertMitCode(SEED, 59);
    const fassung: MappingVersion = {
      ...SEED,
      werte: SEED.werte.map(w => (w.id === ziel.id ? { ...w, prominenz: 'nebensaechlich' as const } : w)),
    };
    const d = katalogDrift(fassung, SEED);
    expect(d.prominenz).toHaveLength(1);
    expect(d.prominenz[0]).toMatchObject({ id: ziel.id, alt: ziel.prominenz, neu: 'nebensaechlich' });
  });
});

describe('katalogDrift — ein Status steht zweimal im Katalog', () => {
  /** Setzt einen Zieltag an ausgewählten Katalogzeilen. */
  function mitZieltagen(ids: ReadonlyMap<string, number>): MappingVersion {
    return { ...SEED, werte: SEED.werte.map(w => (ids.has(w.id) ? { ...w, zieltage: ids.get(w.id) } : w)) };
  }

  it('gleiche Aussage an TV und Verbund zählt EINMAL', () => {
    const beide = zeilenMitCode(SEED, 38);
    const d = katalogDrift(mitZieltagen(new Map(beide.map(w => [w.id, 21]))), SEED);
    expect(d.zieltage, 'sonst behauptet die Bilanz den doppelten Abstand').toHaveLength(1);
  });

  it('… verschiedene Aussagen bleiben BEIDE stehen', () => {
    const [tv, vb] = zeilenMitCode(SEED, 38);
    if (!tv || !vb) throw new Error('Code 38 fehlt');
    const d = katalogDrift(mitZieltagen(new Map([[tv.id, 21], [vb.id, 14]])), SEED);
    expect(d.zieltage.map(z => z.neu).sort(), 'ein Auseinanderlaufen darf nicht verschwinden')
      .toEqual([14, 21]);
  });

  it('dieselbe Regel gilt für Stilllegung und Prominenz', () => {
    const beide = zeilenMitCode(SEED, 33).map(w => w.id);
    const ids = new Set(beide);
    const fassung: MappingVersion = {
      ...SEED,
      werte: SEED.werte.map(w => (ids.has(w.id)
        ? { ...w, aktiv: false, prominenz: 'ignoriert' as const }
        : w)),
    };
    const d = katalogDrift(fassung, SEED);
    expect(d.statuswerte.stillgelegt).toHaveLength(1);
    expect(d.prominenz).toHaveLength(1);
  });
});

describe('katalogDrift — Gegenprobe an der Fassung vom 05.08.', () => {
  /**
   * Der Ist-Stand der AB-Runde, nachgebaut: fünf Phasen statt sechs, zwei
   * umbenannt, zehn Codes umgehängt — dazu 39 gepflegte Zieltage und 26
   * stillgelegte Werte, jeweils als KATALOGZEILEN gezählt, so wie die Fassung
   * sie führt.
   *
   * Die 39 sind ungerade, und das ist kein Versehen: 19 Codes sind an beiden
   * Wert-Feldern gepflegt, einer nur am TV-Feld. Genau daran zeigt sich, was die
   * Bilanz zählt — Sachen, nicht Zeilen.
   */
  const ZIELTAG_CODES = [11, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 50, 51, 59, 70, 71, 72, 73, 75];
  const NUR_TV_CODE = 88;
  const STILLGELEGT_CODES = [11, 29, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 50];

  function fassungV16(): MappingVersion {
    const umgehaengt = new Map<number, ZahPhaseId>([
      ...[32, 33, 34, 35, 36, 37, 72, 75].map(c => [c, 'pruefung'] as [number, ZahPhaseId]),
      ...[90, 91].map(c => [c, 'begleitung'] as [number, ZahPhaseId]),
    ]);
    const basis = mitPhasen(SEED, umgehaengt);
    const zieltagIds = new Set([
      ...ZIELTAG_CODES.flatMap(c => zeilenMitCode(basis, c).map(w => w.id)),
      zeilenMitCode(basis, NUR_TV_CODE)[0]?.id ?? '',
    ]);
    const stillgelegtIds = new Set(
      STILLGELEGT_CODES.flatMap(c => zeilenMitCode(basis, c).map(w => w.id)),
    );
    return {
      ...basis,
      zahPhasen: SEED_ZAH_PHASEN
        .filter(p => p.id !== 'vollstaendigkeit')
        .map(p => {
          if (p.id === 'pruefung') return { ...p, label: 'In Prüfung' };
          if (p.id === 'entscheidung') return { ...p, label: 'Erstentscheidung' };
          return { ...p };
        }),
      werte: basis.werte.map(w => ({
        ...w,
        ...(zieltagIds.has(w.id) ? { zieltage: 14 } : {}),
        ...(stillgelegtIds.has(w.id) ? { aktiv: false } : {}),
      })),
    };
  }

  const fassung = fassungV16();
  const d = katalogDrift(fassung, SEED);

  it('meldet 1 entfernte Phase, 2 umbenannte und keine Umsortierung', () => {
    expect(d.phasen.entfernt).toHaveLength(1);
    expect(d.phasen.umbenannt).toHaveLength(2);
    expect(d.phasen.hinzugefuegt).toEqual([]);
    expect(d.phasen.umsortiert, 'eine entfernte Phase ist keine Umsortierung').toEqual([]);
  });

  it('meldet 10 geänderte Zuordnungen', () => {
    expect(d.zuordnungen).toHaveLength(10);
    expect(d.zuordnungen.map(z => z.code)).toEqual([32, 33, 34, 35, 36, 37, 72, 75, 90, 91]);
  });

  it('die Fassung trägt 39 gepflegte Zieltage und 26 stillgelegte KATALOGZEILEN', () => {
    expect(fassung.werte.filter(w => typeof w.zieltage === 'number')).toHaveLength(39);
    expect(fassung.werte.filter(w => !w.aktiv)).toHaveLength(26);
  });

  it('… die Bilanz zählt die SACHEN dahinter: 20 Zieltage, 13 stillgelegte Werte', () => {
    expect(d.zieltage, '19 Codes beidseitig + 1 nur am TV-Feld').toHaveLength(20);
    expect(d.statuswerte.stillgelegt, '13 Codes an je zwei Katalogzeilen').toHaveLength(13);
    expect(d.statuswerte.wiederAktiviert).toEqual([]);
  });

  it('… und ist damit nicht leer', () => {
    expect(hatDrift(d)).toBe(true);
  });
});
