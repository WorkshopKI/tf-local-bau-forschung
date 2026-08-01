/**
 * Die Status-Erklärung. Der rote Faden dieser Tests ist **Ehrlichkeit**: die
 * Erklärung darf nichts behaupten, was die Daten nicht hergeben.
 *
 * - Ein unbekannter Statuswert bekommt keine Phase, sondern eine Warnung.
 * - „Seit wann" wird weggelassen, wenn es sich nicht bestimmen lässt — nicht
 *   durch das jüngste beliebige Datum ersetzt.
 * - Der Verlauf ist als Näherung gekennzeichnet und sagt, wie viel er verschweigt.
 */
import { describe, it, expect } from 'vitest';
import { baueHerleitung, herleitungAlsText, type Datenstand } from '@/core/status/herleitung';
import { baueSeedVersion } from '@/core/status/seed';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import type { MappingVersion, StatusFeldEintrag, TriggerZeile } from '@/core/status/typen';

const STICHTAG = '2026-08-01T00:00:00.000Z';
const seed = baueSeedVersion();

const DATENSTAND: Datenstand = {
  importiertAm: '2026-07-31T02:00:00.000Z',
  katalogVersion: 4,
  triggerVersion: 2,
  triggerHerkunft: 'share',
};

/** Ein Vorkommen zu einem Katalog-Feld bauen (Feld muss im Seed stehen). */
function vorkommen(feldId: string, wert: string, text?: string): FeldVorkommen {
  const feld = seed.felder.find(f => f.feldId === feldId);
  if (!feld) throw new Error(`Testfehler: Feld ${feldId} steht nicht im Seed`);
  return { feld, wert, ...(text ? { text } : {}) };
}

const basis = {
  version: seed,
  trigger: [] as TriggerZeile[],
  datenstand: DATENSTAND,
  stichtag: STICHTAG,
};

describe('baueHerleitung — Statuswert und Phase', () => {
  it('löst den Code auf und nennt die ZAH-Phase', () => {
    const h = baueHerleitung({ ...basis, vorkommen: [], statusRoh: 'NF gestellt' });
    expect(h.code).toBe(35);
    expect(h.statusText).toBe('NF gestellt');
    expect(h.zahPhase).toBe('vollstaendigkeit');
    expect(h.zahPhaseLabel).toBe('Vollständigkeit');
    expect(h.nichtImKatalog).toBe(false);
  });

  it('warnt bei einem Statuswert, den der Katalog nicht kennt — ohne Phase zu raten', () => {
    const h = baueHerleitung({ ...basis, vorkommen: [], statusRoh: 'Wunschstatus' });
    expect(h.code).toBeNull();
    expect(h.nichtImKatalog).toBe(true);
    expect(h.zahPhase).toBeNull();
    expect(h.statusText).toBe('Wunschstatus');
    expect(herleitungAlsText(h)).toContain('nicht im Katalog');
  });

  it('kennzeichnet Marker-Status als solche statt sie phasenlos wirken zu lassen', () => {
    const h = baueHerleitung({ ...basis, vorkommen: [], statusRoh: 'Irrläufer' });
    expect(h.code).toBe(29);
    expect(h.marker).toBe(true);
    expect(h.zahPhase).toBeNull();
    expect(herleitungAlsText(h)).toContain('Marker');
  });

  it('meldet einen leeren Status nicht als „nicht im Katalog"', () => {
    const h = baueHerleitung({ ...basis, vorkommen: [], statusRoh: '' });
    expect(h.nichtImKatalog).toBe(false);
    expect(h.code).toBeNull();
  });

  it('merkt sich, ob der Treffer exakt war oder über eine lose Variante ging', () => {
    expect(baueHerleitung({ ...basis, vorkommen: [], statusRoh: 'NF gestellt' }).joinArt).toBe('exakt');
    const lose = baueHerleitung({
      ...basis, vorkommen: [], statusRoh: 'Stellungnahme zur Rücknahmeempf',
    });
    expect(lose.joinArt).toBe('variante-lose');
  });
});

