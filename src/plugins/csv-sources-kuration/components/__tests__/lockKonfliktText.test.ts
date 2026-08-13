/**
 * Der Lock-Konflikt-Text muss beschreiben, was WIRKLICH der Fall ist.
 *
 * Zwei Aussagen stimmten nicht:
 *
 * 1. `besitz: 'eigener-tab'` liefert `acquireBuildLock` NUR, wenn ein zweiter
 *    Flow in DIESEM Fenster den Lock JETZT hält — ein echtes Überbleibsel wird
 *    kommentarlos übernommen und erzeugt gar keinen Konflikt. Der Text
 *    behauptete das Gegenteil („aus einem früheren Lauf … läuft in 2-3 Min von
 *    selbst ab") und übernahm ohne Rückfrage (`bestaetigung: null`), also ohne
 *    `window.confirm`. Erreichbar u.a. während des Embedding-Korpus-Builds (bis
 *    ~47 Min, Banner voll bedienbar): der zuerst fertige Lauf löscht die
 *    Lock-Datei, der zweite läuft ungeschützt gegen andere Rechner weiter.
 * 2. „Bitte in 2-3 Min erneut versuchen" gilt nur für die CSV-Import-Stufe
 *    (`CSV_IMPORT_STALE_HEARTBEAT_MS` = 3 Min). Jede andere Stufe verfällt erst
 *    nach 2 Stunden — die Zusage war genau dort falsch, wo sie am meisten
 *    wehtat.
 */
import { describe, it, expect } from 'vitest';
import { beschreibeLockKonflikt } from '../lockKonfliktText';

describe('beschreibeLockKonflikt — eigener Tab', () => {
  const eigener = { besitz: 'eigener-tab' as const, blockingKurator: 'ich', ageMinutes: 12 };

  it('beschreibt einen LAUFENDEN Vorgang, kein Überbleibsel', () => {
    const a = beschreibeLockKonflikt(eigener);
    expect(a.vorText).toMatch(/läuft seit 12 Min bereits/);
    expect(a.vorText).not.toMatch(/früheren Lauf/);
    expect(a.vorText).not.toMatch(/von selbst ab/);
  });

  it('fragt vor dem Übernehmen nach', () => {
    expect(beschreibeLockKonflikt(eigener).bestaetigung).not.toBeNull();
  });

  it('nennt in der Rückfrage die Folge des Übernehmens', () => {
    expect(beschreibeLockKonflikt(eigener).bestaetigung).toMatch(/ungeschützt/);
  });
});

describe('beschreibeLockKonflikt — Wartehinweis je Stufe', () => {
  const fremd = { besitz: 'fremd' as const, blockingKurator: 'THÜ', ageMinutes: 1 };

  it('verspricht die kurze Frist nur für den CSV-Import', () => {
    expect(beschreibeLockKonflikt({ ...fremd, stufe: 'csv-import' }).nachText)
      .toMatch(/in 3 Min erneut/);
  });

  it('sagt bei einem lang laufenden Vorgang die Wahrheit', () => {
    const a = beschreibeLockKonflikt({ ...fremd, stufe: 'embedding-build' });
    expect(a.nachText).toMatch(/2 h/);
    expect(a.nachText).not.toMatch(/3 Min/);
  });

  it('ohne bekannte Stufe wird nichts Kurzes versprochen', () => {
    expect(beschreibeLockKonflikt(fremd).nachText).toMatch(/2 h/);
  });
});
