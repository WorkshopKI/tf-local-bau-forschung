/**
 * Die **Kopfkarte** in allen vier Fristzuständen.
 *
 * Der Entwurf zeigt nur den Verzugsfall. Eine Karte, die auch bei einem Antrag
 * in der Frist „Woran es hängt" fragt, behauptet ein Problem — deshalb wechseln
 * Überschrift und Rahmen mit, und deshalb wird das hier geprüft: der Bestand
 * dieser Installation führt zeitweise ausschließlich überfällige Vorgänge, und
 * ein Fall, den niemand ansehen kann, muss messbar bleiben.
 */
import { describe, it, expect } from 'vitest';
import type { FristErgebnis } from '@/core/services/csv/frist-ergebnis';
import type { FristBezug } from '@/core/status/frist-bezug';
import type { WaechterErgebnis } from '@/core/status/waechter';
import { baueKopfModell } from '@/plugins/antraege/ausklapp/kopfkarte/kopfkarteModell';
import { findeBlocker } from '@/plugins/antraege/ausklapp/kopfkarte/blocker';
import { liegtBei } from '@/plugins/antraege/ausklapp/kopfkarte/liegtBei';
import type { MeilensteinLage } from '@/plugins/antraege/ausklapp/meilensteinLage';
import { ergebnis as mstErgebnis, knoten, lageDa } from './fixtures/meilensteinLage';

const HEUTE = '2026-08-05';

/** Die Kopfkarte prüft die Frist, nicht die Kaskade — hier steuert sie nichts bei. */
const OHNE_AUFGABE = { ohneRegeln: false, uneinig: false, herkunft: null };

function frist(p: Partial<FristErgebnis> = {}): FristErgebnis {
  return {
    zustand: 'laeuft',
    basisFeld: 'D_AAE',
    basisDatum: '2025-08-13',
    zielDatum: '2025-11-11',
    bezugsZeitpunkt: HEUTE,
    tageRest: -271,
    haltedatumQuelle: 'unbekannt',
    ...p,
  };
}

function bezug(p: Partial<FristBezug> = {}): FristBezug {
  return {
    ergebnis: frist(),
    antragsdatum: '2025-08-13',
    alleAntraegeDa: null,
    vnEingangDatum: null,
    halt: null,
    bezugsZeitpunkt: HEUTE,
    ...p,
  };
}

const waechter = (p: Partial<WaechterErgebnis> = {}): WaechterErgebnis => ({
  urteil: 'haengt', letzteAktivitaet: '2026-08-01', belegt: true, anstehend: null,
  tage: 4, zieltage: 14, grund: 'seit 4 Tagen kein Eintrag', rolle: null, paar: null, ...p,
});

const LAGE: MeilensteinLage = lageDa(
  [knoten({ id: 'a', nummer: '1' })],
  [mstErgebnis('a', 'gerissen', { sollDatum: '2026-01-12' })],
);

function baue(b: FristBezug, lage: MeilensteinLage = LAGE, w = waechter()) {
  return baueKopfModell({
    bezug: b,
    stichtag: HEUTE,
    waechter: w,
    lage,
    befund: findeBlocker(lage, HEUTE),
    liegtBei: liegtBei({ waechter: w, vorgangssystemAn: true, aufgabe: OHNE_AUFGABE }),
  });
}

describe('baueKopfModell — die vier Fristzustände', () => {
  it('fragt bei Verzug „Woran es hängt" und rahmt rot', () => {
    const m = baue(bezug());
    expect(m.eyebrow).toBe('Woran es hängt');
    expect(m.urteil).toBe('271 Tage über der Frist');
    expect(m.zusatz).toBe(
      'Ziel war 11.11.2025 · Bearbeitungsfrist 90 T ab Antragseingang 13.08.2025',
    );
    expect(m.rahmen).toBe('var(--tf-danger-border)');
    expect(m.imVerzug).toBe(true);
  });

  it('behauptet innerhalb der Frist KEIN Problem', () => {
    const m = baue(bezug({ ergebnis: frist({ tageRest: 26 }) }));
    expect(m.eyebrow).toBe('Wo der Antrag steht');
    expect(m.urteil).toBe('Noch 26 Tage bis zur Frist');
    expect(m.zusatz).toContain('Ziel 11.11.2025');
    expect(m.rahmen).toBe('var(--tf-border)');
    expect(m.imVerzug).toBe(false);
  });

  it('sagt „heute fällig" statt „noch 0 Tage"', () => {
    expect(baue(bezug({ ergebnis: frist({ tageRest: 0 }) })).urteil).toBe('Heute fällig');
  });

  it('setzt den Singular richtig', () => {
    expect(baue(bezug({ ergebnis: frist({ tageRest: -1 }) })).urteil).toBe('1 Tag über der Frist');
    expect(baue(bezug({ ergebnis: frist({ tageRest: 1 }) })).urteil).toBe('Noch 1 Tag bis zur Frist');
  });

  it('nennt bei angehaltener Uhr das Haltedatum und zeichnet keinen Punkt', () => {
    const m = baue(bezug({
      ergebnis: frist({ zustand: 'angehalten', bezugsZeitpunkt: '2026-03-01', haltedatumQuelle: 'journal' }),
      halt: { tag: '2026-03-01', herkunft: 'journal' },
    }));
    expect(m.punkt).toBeNull();
    expect(m.zusatz).toContain('Angehalten am 01.03.2026');
    expect(m.zusatz).toContain('Journal');
    expect(m.imVerzug).toBe(false);
  });

  it('nennt bei fehlender Grundlage den Grund im Klartext', () => {
    const m = baue(bezug({
      ergebnis: {
        zustand: 'nicht_berechenbar', grund: 'kein Eingangsdatum in D_AAE/D_XTE',
        haltedatumQuelle: 'unbekannt',
      },
    }));
    expect(m.urteil).toBe('Frist nicht berechenbar');
    expect(m.zusatz).toBe('kein Eingangsdatum in D_AAE/D_XTE');
    expect(m.punkt).toBeNull();
  });
});

