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
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  kategorieFuerCode, phasenFuerKategorie, baueFoerderKategorieEintraege,
  baueFoerderSeedEintraege, codeFuerStatusText, zahPhaseFuerStatusText,
  CODE_ZU_ARBEITSLISTE, NACHFORDERUNG_CODES, BEWILLIGT_CODE,
} from '../kategorie-ableitung';
import { STATUS_CODE_KATALOG } from '../status-codes';
import {
  SEED_CODE_ZU_ZAH_PHASE, SEED_MARKER_CODES,
  setZahPhasenSnapshot, setCodePhasenSnapshot, resetZahPhasenSnapshotFuerTests,
} from '../zah-phasen';
import { getStatusCategory, getCanonicalStatusEntries } from '@/core/utils/status-canonical';
import type { StatusCategory } from '../typen';
import { KATEGORIE_DELTAS } from './fixtures/kategorie-deltas';

/**
 * Alle 30 amtlichen Codes mit ihrer erwarteten Arbeitsliste — von Hand geführt.
 * Ändert jemand `CODE_ZU_ARBEITSLISTE`, muss diese Tabelle mitgeführt werden;
 * genau das ist der Zweck.
 *
 * **Der Phasen-Schnitt steht hier nicht mehr dahinter** (seit v4.87). Bis dahin
 * fiel die Kategorie aus der `kategorieVorgabe` der Phase, und ein Umhängen im
 * Baum-Editor änderte sie mit — dieser Test hätte das gemeldet, aber erst nach
 * dem nächsten Seed-Wechsel, nie bei einer kuratierten Fassung. Jetzt gibt es
 * nur noch eine Quelle, und sie steht im Code.
 */
