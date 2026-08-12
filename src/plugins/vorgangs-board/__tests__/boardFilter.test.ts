/**
 * Die Filter-Achsen des Boards — und vor allem die Facetten-Zahlen.
 *
 * Die Zahl im Menü ist eine Zusage: „hakst du 2023 an, kommen 910 Zeilen dazu".
 * Genau diese Zusage wird hier geprüft — dass Zähler und Filter aus DERSELBEN
 * Grundmenge kommen, ist der Fehler, der andernorts schon einmal eine Pille
 * falsch beschriftet hat.
 */
import { describe, expect, it } from 'vitest';
import type { AntragListItem } from '@/core/services/csv/types';
import type { ZahPhaseId } from '@/core/status';
import {
  letzteDreiJahrgaenge, reichtInAltbestand, passtJahr, passtVariante, passtPhase, passtRest,
  zaehleNach, fristLaeuftFuer, type FilterbareZeile,
} from '../boardFilter';

const AUS = { active: false, tokens: [], includeBegleitung: false };

function zeile(
  jahr: string,
  variante: string,
  zahPhase: ZahPhaseId | null,
  urteil: FilterbareZeile['waechter']['urteil'] = 'ok',
): FilterbareZeile {
  return { jahr, variante, zahPhase, waechter: { urteil }, filterRecord: {} as AntragListItem };
}

const BESTAND: FilterbareZeile[] = [
  zeile('2026', 'FuE', 'pruefung'),
  zeile('2025', 'FuE', 'pruefung', 'haengt'),
  zeile('2025', 'DL', 'entscheidung'),
  zeile('2023', 'FuE', 'begleitung'),
  zeile('2016', 'DL', 'abgeschlossen'),
  // Ohne Antragsdatum und ohne Phase — die stillen Fälle.
  zeile('', 'FuE', null),
];

describe('letzteDreiJahrgaenge', () => {
  it('nennt das laufende Jahr und die zwei davor, absteigend', () => {
    expect(letzteDreiJahrgaenge('2026-08-04T09:00:00.000Z')).toEqual(['2026', '2025', '2024']);
  });

  it('rechnet über den Jahreswechsel hinweg aus dem Stichtag, nicht aus einer Uhr', () => {
    expect(letzteDreiJahrgaenge('2027-01-01T00:00:00.000Z')).toEqual(['2027', '2026', '2025']);
  });
});

describe('reichtInAltbestand', () => {
  const stichtag = '2026-08-04T09:00:00.000Z';

  it('schweigt bei der Vorbelegung', () => {
    expect(reichtInAltbestand(['2026', '2025', '2024'], stichtag)).toBe(false);
  });

  it('warnt bei leerer Auswahl — das sind ALLE Jahrgänge', () => {
    expect(reichtInAltbestand([], stichtag)).toBe(true);
  });

  it('warnt auch bei einem EINZELNEN alten Jahrgang', () => {
    // Der alte `alleJahrgaenge`-Schalter schwieg hier — dabei melden gerade
    // dort die „ist leer"-Regeln massenhaft Scheinaufgaben.
    expect(reichtInAltbestand(['2016'], stichtag)).toBe(true);
  });
});

describe('Prädikate', () => {
  it('leere Auswahl heißt „kein Filter", nicht „nichts"', () => {
    expect(BESTAND.filter(z => passtJahr(z, []))).toHaveLength(BESTAND.length);
    expect(BESTAND.filter(z => passtVariante(z, []))).toHaveLength(BESTAND.length);
    expect(BESTAND.filter(z => passtPhase(z, []))).toHaveLength(BESTAND.length);
  });

  it('nimmt Zeilen ohne Antragsdatum nur unter „alle Jahrgänge" mit', () => {
    expect(passtJahr(zeile('', 'FuE', null), [])).toBe(true);
    expect(passtJahr(zeile('', 'FuE', null), ['2026', '2025', '2024'])).toBe(false);
  });

  it('vergleicht die fehlende Phase gegen den Leerstring, statt sie durchzuwinken', () => {
    expect(passtPhase(zeile('2026', 'FuE', null), ['pruefung'])).toBe(false);
  });

  it('mehrere Werte einer Achse sind ein ODER', () => {
    expect(BESTAND.filter(z => passtJahr(z, ['2026', '2025']))).toHaveLength(3);
  });

  it('„hängt fest" greift unabhängig von den Menü-Achsen', () => {
    expect(BESTAND.filter(z => passtRest(z, true, AUS))).toHaveLength(1);
    expect(BESTAND.filter(z => passtRest(z, false, AUS))).toHaveLength(BESTAND.length);
  });
});