describe('baueKopfModell — die drei Fakten', () => {
  const ids = (lage: MeilensteinLage, w = waechter()): string[] =>
    baue(bezug(), lage, w).fakten.map(f => f.id);

  it('zeigt Bewegung, Meilensteine und Zuständigkeit', () => {
    expect(ids(LAGE)).toEqual(['bewegung', 'meilensteine', 'liegtBei']);
  });

  it('lässt die Meilenstein-Kachel ganz weg, wo es keinen Plan geben KANN', () => {
    expect(ids({ art: 'flagAus' })).toEqual(['bewegung', 'liegtBei']);
    expect(ids({ art: 'ohneVerbund' })).toEqual(['bewegung', 'liegtBei']);
  });

  it('behält die Kachel, wo ein Plan fehlt — mit dem Grund im Tooltip', () => {
    const f = baue(bezug(), { art: 'ohnePlan' }).fakten.find(x => x.id === 'meilensteine');
    expect(f?.wert).toBe('—');
    expect(f?.titel).toContain('Kein freigegebener');
  });

  it('sagt ohne Wächter „nicht prüfbar" — nie „ok"', () => {
    const m = baueKopfModell({
      bezug: bezug(), stichtag: HEUTE, waechter: null, lage: LAGE,
      befund: findeBlocker(LAGE, HEUTE),
      liegtBei: liegtBei({ waechter: null, vorgangssystemAn: true, aufgabe: OHNE_AUFGABE }),
    });
    const bewegung = m.fakten.find(f => f.id === 'bewegung');
    expect(bewegung?.wert).toBe('nicht prüfbar');
    expect(bewegung?.farbe).toBeNull();
  });

  it('nennt bei der Bewegung die Grenze aus dem Statuskatalog', () => {
    const f = baue(bezug()).fakten.find(x => x.id === 'bewegung');
    expect(f?.wert).toBe('vor 4 T');
    expect(f?.zusatz).toBe('Grenze 14 T');
  });

  it('markiert eine genäherte letzte Aktivität im Tooltip', () => {
    const f = baue(bezug(), LAGE, waechter({ belegt: false })).fakten
      .find(x => x.id === 'bewegung');
    expect(f?.titel).toContain('genähert');
  });
});

describe('baueKopfModell — an einer Verbund-Zeile nennt die Karte ihren Bezug', () => {
  /**
   * Der gemessene Widerspruch: die Frist-ZELLE einer Verbund-Zeile zeigt die
   * dringendste Uhr über alle Teilvorhaben (`criticalFristErgebnis`), die
   * Kopfkarte desselben Klicks urteilt über den VERBUND (dominanter Status).
   * Beides ist für sich richtig; unerklärt nebeneinander sagte die Zelle „läuft"
   * und die Karte „nicht berechenbar". Der Tooltip der Zelle nennt seinen Bezug
   * längst („Dringendste Frist im Verbund — …") — die Karte tut es jetzt auch.
   */
  const w = waechter();
  const verbundKarte = (tvs: number | null) => baueKopfModell({
    bezug: bezug({ ergebnis: frist({ zustand: 'nicht_berechenbar', grund: 'kein Eingang' }) }),
    stichtag: HEUTE,
    waechter: w,
    lage: LAGE,
    befund: findeBlocker(LAGE, HEUTE),
    liegtBei: liegtBei({ waechter: w, vorgangssystemAn: true, aufgabe: OHNE_AUFGABE }),
    verbundTvs: tvs,
  });

  it('sagt „Wo der Verbund steht" und nennt die Teilvorhaben-Zahl', () => {
    const m = verbundKarte(3);
    expect(m.eyebrow).toBe('Wo der Verbund steht');
    expect(m.zusatz).toContain('Gilt für den Verbund');
    expect(m.zusatz).toContain('3 Teilvorhaben');
  });

  it('an einer TV-Zeile bleibt alles wie gehabt — kein Zusatz, kein neues Wort', () => {
    const m = verbundKarte(null);
    expect(m.eyebrow).toBe('Wo der Antrag steht');
    expect(m.zusatz).not.toContain('Gilt für den Verbund');
  });

  it('ein Ein-TV-„Verbund" bekommt den Zusatz NICHT — da gibt es nichts zu wählen', () => {
    const m = verbundKarte(1);
    expect(m.eyebrow).toBe('Wo der Antrag steht');
    expect(m.zusatz).not.toContain('Gilt für den Verbund');
  });
});