const WAHRHEIT: ReadonlyArray<readonly [number, StatusCategory]> = [
  [11, 'offen'],          // Skizze eingegangen
  [29, 'sonstige'],       // Irrläufer          — Marker
  [31, 'offen'],          // beantragt
  [32, 'in_pruefung'],    // ablehnungsreif     — die Ablehnung ist noch zu schreiben
  [33, 'offen'],          // unvollständig
  [34, 'offen'],          // bearbeitungsreif
  [35, 'nachforderung'],  // NF gestellt        — wartet auf den Antragsteller
  [36, 'offen'],          // NL eingegangen     — Nachlieferung ist DA, Ball bei uns
  [37, 'offen'],          // keine weiteren NF  — Zyklus zu, Antrag vollständig
  [38, 'in_pruefung'],    // techn geprüft
  [39, 'in_pruefung'],    // kaufm geprüft
  [40, 'in_pruefung'],    // Gutachten fertig
  [50, 'entscheidung'],   // Bewilligungsentwurf VDI/VDE-IT
  [51, 'entscheidung'],   // bewilligungsreif
  [59, 'bewilligt'],      // bewilligt          — die positive Entscheidung selbst
  [70, 'entscheidung'],   // Ablehnung versandt
  [71, 'entscheidung'],   // Rücknahmeempfehlung versandt
  [72, 'in_pruefung'],    // Stellungnahme zur RNE — eingegangen, wird bearbeitet
  [73, 'abgeschlossen'],  // abgelehnt/zurückgezogen
  [75, 'in_pruefung'],    // Widerspruch zur Ablehnung — eingegangen, wird bearbeitet
  [88, 'sonstige'],       // Sonderstatus       — Marker
  [89, 'begleitung'],     // Anhörung zum Widerruf
  [90, 'begleitung'],     // abgebrochen        — der Schlussvermerk steht noch aus
  [91, 'begleitung'],     // beendet            — der Schlussvermerk steht noch aus
  [92, 'begleitung'],     // Widerruf
  [93, 'sonstige'],       // assoziierter Partner    — Marker
  [94, 'sonstige'],       // internationaler Partner — Marker
  [95, 'begleitung'],     // VN technisch geprüft
  [97, 'begleitung'],     // VN geprüft
  [99, 'abgeschlossen'],  // Schlussvermerk     — der reguläre Endpunkt
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

describe('Die Arbeitsliste hängt am Code, NICHT an der Phase', () => {
  /**
   * Der eigentliche Guard der Umstellung von v4.87: dieselben Codes, einmal
   * unter dem ausgelieferten Schnitt und einmal unter einem völlig anderen.
   * Vorher wanderten dabei Anträge zwischen Arbeitslisten (v3.25: 448 Stück),
   * jetzt darf sich nichts rühren.
   */
  afterEach(() => resetZahPhasenSnapshotFuerTests());

  it('ein anderer Phasen-Zuschnitt ändert KEINE einzige Arbeitsliste', () => {
    const vorher = STATUS_CODE_KATALOG.map(e => [e.code, kategorieFuerCode(e.code)] as const);

    // Der Extremfall: EINE Phase für alles, alle Codes hängen an ihr.
    setZahPhasenSnapshot([{ id: 'alles', label: 'Alles', reihenfolge: 10 }]);
    setCodePhasenSnapshot({
      codeZuPhase: new Map(STATUS_CODE_KATALOG.map(e => [e.code, 'alles'])),
      markerCodes: new Set(),
    });

    const nachher = STATUS_CODE_KATALOG.map(e => [e.code, kategorieFuerCode(e.code)] as const);
    expect(nachher).toEqual(vorher);
  });

  it('35 wartet auf den Antragsteller — unabhängig davon, wo er im Verfahren steht', () => {
    for (const code of NACHFORDERUNG_CODES) {
      expect(kategorieFuerCode(code)).toBe('nachforderung');
    }
    // Die übrigen Codes desselben Zyklus sind es NICHT — auch 36 und 37 nicht:
    // bei ihnen liegt der Ball wieder bei der Behörde (v2.411). Solange die
    // Kategorie „Nachforderung" hieß, war ihre Bündelung mit 35 vertretbar;
    // unter „Wartet auf Antragsteller" wäre sie eine falsche Zusage.
    for (const code of [33, 34, 36, 37]) expect(kategorieFuerCode(code)).toBe('offen');
  });

  it('59 ist `bewilligt`, der Rest der Begleitphase ist `begleitung`', () => {
    expect(kategorieFuerCode(BEWILLIGT_CODE)).toBe('bewilligt');
    for (const code of [89, 92, 95, 97]) expect(kategorieFuerCode(code)).toBe('begleitung');
  });

  it('Marker sind `sonstige` — sie stehen in der Tabelle gar nicht', () => {
    for (const code of SEED_MARKER_CODES) {
      expect(CODE_ZU_ARBEITSLISTE.has(code)).toBe(false);
      expect(kategorieFuerCode(code)).toBe('sonstige');
    }
  });

  it('jeder Katalog-Code trägt eine Arbeitsliste oder ist Marker', () => {
    for (const e of STATUS_CODE_KATALOG) {
      const hatArbeitsliste = CODE_ZU_ARBEITSLISTE.has(e.code);
      const istMarker = SEED_MARKER_CODES.has(e.code);
      expect(hatArbeitsliste !== istMarker, `Code ${e.code}`).toBe(true);
    }
    expect(CODE_ZU_ARBEITSLISTE.size + SEED_MARKER_CODES.size)
      .toBe(STATUS_CODE_KATALOG.length);
  });

  it('der ausgelieferte Schnitt führt dieselben Codes wie die Arbeitslisten-Tabelle', () => {
    // Kein Zwang, aber ein Fehlstand-Melder: ein Code ohne Phase wäre in der
    // Verfahrensleiste unsichtbar, einer ohne Arbeitsliste in keinem Reiter.
    expect([...SEED_CODE_ZU_ZAH_PHASE.keys()].sort((a, b) => a - b))
      .toEqual([...CODE_ZU_ARBEITSLISTE.keys()].sort((a, b) => a - b));
  });
});

describe('phasenFuerKategorie — die Rückrichtung', () => {
  afterEach(() => resetZahPhasenSnapshotFuerTests());

  it('nennt die Schritte des GELTENDEN Schnitts, in Anzeige-Reihenfolge', () => {
    // Auslieferung: 33–37 liegen in „Vollständigkeit", 11/31 in „Eingang" —
    // beide tragen Codes der Arbeitsliste `offen`.
    expect(phasenFuerKategorie('offen')).toEqual(['eingang', 'vollstaendigkeit']);
    expect(phasenFuerKategorie('in_pruefung')).toEqual(['pruefung', 'entscheidung']);
    expect(phasenFuerKategorie('bewilligt')).toEqual(['begleitung']);
  });

  it('folgt einem kuratierten Schnitt, statt eine Vorgabe abzulesen', () => {
    setZahPhasenSnapshot([
      { id: 'a', label: 'A', reihenfolge: 10 },
      { id: 'b', label: 'B', reihenfolge: 20 },
    ]);
    setCodePhasenSnapshot({
      codeZuPhase: new Map([[35, 'b'], [11, 'a']]),
      markerCodes: new Set(),
    });
    expect(phasenFuerKategorie('nachforderung')).toEqual(['b']);
    expect(phasenFuerKategorie('offen')).toEqual(['a']);
  });

  it('ist leer, wenn kein Code des Schnitts diese Arbeitsliste trägt', () => {
    // `abgelehnt` ist vom Förder-Katalog unbesetzt — seit v4.87 endgültig.
    expect(phasenFuerKategorie('abgelehnt')).toEqual([]);
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

  it('`getCanonicalStatusEntries` liefert genau die Seed-Zeilen', () => {
    const alle = getCanonicalStatusEntries();
    expect(alle.length).toBe(baueFoerderSeedEintraege().length);
    // Keine zweite, handgepflegte Werteliste mehr daneben.
    expect(alle.map(([k]) => k)).not.toContain('genehmigt');
  });
});

describe('Die Kategorie-Deltas gegenüber der alten Handtabelle', () => {
  it('sind genau die fünf dokumentierten — ein sechstes fliegt auf', () => {
    // Die Liste ist abschließend. Wer die Ableitung ändert und hier nichts
    // ergänzt, ändert stillschweigend, wo Anträge in den Arbeitslisten stehen.
    expect(KATEGORIE_DELTAS).toHaveLength(5);
    for (const d of KATEGORIE_DELTAS) {
      expect(getStatusCategory(d.statusRoh), d.statusRoh).toBe(d.neu);
      expect(kategorieFuerCode(d.code), `Code ${d.code}`).toBe(d.neu);
      expect(d.alt).not.toBe(d.neu);
    }
  });

  it('kein Delta bei den Schreibweisen, die im Bestand wirklich vorkommen — außer den zweien', () => {
    // Die übrigen drei (11/70/71) sind amtliche Texte, die der Export heute
    // nicht schreibt: die Lücke war da, nur unsichtbar.
    const imBestand = KATEGORIE_DELTAS.filter(d => d.anzahl.tv + d.anzahl.vb > 0);
    expect(imBestand.map(d => d.code).sort((a, b) => a - b)).toEqual([33, 72]);
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
