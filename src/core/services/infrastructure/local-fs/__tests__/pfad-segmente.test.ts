/**
 * Stufe 1 des Pfad-Guards der Variante „local".
 *
 * Der Handler übersetzt Client-Pfade in echte `fs`-Operationen unterhalb fester
 * Wurzeln. Kommt hier ein Traversal durch, liest oder überschreibt die App
 * Dateien ausserhalb der Share-Kopie — deshalb steht die Abwehr in einem reinen
 * Modul mit eigenen Tests statt inline im Request-Handler.
 */

import { describe, it, expect } from 'vitest';
import {
  pruefeSegmente,
  fuegeSegmenteZusammen,
  kindPfad,
  istGueltigesSegment,
  normalisiereName,
} from '../pfad-segmente';

const NUL = String.fromCharCode(0);
const STEUERZEICHEN = String.fromCharCode(0x1f);

describe('pruefeSegmente: gültige Pfade', () => {
  it('zerlegt einen einfachen Pfad', () => {
    expect(pruefeSegmente('programm/antraege/snapshot').segmente)
      .toEqual(['programm', 'antraege', 'snapshot']);
  });

  it('behandelt den leeren Pfad als Wurzel', () => {
    for (const p of ['', '/', '//']) {
      const res = pruefeSegmente(p);
      expect(res.ok, p).toBe(true);
      expect(res.segmente, p).toEqual([]);
    }
  });

  it('schluckt führende, doppelte und abschliessende Slashes', () => {
    expect(pruefeSegmente('/a//b/').segmente).toEqual(['a', 'b']);
  });

  it('erlaubt Punkte, Ziffern, Bindestriche und Leerzeichen im Namen', () => {
    // Regressions-Guard: eine frühere Fassung prüfte mit dem Zeichen-RANGE
    // `[<NUL>-:]`, der Ziffern, '.', '-' und ' ' mit einschloss — damit war
    // praktisch JEDER echte Dateiname verboten (`9052-prjbsp.csv`, „DMS Vorlagen").
    const namen = [
      '9052-prjbsp-aitisigpt.csv',
      'antraege.delta.2026-06-13.jsonl',
      'DMS Vorlagen',
      '_intern',
      'auslastung.json.backup',
    ];
    for (const n of namen) {
      expect(pruefeSegmente(n).ok, n).toBe(true);
      expect(istGueltigesSegment(n), n).toBe(true);
    }
  });

  it('erlaubt Umlaute und normalisiert NFD → NFC', () => {
    // Der persönliche Ordner der Share-Kopie heisst real „Hübsch". Je nachdem,
    // wie kopiert wurde, liegt der Umlaut als NFD (u + U+0308) auf der Platte.
    const nfc = 'H\u00fcbsch';
    const nfd = 'Hu\u0308bsch';
    expect(nfc).not.toBe(nfd);

    expect(pruefeSegmente(nfd).segmente).toEqual([nfc]);
    expect(pruefeSegmente(nfc).segmente).toEqual([nfc]);
    expect(normalisiereName(nfd)).toBe(nfc);
  });
});

describe('pruefeSegmente: Traversal-Abwehr', () => {
  it('lehnt ".." und "." ab', () => {
    for (const p of ['..', '../x', 'a/../../etc', 'a/./b']) {
      const res = pruefeSegmente(p);
      expect(res.ok, p).toBe(false);
      expect(res.fehler, p).toBe('traversal');
    }
  });

  it('lehnt Backslash im Segment ab (sonst käme "..\\..\\x" als ein Segment durch)', () => {
    const res = pruefeSegmente('..\\..\\windows');
    expect(res.ok).toBe(false);
    expect(res.fehler).toBe('trenner-im-segment');
  });

  it('lehnt den Doppelpunkt ab (NTFS Alternate Data Stream + Laufwerksangabe)', () => {
    for (const p of ['datei.txt:versteckt', 'C:', 'C:/Windows']) {
      const res = pruefeSegmente(p);
      expect(res.ok, p).toBe(false);
      expect(res.fehler, p).toBe('steuerzeichen');
    }
  });

  it('lehnt NUL und Steuerzeichen ab', () => {
    for (const p of [`a${NUL}b`, `a${STEUERZEICHEN}b`]) {
      expect(pruefeSegmente(p).fehler).toBe('steuerzeichen');
    }
  });

  it('lehnt zu tiefe Pfade ab', () => {
    expect(pruefeSegmente(Array(65).fill('a').join('/')).fehler).toBe('zu-tief');
    expect(pruefeSegmente(Array(64).fill('a').join('/')).ok).toBe(true);
  });
});

describe('pruefeSegmente: Windows-Fallen', () => {
  it('lehnt Gerätenamen ab — auch mit Endung und in beliebiger Schreibweise', () => {
    // `getFileHandle('NUL')` öffnete sonst das Null-Device: atomicWrite meldete
    // Erfolg, ohne je etwas geschrieben zu haben.
    for (const n of ['NUL', 'nul', 'Nul.txt', 'CON', 'com1', 'LPT9.jsonl', 'aux', 'prn']) {
      const res = pruefeSegmente(n);
      expect(res.ok, n).toBe(false);
      expect(res.fehler, n).toBe('geraetename');
    }
  });

  it('lässt Namen durch, die nur mit einem Gerätenamen beginnen', () => {
    for (const n of ['console.json', 'nullwerte.csv', 'com10', 'auxiliar.txt']) {
      expect(pruefeSegmente(n).ok, n).toBe(true);
    }
  });

  it('lehnt abschliessende Punkte und Leerzeichen ab (stiller Windows-Alias)', () => {
    for (const n of ['datei.', 'datei ', 'ordner.']) {
      const res = pruefeSegmente(n);
      expect(res.ok, n).toBe(false);
      expect(res.fehler, n).toBe('trailing-punkt-oder-leerzeichen');
    }
  });
});

describe('istGueltigesSegment', () => {
  it('lehnt Pfade ab — die FSAPI erlaubt bei getFileHandle nur NAMEN', () => {
    expect(istGueltigesSegment('a/b')).toBe(false);
    expect(istGueltigesSegment('')).toBe(false);
    expect(istGueltigesSegment('..')).toBe(false);
    expect(istGueltigesSegment('datei.json')).toBe(true);
  });
});

describe('Hilfsfunktionen', () => {
  it('fuegeSegmenteZusammen ist die Umkehrung von pruefeSegmente', () => {
    const pfad = '_intern/skills/registry.json';
    expect(fuegeSegmenteZusammen(pruefeSegmente(pfad).segmente)).toBe(pfad);
  });

  it('kindPfad hängt an, ohne führenden Slash zu erzeugen', () => {
    expect(kindPfad('', 'programm')).toBe('programm');
    expect(kindPfad('programm', 'antraege')).toBe('programm/antraege');
  });
});
