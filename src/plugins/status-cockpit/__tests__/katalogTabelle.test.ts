/**
 * Die Katalog-Tabelle: Zeilen-Modell und Export-Vertrag.
 *
 * Zwei Zusicherungen, die beim Blick auf den Bildschirm nicht auffallen:
 *
 * 1. **Sortiert wird nach dem Verfahren, nicht nach dem Alphabet.** Ein
 *    Verfahrensschritt-Rang, der aus dem Label entstünde, stellte
 *    „Abgeschlossen" vor „Eingang" — die Liste sähe sortiert aus und wäre
 *    unbrauchbar.
 * 2. **Der rohe CSV-Spaltenname bleibt im Export eine eigene Spalte.** In der
 *    Ansicht steht er seit v2.411 nur im Tooltip; ginge er auch im Export
 *    verloren, wäre im Termin nicht mehr belegbar, aus welcher Spalte ein
 *    Statuswert stammt.
 */
import { describe, it, expect } from 'vitest';
import { baueKatalogZeilen } from '../katalogZeilen';
import { baueKatalogSpalten } from '../katalogSpalten';
import { baueKatalogBlatt, exportSpalten } from '../katalogExport';
import type { StatusWertEintrag } from '@/core/status';

function wert(p: Partial<StatusWertEintrag> & { wert: string }): StatusWertEintrag {
  return {
    id: `status::${p.wert}`,
    feldId: 'status',
    label: undefined,
    kategorie: 'offen',
    prominenz: 'normal',
    aktiv: true,
    unkuratiert: false,
    ...p,
  };
}

const KONTEXT = {
  feldName: (id: string) => (id === 'status' ? 'TV-Status' : id),
  csvSpalte: (id: string) => (id === 'status' ? 'STATUS_TV' : '—'),
  phasen: undefined,
  vorkommen: new Map([['status::beantragt', 12]]),
  zuletzt: new Map([['status::beantragt', '2026-07-01']]),
  liegezeitVorschlag: new Map([[31, { median: 29, n: 40 }]]),
};

describe('baueKatalogZeilen', () => {
  it('löst Feldname, CSV-Spalte, Vorkommen und Vorschlag am Eintrag auf', () => {
    const [z] = baueKatalogZeilen([wert({ wert: 'beantragt', code: 31 })], KONTEXT);
    expect(z!.feldName).toBe('TV-Status');
    expect(z!.csvSpalte).toBe('STATUS_TV');
    expect(z!.vorkommen).toBe(12);
    expect(z!.zuletzt).toBe('2026-07-01');
    expect(z!.vorschlag).toEqual({ median: 29, n: 40 });
  });

  it('sortiert Verfahrensschritte nach dem Verfahren, nicht alphabetisch', () => {
    // 31 „beantragt" steht im Eingang, 99 „Schlussvermerk" in Abgeschlossen.
    // Alphabetisch käme „Abgeschlossen" zuerst — der Rang dreht das um.
    const zeilen = baueKatalogZeilen(
      [wert({ wert: 'schlussvermerk', code: 99 }), wert({ wert: 'beantragt', code: 31 })],
      KONTEXT,
    );
    const [spaet, frueh] = zeilen;
    expect(frueh!.phaseRang).toBeLessThan(spaet!.phaseRang);
    expect(frueh!.phaseLabel.localeCompare(spaet!.phaseLabel)).toBeGreaterThan(0);
  });

  it('Werte ohne amtlichen Code bekommen „—" und den letzten Rang', () => {
    const [z] = baueKatalogZeilen([wert({ wert: 'irgendwas-neues', unkuratiert: true })], KONTEXT);
    expect(z!.phaseLabel).toBe('—');
    expect(z!.phaseRang).toBeGreaterThan(100);
  });

  it('die wirksame Arbeitsliste kommt aus dem Schritt, nicht aus dem gepflegten Feld', () => {
    // Die Fassung führt für 36 noch „nachforderung"; wirksam ist seit v2.411
    // die Vorgabe der Vollständigkeit (Pitfall #50, kategorie-ableitung.ts).
    const [z] = baueKatalogZeilen(
      [wert({ wert: 'nl eingegangen', code: 36, kategorie: 'nachforderung' })], KONTEXT,
    );
    expect(z!.effektiveKategorie).toBe('offen');
    expect(z!.w.kategorie).toBe('nachforderung');
  });
});

describe('Katalog-Export', () => {
  const spalten = baueKatalogSpalten({
    zeigeZieltage: true, setWert: () => {}, setCodeWert: () => {}, setKurzLabel: () => {},
  });

  it('führt die rohe CSV-Spalte als eigene Spalte direkt hinter „Feld"', () => {
    const keys = exportSpalten(spalten).map(c => c.key);
    expect(keys.indexOf('csvSpalte')).toBe(keys.indexOf('feld') + 1);
    expect(spalten.map(c => c.key)).not.toContain('csvSpalte');
  });

  it('exportiert lesbare Werte statt Sortier-Ränge', () => {
    const zeilen = baueKatalogZeilen(
      [wert({ wert: 'beantragt', code: 31, zieltage: null })], KONTEXT,
    );
    const blatt = baueKatalogBlatt(zeilen, spalten);
    const feld = (label: string): string | number =>
      blatt.zeilen[0]![blatt.header.indexOf(label)]!;

    expect(feld('CSV-Spalte')).toBe('STATUS_TV');
    // Arbeitsliste/Verfahrensschritt sortieren über Zahlen — im Blatt stünde
    // sonst „0" statt „Zu bearbeiten".
    expect(feld('Arbeitsliste')).toBe('Zu bearbeiten');
    expect(typeof feld('Verfahrensschritt')).toBe('string');
    expect(feld('aktiv')).toBe('ja');
    // Leere Zieltage: im Sortierwert ein großer Sentinel, im Blatt nichts.
    expect(feld('Zieltage')).toBe('');
  });
});
