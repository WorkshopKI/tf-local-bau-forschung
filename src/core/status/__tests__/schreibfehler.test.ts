/**
 * Schreibfehler des Quellsystems — **beim Lesen** aufgelöst, nie geschrieben.
 *
 * Drei Zusagen tragen den Fall `VN gegrüft`:
 *
 * 1. Der Rohwert löst auf wie der richtige Wortlaut — Code, Phase, Kategorie
 *    und Beschriftung greifen, sonst fiele der Vorgang aus Gruppierungen.
 * 2. Der Rohwert bleibt **sichtbar**. Wer „VN geprüft" liest und im Fachsystem
 *    danach sucht, findet nichts; der Zusatz nennt, wonach zu suchen ist.
 * 3. Nichts überschreibt eine amtliche Schreibweise. Ein Schreibfehler, der
 *    zufällig auf einen anderen Code passte, dürfte ihn nicht kapern.
 */
import { describe, expect, it } from 'vitest';
import {
  SCHREIBFEHLER, normalisiereSchreibfehler, quellsystemZusatz, schreibfehlerFuer,
} from '../schreibfehler';
import { STATUS_CODE_KATALOG, findeStatusCode, statusCodeEintrag } from '../status-codes';
import { normalisiereWert } from '../typen';
import { statusKurzLabel, statusLabel, statusLabelMitQuelle } from '@/core/utils/status-wert-labels';

describe('Der Katalog bleibt Fremddatum', () => {
  it('trägt keinen der Schreibfehler als amtliche Schreibweise', () => {
    // Der Grund, warum das eine eigene Datei ist: in `varianten` wäre ein
    // Tippfehler des Quellsystems von einer amtlichen Variante nicht mehr zu
    // unterscheiden.
    const amtlich = new Set(
      STATUS_CODE_KATALOG.flatMap(e => [e.text, ...e.varianten]).map(normalisiereWert),
    );
    for (const s of SCHREIBFEHLER) {
      expect(amtlich.has(normalisiereWert(s.roh)), s.roh).toBe(false);
    }
  });

  it('nennt zu jedem Schreibfehler einen Code, den es gibt, und den Wortlaut dazu', () => {
    for (const s of SCHREIBFEHLER) {
      const e = statusCodeEintrag(s.code);
      expect(e, `Code ${s.code}`).not.toBeNull();
      expect(e!.text, s.roh).toBe(s.gemeint);
    }
  });

  it('belegt jeden Eintrag mit einer Frage-Id', () => {
    for (const s of SCHREIBFEHLER) {
      expect(s.beleg.frageId).not.toBe('');
      expect(s.beleg.datum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('Auflösung beim Lesen', () => {
  it('findet den Code des gemeinten Wortlauts', () => {
    const treffer = findeStatusCode('VN gegrüft');
    expect(treffer?.eintrag.code).toBe(97);
    expect(treffer?.art).toBe('exakt');
  });

  it('beschriftet wie der richtige Wortlaut — lang und kurz', () => {
    expect(statusLabel('VN gegrüft')).toBe(statusLabel('VN geprüft'));
    expect(statusKurzLabel('VN gegrüft')).toBe(statusKurzLabel('VN geprüft'));
  });

  it('nennt den Rohwert im vollen Bezeichner', () => {
    expect(statusLabelMitQuelle('VN gegrüft')).toBe('VN geprüft (im Quellsystem: „VN gegrüft“)');
    // Wo nichts normalisiert wurde, steht auch nichts da.
    expect(statusLabelMitQuelle('VN geprüft')).toBe('VN geprüft');
    expect(quellsystemZusatz('VN geprüft')).toBeNull();
  });

  it('lässt alles andere unangetastet', () => {
    expect(normalisiereSchreibfehler('bewilligt')).toBe('bewilligt');
    expect(schreibfehlerFuer('bewilligt')).toBeNull();
    expect(schreibfehlerFuer(null)).toBeNull();
    expect(schreibfehlerFuer(42)).toBeNull();
  });

  it('greift unabhängig von Schreibweise und Leerraum', () => {
    expect(schreibfehlerFuer('  VN GEGRÜFT ')?.gemeint).toBe('VN geprüft');
  });
});
