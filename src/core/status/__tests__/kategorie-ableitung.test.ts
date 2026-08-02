/**
 * **Ist die Ableitung richtig?** — der dauerhafte Guard der Fassaden-Speisung.
 *
 * Er hält die Kategorie jedes amtlichen Status-Codes gegen eine **von Hand
 * hingeschriebene** Wahrheitstabelle. Bewusst nicht aus der Ableitung berechnet:
 * ein Test, der dieselbe Regel noch einmal ausführt, prüft nur sich selbst.
 *
 * Er ist einer von dreien und beantwortet genau eine Frage:
 *
 * | Test | Frage |
 * |---|---|
 * | dieser | Ist die Ableitung richtig? |
 * | `byte-identitaet` | Liefert sie über beide Pfade (Snapshot / eingebaut) dasselbe? |
 * | `phasen-vergleich-golden` | Deckt sie sich mit der alten Welt, wo sie soll? (stirbt mit P6) |
 */
import { describe, it, expect } from 'vitest';
import {
  kategorieFuerCode, baueFoerderKategorieEintraege, baueFoerderSeedEintraege,
  codeFuerStatusText, zahPhaseFuerStatusText,
  NACHFORDERUNG_CODES, BEWILLIGT_CODE,
} from '../kategorie-ableitung';
import { STATUS_CODE_KATALOG } from '../status-codes';
import { SEED_CODE_ZU_ZAH_PHASE, SEED_MARKER_CODES } from '../zah-phasen';
import { getStatusCategory, getCanonicalStatusEntries } from '@/core/utils/status-canonical';
import type { StatusCategory } from '../typen';
import { KATEGORIE_DELTAS } from './fixtures/phasen-vergleich-muster';

/**
 * Alle 30 amtlichen Codes mit ihrer erwarteten Kategorie — von Hand geführt.
 * Ändert die Auslieferung den Phasen-Schnitt, muss diese Tabelle mitgeführt
 * werden; genau das ist der Zweck.
 */
const WAHRHEIT: ReadonlyArray<readonly [number, StatusCategory]> = [
  [11, 'offen'],          // Skizze eingegangen
  [29, 'sonstige'],       // Irrläufer          — Marker
  [31, 'offen'],          // beantragt
  [32, 'entscheidung'],   // ablehnungsreif
  [33, 'offen'],          // unvollständig
  [34, 'offen'],          // bearbeitungsreif
  [35, 'nachforderung'],  // NF gestellt
  [36, 'nachforderung'],  // NL eingegangen
  [37, 'nachforderung'],  // keine weiteren NF
  [38, 'in_pruefung'],    // techn geprüft
  [39, 'in_pruefung'],    // kaufm geprüft
  [40, 'in_pruefung'],    // Gutachten fertig
  [50, 'entscheidung'],   // Bewilligungsentwurf VDI/VDE-IT
  [51, 'entscheidung'],   // bewilligungsreif
  [59, 'bewilligt'],      // bewilligt          — Ausnahme in der Phase Begleitung
  [70, 'entscheidung'],   // Ablehnung versandt
  [71, 'entscheidung'],   // Rücknahmeempfehlung versandt
  [72, 'entscheidung'],   // Stellungnahme zur Rücknahmeempfehlung
  [73, 'abgeschlossen'],  // abgelehnt/zurückgezogen
  [75, 'entscheidung'],   // Widerspruch zur Ablehnung
  [88, 'sonstige'],       // Sonderstatus       — Marker
  [89, 'begleitung'],     // Anhörung zum Widerruf
  [90, 'abgeschlossen'],  // abgebrochen
  [91, 'abgeschlossen'],  // beendet
  [92, 'begleitung'],     // Widerruf
  [93, 'sonstige'],       // assoziierter Partner    — Marker
  [94, 'sonstige'],       // internationaler Partner — Marker
  [95, 'begleitung'],     // VN technisch geprüft
  [97, 'begleitung'],     // VN geprüft
  [99, 'abgeschlossen'],  // Schlussvermerk
];

describe('kategorieFuerCode — die Wahrheitstabelle', () => {
  it.each(WAHRHEIT)('Code %i → %s', (code, erwartet) => {
    expect(kategorieFuerCode(code)).toBe(erwartet);
  });

  it('deckt jeden Katalog-Code ab und keinen darüber hinaus', () => {
    expect(WAHRHEIT.map(([c]) => c).sort((a, b) => a - b))
      .toEqual(STATUS_CODE_KATALOG.map(e => e.code).sort((a, b) => a - b));
  });

  it('ein unbekannter Code ist `sonstige` — nicht geraten', () => {
    expect(kategorieFuerCode(4711)).toBe('sonstige');
  });
});

describe('Die drei Ausnahmen hängen am Code, nicht an der Phase', () => {
  it('35–37 sind Nachforderung, obwohl sie in der Vollständigkeit liegen', () => {
    for (const code of NACHFORDERUNG_CODES) {
      expect(SEED_CODE_ZU_ZAH_PHASE.get(code)).toBe('vollstaendigkeit');
      expect(kategorieFuerCode(code)).toBe('nachforderung');
    }
    // 33 und 34 liegen in derselben Phase und sind es NICHT.
    for (const code of [33, 34]) {
      expect(SEED_CODE_ZU_ZAH_PHASE.get(code)).toBe('vollstaendigkeit');
      expect(kategorieFuerCode(code)).toBe('offen');
    }
  });

  it('59 ist `bewilligt`, der Rest der Begleitphase ist `begleitung`', () => {
    expect(SEED_CODE_ZU_ZAH_PHASE.get(BEWILLIGT_CODE)).toBe('begleitung');
    expect(kategorieFuerCode(BEWILLIGT_CODE)).toBe('bewilligt');
    for (const code of [89, 92, 95, 97]) expect(kategorieFuerCode(code)).toBe('begleitung');
  });

  it('Marker sind `sonstige` — bewusst ohne Phase, nicht vergessen', () => {
    for (const code of SEED_MARKER_CODES) {
      expect(SEED_CODE_ZU_ZAH_PHASE.has(code)).toBe(false);
      expect(kategorieFuerCode(code)).toBe('sonstige');
    }
  });

  it('jeder Katalog-Code hat entweder eine Phase oder ist Marker', () => {
    for (const e of STATUS_CODE_KATALOG) {
      const hatPhase = SEED_CODE_ZU_ZAH_PHASE.has(e.code);
      const istMarker = SEED_MARKER_CODES.has(e.code);
      expect(hatPhase !== istMarker, `Code ${e.code}`).toBe(true);
    }
    expect(SEED_CODE_ZU_ZAH_PHASE.size + SEED_MARKER_CODES.size)
      .toBe(STATUS_CODE_KATALOG.length);
  });
});

