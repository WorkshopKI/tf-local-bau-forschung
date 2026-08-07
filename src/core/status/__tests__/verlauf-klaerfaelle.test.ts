/**
 * Was von der Zuarbeit übrigbleibt, wenn C16 die Regelquelle wird.
 *
 * Der Vergleich läuft über ALLE Programme: die Zuarbeit schlägt nach (Kürzel,
 * Projektform), C16 nach (Programm, Kürzel). Ein Klärfall entsteht erst, wenn
 * C16 nirgends eine Zeile führt, die das Kürzel auf der behaupteten Ebene
 * bewegt — die engere Frage wäre eine über die Datenlage des Exports.
 */
import { describe, it, expect } from 'vitest';
import { klaerfaelleAusQuellen } from '@/core/status/verlauf/klaerfaelle';
import { parseTriggerZeile } from '@/core/status/trigger-parser';
import { KUERZEL_TRIGGER_REGELN, type KuerzelTriggerRegel } from '@/core/status/kuerzel-trigger.data';
import type { TriggerZeile } from '@/core/status/typen';

const z = (
  kuerzel: string, parameter: string, programm = '76',
  prozedur = 'TRG_TVs_Status_TV_VB',
): TriggerZeile => parseTriggerZeile({ programm, kuerzel, folge: 1, prozedur, parameter });

const regel = (over: Partial<KuerzelTriggerRegel> = {}): KuerzelTriggerRegel => ({
  kuerzel: 'AAE', projektform: 'NW', scope: 'tv',
  zielStatus: { roh: 'beantragt', code: 31, aufloesbar: true },
  benachrichtigt: [], original: 'Stw TV auf beantragt',
  quelle: 'zuarbeit', aktiv: false,
  ...over,
});

describe('klaerfaelleAusQuellen', () => {
  it('meldet nichts, wenn C16 dasselbe Kürzel auf derselben Ebene führt', () => {
    expect(klaerfaelleAusQuellen([regel()], [z('AAE', '<59||||||31|')])).toEqual([]);
  });

  it('findet das Kürzel auch in einer ANDEREN Richtlinie — verglichen wird über alle', () => {
    expect(klaerfaelleAusQuellen([regel()], [z('AAE', '<59||||||31|', '131')])).toEqual([]);
  });

  it('meldet, wenn C16 das Kürzel gar nicht führt', () => {
    const fall = klaerfaelleAusQuellen([regel()], [z('ABB', '<59||||||59|')]);
    expect(fall).toHaveLength(1);
    expect(fall[0]?.kuerzel).toBe('AAE');
    expect(fall[0]?.ebenen).toEqual(['tv']);
    expect(fall[0]?.grund).toContain('im Fachsystemexport (C16) nicht enthalten');
  });

  it('meldet, wenn C16 es führt — aber auf der anderen Ebene', () => {
    // Die Zuarbeit sagt „setzt den Verbundstatus", C16 setzt nur den TV-Status.
    const fall = klaerfaelleAusQuellen(
      [regel({ scope: 'verbund' })], [z('AAE', '<59||||||31|')],
    );
    expect(fall).toHaveLength(1);
    expect(fall[0]?.ebenen).toEqual(['verbund']);
  });

  it('lässt eine `tv+verbund`-Regel durch, sobald EINE der beiden Ebenen gedeckt ist', () => {
    // Teildeckung ist keine Lücke: der Fall gehört in die Fachabstimmung über
    // die Wirkungsebene, nicht in die Liste „C16 kennt es nicht".
    expect(klaerfaelleAusQuellen(
      [regel({ scope: 'tv+verbund' })], [z('AAE', '<59||||||31|')],
    )).toEqual([]);
  });

  it('behandelt `scope: null` als „irgendeine Ebene genügt"', () => {
    // Die Zuarbeit sagt nicht, welche Ebene — dann kann sie C16 auch nicht
    // widersprechen. Nur wenn C16 GAR nichts führt, bleibt ein Klärfall.
    expect(klaerfaelleAusQuellen(
      [regel({ scope: null })], [z('AAE', '<59|||||||31')],
    )).toEqual([]);
    const fall = klaerfaelleAusQuellen([regel({ scope: null })], []);
    expect(fall[0]?.ebenen).toEqual([]);
    expect(fall[0]?.grund).toContain('lässt offen');
  });

  it('übergeht Regeln ohne Zielstatus — eine Benachrichtigung widerspricht nichts', () => {
    const nurMail = regel({ zielStatus: undefined, benachrichtigt: ['AB'] });
    expect(klaerfaelleAusQuellen([nurMail], [])).toEqual([]);
  });

  it('nimmt den Wortlaut der Zuarbeit mit, inklusive Tippfehler', () => {
    const fall = klaerfaelleAusQuellen(
      [regel({ zielStatus: { roh: 'bewilligungseif', code: null, aufloesbar: false } })], [],
    );
    expect(fall[0]?.zielRoh).toBe('bewilligungseif');
    expect(fall[0]?.zielCode).toBeNull();
  });

  it('erklärt ohne C16-Tabelle JEDE Regel mit Zielstatus zum Klärfall', () => {
    // Der Extremfall als Ankerwert: 41 Regeln, davon tragen 41 einen Zielstatus.
    const alle = klaerfaelleAusQuellen(KUERZEL_TRIGGER_REGELN, []);
    expect(alle.length).toBe(KUERZEL_TRIGGER_REGELN.filter(r => r.zielStatus).length);
    expect(alle.every(k => k.original.length > 0)).toBe(true);
  });
});