describe('baueHerleitung — Phase auch ohne nachgezogene Fassung', () => {
  /** Eine Bestandsfassung: Statuswerte ohne Code, wie vor dem Vorgangssystem. */
  const ohneCodes: MappingVersion = {
    ...seed,
    werte: seed.werte.map(w => {
      const { code: _c, zahPhaseId: _z, marker: _m, varianten: _v, ...rest } = w;
      return rest;
    }),
  };

  it('greift auf den Auslieferungs-Schnitt zurück, wenn die Fassung keine Codes trägt', () => {
    const h = baueHerleitung({ ...basis, version: ohneCodes, vorkommen: [], statusRoh: 'Ablehnung' });
    expect(h.code).toBe(70);
    expect(h.zahPhase).toBe('entscheidung');
    expect(h.marker).toBe(false);
  });

  it('erkennt Marker auch ohne nachgezogene Fassung', () => {
    const h = baueHerleitung({ ...basis, version: ohneCodes, vorkommen: [], statusRoh: 'Irrläufer' });
    expect(h.marker).toBe(true);
    expect(h.zahPhase).toBeNull();
  });

  it('unterscheidet „kein Marker, aber auch keine Phase" von „Marker"', () => {
    // Kuration hat den Code bewusst ohne Phase gelassen, ohne ihn zum Marker zu
    // erklären — das darf nicht als „Marker" durchgehen.
    const entkoppelt: MappingVersion = {
      ...seed,
      werte: seed.werte.map(w => (w.code === 70 ? { ...w, zahPhaseId: null, marker: false } : w)),
    };
    const h = baueHerleitung({ ...basis, version: entkoppelt, vorkommen: [], statusRoh: 'Ablehnung' });
    expect(h.zahPhase).toBeNull();
    expect(h.marker).toBe(false);
    expect(herleitungAlsText(h)).toContain('noch keine ZAH-Phase zugeordnet');
  });
});

describe('baueHerleitung — letzter Vorgang und Verlauf', () => {
  const eintraege = [
    vorkommen('antragsdatum', '18.05.2026'),
    vorkommen('D_ADV', '02.06.2026'),
    vorkommen('D_AT4', '14.06.2026'),
  ];

  it('nennt den jüngsten Datumseintrag als letzten Vorgang', () => {
    const h = baueHerleitung({ ...basis, vorkommen: eintraege, statusRoh: 'techn geprüft' });
    expect(h.letzterVorgang?.tag).toBe('2026-06-14');
    expect(h.letzterVorgang?.code).toBe('AT4');
  });

  it('führt den Verlauf absteigend ohne den letzten Vorgang', () => {
    const h = baueHerleitung({ ...basis, vorkommen: eintraege, statusRoh: 'techn geprüft' });
    expect(h.verlauf.map(s => s.tag)).toEqual(['2026-06-02', '2026-05-18']);
    expect(h.verlaufGesamt).toBe(2);
  });

  it('deckelt den Verlauf, sagt aber wie viel fehlt', () => {
    const viele = [
      vorkommen('antragsdatum', '01.01.2026'),
      vorkommen('D_ADV', '02.01.2026'),
      vorkommen('D_AT4', '03.01.2026'),
      vorkommen('D_AK4', '04.01.2026'),
      vorkommen('D_QS', '05.01.2026'),
      vorkommen('D_XTEC', '06.01.2026'),
    ];
    const h = baueHerleitung({
      ...basis, vorkommen: viele, statusRoh: 'techn geprüft', maxVerlauf: 2,
    });
    expect(h.verlauf).toHaveLength(2);
    expect(h.verlaufGesamt).toBe(5);
    expect(herleitungAlsText(h)).toContain('3 weitere Einträge');
  });

  it('lässt am selben Tag den Meilenstein den letzten Vorgang stellen', () => {
    // Beobachtet im echten Bestand: „allgemeine Ablehnung" (AAA, normal) und
    // „Ablehnung an Ast" (ABLZ, Meilenstein) tragen beide den 22.06. Ein
    // blindes `reverse()` der aufsteigenden Chronik drehte auch die
    // Prominenz-Ordnung um und stellte den nebensächlicheren Eintrag nach vorn.
    const h = baueHerleitung({
      ...basis,
      vorkommen: [vorkommen('D_AAA', '22.06.2026'), vorkommen('D_ABLZ', '22.06.2026')],
      statusRoh: 'Ablehnung',
    });
    expect(h.letzterVorgang?.code).toBe('ABLZ');
    expect(h.verlauf.map(s => s.code)).toEqual(['AAA']);
  });

  it('sagt ausdrücklich, wenn es keinen Datumseintrag gibt', () => {
    const h = baueHerleitung({ ...basis, vorkommen: [], statusRoh: 'beantragt' });
    expect(h.letzterVorgang).toBeNull();
    expect(herleitungAlsText(h)).toContain('kein Datumseintrag gefunden');
  });

  it('nimmt den Begleittext der T_-Spalte mit', () => {
    const h = baueHerleitung({
      ...basis, vorkommen: [vorkommen('D_AT4', '14.06.2026', 'Gutachten liegt vor')],
      statusRoh: 'techn geprüft',
    });
    expect(h.letzterVorgang?.text).toBe('Gutachten liegt vor');
    expect(herleitungAlsText(h)).toContain('Notiz: Gutachten liegt vor');
  });
});

