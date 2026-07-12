/**
 * Tests für die Ampel-Schwellen-Parametrisierung (Phase 3):
 *  1. ÄQUIVALENZ-REGRESSION: getAmpelBucketMitSchwellen(Defaults) === getAmpelBucket
 *     über eine Status×Alter-Matrix — die AntragCard-4-Stufen-Logik (getEingangAmpel)
 *     bleibt fix, der parametrisierte Pfad ändert das Default-Verhalten NICHT.
 *  2. Angepasste Schwellen verschieben die Bucket-Grenzen.
 *  3. filtereAmpelQuickfilter (Pipeline-Schritt) + ampelSchwellenAusConfig.
 */
import { describe, expect, it } from 'vitest';
import type { AntragListItem } from '@/core/services/csv/types';
import {
  AMPEL_SCHWELLEN_DEFAULT,
  filtereAmpelQuickfilter,
  getAmpelBucket,
  getAmpelBucketMitSchwellen,
  getEingangAmpel,
} from '@/plugins/antraege/eingangAmpel';
import { ampelSchwellenAusConfig, defaultHomeWidgetConfig } from '../homeWidgetsStore';
import type { HomeWidgetConfig } from '../types';

function antragVorTagen(tage: number, extra?: Record<string, unknown>): AntragListItem {
  const datum = new Date(Date.now() - tage * 86_400_000).toISOString().slice(0, 10);
  return {
    aktenzeichen: `T${tage}`,
    programm_id: 'p1',
    status: 'beantragt',
    antragsdatum: datum,
    ...extra,
  } as AntragListItem;
}

describe('getAmpelBucketMitSchwellen — Äquivalenz mit Defaults (Regression)', () => {
  const ALTER = [0, 15, 29, 30, 31, 45, 60, 61, 89, 90, 91, 120, 365];

  it('liefert für offene Anträge exakt getAmpelBucket', () => {
    for (const tage of ALTER) {
      const a = antragVorTagen(tage);
      expect(getAmpelBucketMitSchwellen(a, AMPEL_SCHWELLEN_DEFAULT), `Alter ${tage} T`)
        .toBe(getAmpelBucket(a));
      // Default-Argument identisch
      expect(getAmpelBucketMitSchwellen(a)).toBe(getAmpelBucket(a));
    }
  });

  it('null-Semantik identisch: bewilligt / nicht-offen / ohne Datum', () => {
    const bewilligt = antragVorTagen(50, { bewilligung_datum: '2026-01-01' });
    const geschlossen = antragVorTagen(50, { status: 'abgelehnt' });
    const ohneDatum = { aktenzeichen: 'X', programm_id: 'p1', status: 'beantragt' } as AntragListItem;
    for (const a of [bewilligt, geschlossen, ohneDatum]) {
      expect(getAmpelBucketMitSchwellen(a)).toBe(getAmpelBucket(a));
      expect(getAmpelBucketMitSchwellen(a)).toBeNull();
    }
  });

  it('AntragCard-4-Stufen-Logik (getEingangAmpel) bleibt fix bei 30/60/90', () => {
    expect(getEingangAmpel(antragVorTagen(30))).toBe('gruen');
    expect(getEingangAmpel(antragVorTagen(31))).toBe('gelb');
    expect(getEingangAmpel(antragVorTagen(61))).toBe('orange');
    expect(getEingangAmpel(antragVorTagen(91))).toBe('rot');
  });
});

describe('getAmpelBucketMitSchwellen — angepasste Grenzen', () => {
  it('kritischSchwelle 75: 80 Tage → kritisch (statt warnung)', () => {
    const schwellen = { warnschwelleTage: 30, kritischSchwelleTage: 75 };
    expect(getAmpelBucketMitSchwellen(antragVorTagen(80), schwellen)).toBe('kritisch');
    expect(getAmpelBucketMitSchwellen(antragVorTagen(75), schwellen)).toBe('warnung');
    expect(getAmpelBucketMitSchwellen(antragVorTagen(30), schwellen)).toBe('frisch');
  });

  it('warnschwelle 14: 20 Tage → warnung (statt frisch)', () => {
    const schwellen = { warnschwelleTage: 14, kritischSchwelleTage: 90 };
    expect(getAmpelBucketMitSchwellen(antragVorTagen(20), schwellen)).toBe('warnung');
    expect(getAmpelBucketMitSchwellen(antragVorTagen(14), schwellen)).toBe('frisch');
  });
});

describe('filtereAmpelQuickfilter — Pipeline-Schritt', () => {
  it('null = Durchreichen; sonst Bucket-Filter mit den mitgetragenen Schwellen', () => {
    const liste = [antragVorTagen(10), antragVorTagen(50), antragVorTagen(120)];
    expect(filtereAmpelQuickfilter(liste, null)).toBe(liste);
    const kritisch = filtereAmpelQuickfilter(liste, { bucket: 'kritisch', schwellen: AMPEL_SCHWELLEN_DEFAULT });
    expect(kritisch.map(a => a.aktenzeichen)).toEqual(['T120']);
    // Mit angepasster Schwelle 75 fällt auch der 50-Tage-Antrag NICHT in kritisch,
    // aber der 120er bleibt; bei Schwelle 40 fiele der 50er hinein.
    const eng = filtereAmpelQuickfilter(liste, { bucket: 'kritisch', schwellen: { warnschwelleTage: 30, kritischSchwelleTage: 40 } });
    expect(eng.map(a => a.aktenzeichen)).toEqual(['T50', 'T120']);
  });
});

describe('ampelSchwellenAusConfig — gemeinsame Quelle Kopfzeile ↔ Widget', () => {
  it('Default-Config → Default-Schwellen; null-Config → Defaults', () => {
    expect(ampelSchwellenAusConfig(defaultHomeWidgetConfig())).toEqual(AMPEL_SCHWELLEN_DEFAULT);
    expect(ampelSchwellenAusConfig(null)).toEqual(AMPEL_SCHWELLEN_DEFAULT);
  });

  it('liest angepasste Werte, verwirft unplausible (warn >= kritisch)', () => {
    const cfg = defaultHomeWidgetConfig();
    const mit = (warn: number, kritisch: number): HomeWidgetConfig => ({
      ...cfg,
      widgets: cfg.widgets.map(w => (w.typ === 'antragseingang'
        ? { ...w, config: { art: 'ampel', warnschwelleTage: warn, kritischSchwelleTage: kritisch, zeilenKlickbar: true } }
        : w)),
    });
    expect(ampelSchwellenAusConfig(mit(30, 75))).toEqual({ warnschwelleTage: 30, kritischSchwelleTage: 75 });
    expect(ampelSchwellenAusConfig(mit(90, 30))).toEqual(AMPEL_SCHWELLEN_DEFAULT);
    expect(ampelSchwellenAusConfig(mit(0, 90))).toEqual(AMPEL_SCHWELLEN_DEFAULT);
  });
});