describe('zaehleNach — Facetten-Semantik', () => {
  it('zählt je Wert über die übergebene Menge', () => {
    const z = zaehleNach(BESTAND, r => r.jahr);
    expect(z.get('2025')).toBe(2);
    expect(z.get('2026')).toBe(1);
  });

  it('zählt den Leerschlüssel NICHT mit — er hat keinen Menü-Eintrag', () => {
    expect(zaehleNach(BESTAND, r => r.jahr).has('')).toBe(false);
    expect(zaehleNach(BESTAND, r => r.zahPhase ?? '').has('')).toBe(false);
  });

  it('lässt die EIGENE Achse aus: 2023 zählt auch dann, wenn nur 2026 gewählt ist', () => {
    const jahre = ['2026'];
    // So ruft der Hook: alle Achsen AUSSER der eigenen.
    const grundmenge = BESTAND.filter(z => passtVariante(z, []) && passtPhase(z, []) && passtRest(z, false, AUS));
    expect(zaehleNach(grundmenge, r => r.jahr).get('2023')).toBe(1);
    // Und die Zusage stimmt: 2023 dazu-haken bringt genau diese eine Zeile.
    const vorher = BESTAND.filter(z => passtJahr(z, jahre)).length;
    const nachher = BESTAND.filter(z => passtJahr(z, [...jahre, '2023'])).length;
    expect(nachher - vorher).toBe(1);
  });

  it('respektiert die ANDEREN Achsen: unter „FuE" schrumpfen die Jahrgangs-Zahlen', () => {
    const grundmenge = BESTAND.filter(z => passtVariante(z, ['FuE']) && passtPhase(z, []) && passtRest(z, false, AUS));
    const z = zaehleNach(grundmenge, r => r.jahr);
    expect(z.get('2025')).toBe(1);   // ohne Varianten-Filter wären es 2
    expect(z.has('2016')).toBe(false);
  });
});

/*
 * Bis v4.3 stand hier eine feste Menge von vier Phasen-Ids im Hook. Sobald die
 * PL den Schnitt umhängt, traf sie daneben — lautlos. Diese Tests halten fest,
 * dass die Antwort aus der Fassung kommt.
 */
describe('fristLaeuftFuer', () => {
  // Rohtexte aus STATUS_CODE_KATALOG: 73 terminal, 97 Begleitung, 38 in Prüfung.
  const TERMINAL = 'abgelehnt/zurückgezogen';
  const BEGLEITUNG = 'VN geprüft';
  const IN_PRUEFUNG = 'techn geprüft';

  it('hält die Uhr bei terminalen Vorgängen an — unabhängig von der Phase', () => {
    expect(fristLaeuftFuer('eingang', TERMINAL)).toBe(false);
    expect(fristLaeuftFuer(null, TERMINAL)).toBe(false);
  });

  it('lässt sie in der Begleitphase laufen: dort gilt die echte VN-Frist', () => {
    expect(fristLaeuftFuer('begleitung', BEGLEITUNG)).toBe(true);
  });

  it('folgt ohne Fassung dem ausgelieferten Schnitt', () => {
    expect(fristLaeuftFuer('eingang', IN_PRUEFUNG)).toBe(true);
    // Der Auslieferungs-Seed hält die Uhr in der Entscheidung an: die
    // Antragsfrist misst die Bearbeitung BIS zur Entscheidung.
    expect(fristLaeuftFuer('entscheidung', IN_PRUEFUNG)).toBe(false);
  });

  it('lässt sie bei unbekannter oder verwaister Phase laufen', () => {
    expect(fristLaeuftFuer(null, IN_PRUEFUNG)).toBe(true);
    expect(fristLaeuftFuer('gibt-es-nicht', IN_PRUEFUNG)).toBe(true);
  });

  // Der eigentliche Regressionsbeleg: eine NEU geschnittene Phase, die es im
  // Seed nicht gibt. Die alte feste Menge hätte sie nie erfasst.
  it('folgt der kuratierten Fassung, auch bei einer frisch angelegten Phase', () => {
    const fassung = [
      { id: 'erstsichtung', label: 'Erstsichtung', reihenfolge: 10, fristLaeuft: true },
      { id: 'erstsichtung-qs', label: 'QS der Erstsichtung', reihenfolge: 20, fristLaeuft: false },
    ];
    expect(fristLaeuftFuer('erstsichtung', IN_PRUEFUNG, fassung)).toBe(true);
    expect(fristLaeuftFuer('erstsichtung-qs', IN_PRUEFUNG, fassung)).toBe(false);
    // Terminal schlägt die Fassung weiter — der Sonderfall hängt am Status.
    expect(fristLaeuftFuer('erstsichtung', TERMINAL, fassung)).toBe(false);
  });
});
