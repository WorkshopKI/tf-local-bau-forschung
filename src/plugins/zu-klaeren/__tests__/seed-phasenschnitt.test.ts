/**
 * Was diese Datei festnagelt:
 *
 * 1. Die 41 Punkte entstehen AUS dem Katalog — kein Code fehlt, keiner doppelt.
 *    Eine abgeschriebene Tabelle würde beim ersten neuen Statuscode driften.
 * 2. Die vier Marker-Codes tragen ausdrücklich „ohne Phase", nicht „vergessen".
 * 3. Die Reihenfolge folgt dem Verfahren, die Marker stehen daneben.
 * 4. Jede Grundsatzfrage trägt ihre Begründung — ohne sie ist sie eine Behauptung.
 * 5. Keine Punkt-Id entsteht aus einer Position, und jede je vergebene alte Id
 *    findet ihr heutiges Gegenstück (`ALT_PUNKT_IDS`).
 */
import { describe, it, expect } from 'vitest';
import {
  STATUS_CODE_KATALOG, SEED_CODE_ZU_ZAH_PHASE, SEED_MARKER_CODES, ZAH_PHASEN_REIHENFOLGE,
} from '@/core/status';
import { ALT_PUNKT_IDS, bauePunkte, PHASENSCHNITT } from '@/plugins/zu-klaeren/seed-phasenschnitt';
import { OHNE_PHASE } from '@/plugins/zu-klaeren/typen';

const punkte = bauePunkte();
const zeilen = punkte.filter(p => p.art === 'phasenzuordnung');
const fragen = punkte.filter(p => p.art === 'freitext');

describe('seed-phasenschnitt (die Punkte entstehen aus dem Katalog)', () => {
  it('liefert 30 Zeilen-Punkte und 11 Fragen-Punkte', () => {
    expect(zeilen).toHaveLength(30);
    expect(fragen).toHaveLength(11);
    expect(punkte).toHaveLength(41);
  });

  it('jeder Status-Code des Katalogs kommt genau einmal vor', () => {
    const ausPunkten = zeilen.map(p => p.code).sort((a, b) => (a ?? 0) - (b ?? 0));
    const ausKatalog = STATUS_CODE_KATALOG.map(e => e.code).sort((a, b) => a - b);
    expect(ausPunkten).toEqual(ausKatalog);
  });

  it('die Bezeichnung kommt aus dem Katalog, nicht aus einer Kopie', () => {
    for (const e of STATUS_CODE_KATALOG) {
      const p = zeilen.find(x => x.code === e.code);
      expect(p?.titel).toBe(`${e.code} · ${e.text}`);
    }
  });

  it('die vier Marker-Codes tragen ohne-phase', () => {
    for (const code of SEED_MARKER_CODES) {
      expect(zeilen.find(p => p.code === code)?.seedZiel).toBe(OHNE_PHASE);
    }
  });

  it('jeder Code mit Phase trägt genau die Phase des Auslieferungsschnitts', () => {
    for (const [code, phase] of SEED_CODE_ZU_ZAH_PHASE) {
      expect(zeilen.find(p => p.code === code)?.seedZiel).toBe(phase);
    }
  });

  it('die Reihenfolge folgt ZAH_PHASEN_REIHENFOLGE, Marker zuletzt', () => {
    const phasenFolge = zeilen.map(p => p.seedZiel);
    const ersteVorkommen = ZAH_PHASEN_REIHENFOLGE.map(ph => phasenFolge.indexOf(ph));
    expect(ersteVorkommen).toEqual([...ersteVorkommen].sort((a, b) => a - b));
    // Die Marker stehen geschlossen am Ende.
    const ersterMarker = phasenFolge.indexOf(OHNE_PHASE);
    expect(phasenFolge.slice(ersterMarker).every(z => z === OHNE_PHASE)).toBe(true);
  });

  it('Punkt-Ids kollidieren nicht und tragen die Klärung', () => {
    expect(new Set(punkte.map(p => p.id)).size).toBe(punkte.length);
    expect(punkte.every(p => p.klaerungId === PHASENSCHNITT.klaerungId)).toBe(true);
  });

  // Die Zusicherung, die den Defekt nicht wiederkehren lässt: eine Id aus der
  // Position hätte beim nächsten eingefügten Punkt alle Antworten dahinter
  // verschoben — in einer append-only Datei, die sich nicht korrigieren lässt.
  it('keine Frage-Id ist eine laufende Nummer', () => {
    for (const f of fragen) {
      expect(f.id, `Id sieht nach Position aus: ${f.id}`).not.toMatch(/^frage-\d+$/);
      expect(f.id).toMatch(/^frage-[a-z0-9-]+$/);
    }
  });

  it('jede alte Id zeigt auf eine Frage, die es heute gibt', () => {
    const ids = new Set(punkte.map(p => p.id));
    for (const [alt, neu] of ALT_PUNKT_IDS) {
      expect(ids.has(neu), `${alt} → ${neu} existiert nicht mehr`).toBe(true);
      expect(ids.has(alt), `${alt} darf nicht selbst wieder vergeben sein`).toBe(false);
    }
    // Alle sieben ursprünglichen Fragen sind abgedeckt — eine fehlende Zeile
    // macht ihre Antworten unsichtbar, ohne eine Meldung.
    expect([...ALT_PUNKT_IDS.keys()]).toEqual(
      ['frage-1', 'frage-2', 'frage-3', 'frage-4', 'frage-5', 'frage-6', 'frage-7'],
    );
  });

  it('jede Grundsatzfrage trägt eine Begründung', () => {
    for (const f of fragen) {
      expect(f.zusatz, `Frage ohne Begründung: ${f.titel}`).toBeTruthy();
      expect((f.zusatz ?? '').length).toBeGreaterThan(40);
    }
  });

  it('das Datum steht als Feld, nicht im Titel', () => {
    expect(PHASENSCHNITT.datum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(PHASENSCHNITT.titel).not.toMatch(/\d{4}/);
  });

  it('zwei Aufrufe liefern dasselbe (rein, keine Uhr)', () => {
    expect(bauePunkte()).toEqual(punkte);
  });
});