describe('Die Nachschlage-Schlüssel', () => {
  const eintraege = baueFoerderKategorieEintraege();

  it('führt jede amtliche Schreibweise UND jede Variante', () => {
    const keys = new Set(eintraege.map(([k]) => k));
    for (const e of STATUS_CODE_KATALOG) {
      for (const s of [e.text, ...e.varianten]) {
        expect(keys.has(s.trim().toLowerCase()), `${e.code}: „${s}"`).toBe(true);
      }
    }
  });

  it('sind eindeutig, getrimmt, kleingeschrieben und NFC-normalisiert', () => {
    const keys = eintraege.map(([k]) => k);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) {
      expect(k).toBe(k.trim());
      expect(k).toBe(k.toLowerCase());
      // Sonst fände `getStatusCategory` sie nie — die Fassade normalisiert beim
      // Nachschlagen nur trim + lowercase, nicht NFC.
      expect(k).toBe(k.normalize('NFC'));
    }
  });

  it('stehen in Code-Reihenfolge — deterministisch', () => {
    expect(JSON.stringify(baueFoerderKategorieEintraege()))
      .toBe(JSON.stringify(baueFoerderKategorieEintraege()));
    const ersteCodes = eintraege.slice(0, 3).map(([k]) => k);
    expect(ersteCodes[0]).toBe('skizze eingegangen'); // Code 11 zuerst
  });

  it('der Seed führt genau eine Zeile je Code — Varianten hängen am Eintrag', () => {
    const seedKeys = baueFoerderSeedEintraege().map(([k]) => k);
    expect(seedKeys).toHaveLength(STATUS_CODE_KATALOG.length);
    expect(new Set(seedKeys).size).toBe(seedKeys.length);
    // Sonst wären zwei Schreibweisen desselben Codes getrennt kuratierbar.
    expect(seedKeys.length).toBeLessThan(eintraege.length);
  });

  it('`getCanonicalStatusEntries` liefert Seed-Zeilen plus Bauantrag-Domäne', () => {
    const alle = getCanonicalStatusEntries();
    expect(alle.length).toBe(baueFoerderSeedEintraege().length + 11);
    expect(alle.map(([k]) => k)).toContain('genehmigt'); // Bauantrag bleibt
  });
});

describe('Die Kategorie-Deltas gegenüber der alten Handtabelle', () => {
  it('sind genau die sechs dokumentierten — ein siebtes fliegt auf', () => {
    // Die Liste ist abschließend. Wer die Ableitung ändert und hier nichts
    // ergänzt, ändert stillschweigend, wo Anträge in den Arbeitslisten stehen.
    expect(KATEGORIE_DELTAS).toHaveLength(6);
    for (const d of KATEGORIE_DELTAS) {
      expect(getStatusCategory(d.statusRoh), d.statusRoh).toBe(d.neu);
      expect(kategorieFuerCode(d.code), `Code ${d.code}`).toBe(d.neu);
      expect(d.alt).not.toBe(d.neu);
    }
  });

  it('kein Delta bei den Schreibweisen, die im Bestand wirklich vorkommen — außer den dreien', () => {
    // Die übrigen drei (11/70/71) sind amtliche Texte, die der Export heute
    // nicht schreibt: die Lücke war da, nur unsichtbar.
    const imBestand = KATEGORIE_DELTAS.filter(d => d.anzahl.tv + d.anzahl.vb > 0);
    expect(imBestand.map(d => d.code).sort((a, b) => a - b)).toEqual([33, 36, 72]);
  });

  it('29 Irrläufer wird NICHT mitkorrigiert — die Asymmetrie zu 33 ist gewollt', () => {
    expect(getStatusCategory('Irrläufer')).toBe('sonstige');
    expect(getStatusCategory('unvollständig')).toBe('offen');
  });
});

describe('Die Hilfsfunktionen', () => {
  it('lösen Rohtext auf Code und Phase auf, über Text wie Variante', () => {
    expect(codeFuerStatusText('NF gestellt')).toBe(35);
    expect(codeFuerStatusText('Nachforderung gestellt')).toBe(35);
    expect(zahPhaseFuerStatusText('NF gestellt')).toBe('vollstaendigkeit');
    expect(zahPhaseFuerStatusText('VN techn. geprüft')).toBe('begleitung');
  });

  it('geben `null` statt zu raten', () => {
    expect(codeFuerStatusText('Wunschstatus')).toBeNull();
    expect(codeFuerStatusText(42)).toBeNull();
    expect(zahPhaseFuerStatusText('Wunschstatus')).toBeNull();
    // Marker: bekannt, aber bewusst ohne Phase.
    expect(codeFuerStatusText('Irrläufer')).toBe(29);
    expect(zahPhaseFuerStatusText('Irrläufer')).toBeNull();
  });
});