describe('baueHerleitung — Relevanz-Filter', () => {
  it('filtert auf relevante Kürzel, sobald die Fassung welche kennt', () => {
    const mitRelevanz: MappingVersion = {
      ...seed,
      felder: seed.felder.map((f: StatusFeldEintrag) =>
        (f.feldId === 'D_AT4' ? { ...f, relevant: true } : f)),
    };
    const h = baueHerleitung({
      ...basis, version: mitRelevanz,
      vorkommen: [vorkommen('antragsdatum', '18.05.2026'), vorkommen('D_AT4', '14.06.2026')],
      statusRoh: 'techn geprüft',
    });
    expect(h.letzterVorgang?.code).toBe('AT4');
    expect(h.verlauf).toHaveLength(0);   // Antragseingang ist nicht relevant markiert
  });

  it('zeigt ALLES, solange keine Relevanz gepflegt ist (kein leerer Bildschirm)', () => {
    const h = baueHerleitung({
      ...basis,
      vorkommen: [vorkommen('antragsdatum', '18.05.2026'), vorkommen('D_AT4', '14.06.2026')],
      statusRoh: 'techn geprüft',
    });
    expect(h.verlauf).toHaveLength(1);
  });
});

describe('baueHerleitung — „seit wann"', () => {
  it('nimmt ein Datumsfeld derselben Phase', () => {
    // `antragsdatum` ist im Seed Spine `eingang`; Status „beantragt" ist ZAH `eingang`.
    const h = baueHerleitung({
      ...basis, vorkommen: [vorkommen('antragsdatum', '18.05.2026')], statusRoh: 'beantragt',
    });
    expect(h.seit).toBe('2026-05-18');
    expect(h.tage).toBe(75);
  });

  it('lässt „seit" WEG, wenn kein passendes Datum existiert — statt zu raten', () => {
    // Nur ein Prüf-Datum vorhanden, Status steht auf „beantragt" (Eingang).
    const h = baueHerleitung({
      ...basis, vorkommen: [vorkommen('D_AT4', '14.06.2026')], statusRoh: 'beantragt',
    });
    expect(h.seit).toBeNull();
    expect(h.tage).toBeNull();
    expect(herleitungAlsText(h)).not.toContain('seit');
  });

  it('lässt „seit" ohne Phase weg (Marker, unbekannter Status)', () => {
    const h = baueHerleitung({
      ...basis, vorkommen: [vorkommen('antragsdatum', '18.05.2026')], statusRoh: 'Wunschstatus',
    });
    expect(h.seit).toBeNull();
  });
});

describe('baueHerleitung — Trigger und Datenstand', () => {
  const trigger: TriggerZeile[] = [{
    kuerzel: 'AT4', folge: 1, prozedur: 'TRG.Status.TV.VB', parameterRoh: '211|38',
    geparst: { art: 'statusSetzen', ebene: '211', status: 38 },
    satz: 'Setze TV-Status (211) auf 38.',
  }];

  it('hängt die Trigger-Sätze des Kürzels an den letzten Vorgang', () => {
    const h = baueHerleitung({
      ...basis, trigger, vorkommen: [vorkommen('D_AT4', '14.06.2026')], statusRoh: 'techn geprüft',
    });
    expect(h.letzterVorgang?.trigger.map(t => t.satz)).toEqual(['Setze TV-Status (211) auf 38.']);
    expect(herleitungAlsText(h)).toContain('Dieser Trigger löste aus: Setze TV-Status (211) auf 38.');
  });

  it('kommt ohne importierte Trigger aus', () => {
    const h = baueHerleitung({
      ...basis, vorkommen: [vorkommen('D_AT4', '14.06.2026')], statusRoh: 'techn geprüft',
    });
    expect(h.letzterVorgang?.trigger).toEqual([]);
  });

  it('führt den Datenstand in jeder Erklärung mit', () => {
    const text = herleitungAlsText(baueHerleitung({ ...basis, vorkommen: [], statusRoh: 'beantragt' }));
    expect(text).toContain('Datenstand: Import 31.07.2026');
    expect(text).toContain('Katalog v4');
    expect(text).toContain('Trigger v2 (share)');
  });

  it('benennt eine fehlende Trigger-Tabelle als solche', () => {
    const h = baueHerleitung({
      ...basis, vorkommen: [], statusRoh: 'beantragt',
      datenstand: { ...DATENSTAND, triggerVersion: null, triggerHerkunft: 'leer' },
    });
    expect(herleitungAlsText(h)).toContain('Trigger nicht importiert');
  });
});

describe('baueHerleitung — Determinismus', () => {
  it('liefert bei gleicher Eingabe dieselbe Ausgabe', () => {
    const eingabe = {
      ...basis, vorkommen: [vorkommen('antragsdatum', '18.05.2026')], statusRoh: 'beantragt',
    };
    expect(JSON.stringify(baueHerleitung(eingabe))).toBe(JSON.stringify(baueHerleitung(eingabe)));
  });
});
