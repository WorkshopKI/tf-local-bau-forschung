/**
 * Der eingebaute Pfad der Status-Beschriftung — ohne Katalog-Snapshot, also
 * genau das, was prod sieht. Die Gleichheit beider Pfade misst
 * `core/status/__tests__/label-identitaet.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import {
  statusLabel, statusKurzLabel, statusKurzLabelMit,
} from '@/core/utils/status-wert-labels';
import { STATUS_CODE_KATALOG, KURZLABEL_MAX } from '@/core/status/status-codes';

describe('statusLabel — der volle Bezeichner', () => {
  it('gibt die amtliche Bezeichnung, auch wenn der Export eine Variante liefert', () => {
    expect(statusLabel('Ablehnung')).toBe('Ablehnung versandt');
    expect(statusLabel('Rücknahmeempfehlung')).toBe('Rücknahmeempfehlung versandt');
    expect(statusLabel('VN techn. geprüft')).toBe('VN technisch geprüft');
  });

  it('trifft unabhängig von Schreibweise und Rand-Leerzeichen', () => {
    expect(statusLabel('  BEWILLIGT ')).toBe('bewilligt');
  });

  it('lässt einen katalogfremden Wert stehen, statt etwas zu erfinden', () => {
    // Echter Fall aus dem Bestand: ein Tippfehler in der Quelle (7 Zeilen).
    expect(statusLabel('VN gepürft')).toBe('VN gepürft');
    expect(statusLabel('')).toBe('');
    expect(statusLabel(null)).toBe('');
    expect(statusLabel(42)).toBe('');
  });
});

describe('statusKurzLabel — die Kurzform', () => {
  it('kommt für jeden Katalog-Code aus der Auslieferung', () => {
    for (const e of STATUS_CODE_KATALOG) {
      for (const s of [e.text, ...e.varianten]) {
        expect(statusKurzLabelMit(s), `${e.code}: „${s}"`).toEqual({
          text: e.kurz, herkunft: 'katalog', gekuerzt: false,
        });
      }
    }
  });

  it('ersetzt die drei alten Hartcodierungen wortgleich, wo sie sich einig waren', () => {
    expect(statusKurzLabel('Rücknahmeempfehlung')).toBe('Rücknahmeempf.');
    expect(statusKurzLabel('VN techn. geprüft')).toBe('VN techn. gepr.');
    expect(statusKurzLabel('Schlussvermerk')).toBe('Schlussvermerk');
  });

  it('entscheidet die drei Divergenzen, ohne den Tippfehler zu übernehmen', () => {
    // suche/columns.tsx führte „Wiederspr. zur Ablehn." (22 Zeichen, Tippfehler)
    expect(statusKurzLabel('Widerspruch zur Ablehnung')).toBe('Widerspruch Abl.');
    // suche/columns.tsx + arbeitsvorrat.ts führten die 20-Zeichen-Fassung
    expect(statusKurzLabel('abgelehnt/zurückgezogen')).toBe('abgel./zurückgez.');
    // 19 Zeichen in beiden Kopien — gekürzt auf 17
    expect(statusKurzLabel('Bewilligungsentwurf VDI/VDE-IT')).toBe('Bewilligungsentw.');
  });

  it('trifft Code 72 unter BEIDEN Schreibweisen — die alte Map traf nur eine', () => {
    // Im Produktivbestand steht ausschließlich die Langform; `STATUS_LABELS`
    // war auf die Kurzform geschlüsselt und griff dort deshalb nie.
    expect(statusKurzLabel('Stellungnahme zur Rücknahmeempfehlung')).toBe('Stelln. zur RNE');
    expect(statusKurzLabel('Stellungnahme zur Rücknahmeempf.')).toBe('Stelln. zur RNE');
  });

  it('gibt den vier bisher labellosen Codes eine Kurzform', () => {
    expect(statusKurzLabel('Sonderstatus')).toBe('Sonderstatus');
    expect(statusKurzLabel('Skizze eingegangen')).toBe('Skizze eing.');
    expect(statusKurzLabel('assoziierter Partner')).toBe('Assoz. Partner');
    expect(statusKurzLabel('internationaler Partner')).toBe('Intl. Partner');
  });
});

describe('fehlendes Kurzlabel ist sichtbar unfertig, nicht heimlich ersetzt', () => {
  it('kürzt einen langen katalogfremden Bezeichner an der Wortgrenze mit „…"', () => {
    const r = statusKurzLabelMit('Wartet auf Rückmeldung der Fachabteilung');
    expect(r.herkunft).toBe('ohne');
    expect(r.gekuerzt).toBe(true);
    expect(r.text).toBe('Wartet auf…');
    expect(r.text.length).toBeLessThanOrEqual(KURZLABEL_MAX);
  });

  it('kürzt auch ein einzelnes überlanges Wort — hart, aber sichtbar', () => {
    const r = statusKurzLabelMit('Rücknahmeempfehlungsverfahren');
    expect(r.text).toBe('Rücknahmeempfehlu…');
    expect(r.text.length).toBe(KURZLABEL_MAX);
  });

  it('kürzt NICHT, was ohnehin passt — dann gibt es nichts zu kürzen', () => {
    const r = statusKurzLabelMit('VN gepürft');
    expect(r).toEqual({ text: 'VN gepürft', herkunft: 'ohne', gekuerzt: false });
  });

  it('lässt keine Satzzeichen vor dem Auslassungspunkt stehen', () => {
    expect(statusKurzLabelMit('Prüfung, kaufmännischer Teil offen').text).toBe('Prüfung…');
  });
});
