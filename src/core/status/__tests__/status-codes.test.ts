/**
 * Der Text→Code-Join ist die Nahtstelle zwischen zwei Systemen: der Export
 * liefert Status als Text, die Parametertabelle führt Codes. Diese Tests halten
 * fest, was der Join darf — und vor allem, was er NICHT darf: raten.
 *
 * Der NFD-Fixture ist der eigentliche Grund für `normKey`: „techn geprüft" mit
 * kombinierendem Umlaut sieht auf dem Bildschirm identisch aus wie die
 * NFC-Fassung, ist als Zeichenkette aber eine andere.
 */
import { describe, it, expect } from 'vitest';
import {
  STATUS_CODE_KATALOG, baueStatusCodeIndex, findeStatusCode, statusCodeEintrag,
  reichereWerteAn, zaehleOhneCode,
} from '@/core/status/status-codes';
import { normKey, loseKey } from '@/core/status/normalisierung';
import { SEED_CODE_ZU_ZAH_PHASE, SEED_MARKER_CODES } from '@/core/status/zah-phasen';
import { baueSeedVersion } from '@/core/status/seed';
import type { StatusWertEintrag } from '@/core/status/typen';

const wert = (w: string): StatusWertEintrag => ({
  id: `status::${w.toLowerCase()}`,
  feldId: 'status',
  wert: w,
  kategorie: 'sonstige',
  prominenz: 'normal',
  aktiv: true,
  unkuratiert: false,
});

describe('normKey / loseKey', () => {
  it('normKey macht NFD und NFC vergleichbar', () => {
    const nfc = 'techn geprüft';
    const nfd = 'techn geprüft';           // u + Kombinationszeichen
    // Zur Laufzeit erzeugt statt als zweites Literal: so haengt der Test nicht
    // an der Byte-Kodierung dieser Datei (ein Editor normalisiert sie sonst weg)
    // und TypeScript verengt die Ketten nicht zu unvergleichbaren Literaltypen.
    const nfdErzeugt = nfc.normalize('NFD');
    expect(nfdErzeugt === nfc).toBe(false);      // wirklich verschiedene Ketten
    expect(normKey(nfdErzeugt)).toBe(normKey(nfc));
    expect(normKey(nfd)).toBe(normKey(nfc));
    expect(findeStatusCode(nfdErzeugt)?.eintrag.code).toBe(38);
  });

  it('normKey trimmt und schreibt klein', () => {
    expect(normKey('  NF Gestellt ')).toBe('nf gestellt');
  });

  it('loseKey ignoriert zusätzlich Interpunktion und Mehrfach-Leerzeichen', () => {
    expect(loseKey('Stellungnahme zur Rücknahmeempf.')).toBe(loseKey('Stellungnahme zur Rücknahmeempf'));
    expect(loseKey('VDI/VDE-IT')).toBe('vdi vde it');
  });
});

describe('findeStatusCode', () => {
  it('trifft die amtliche Bezeichnung exakt', () => {
    expect(findeStatusCode('NF gestellt')?.eintrag.code).toBe(35);
    expect(findeStatusCode('Schlussvermerk')?.eintrag.code).toBe(99);
  });

  it('trifft über eine gepflegte Variante', () => {
    expect(findeStatusCode('Stellungnahme zur Rücknahmeempf.')?.eintrag.code).toBe(72);
    expect(findeStatusCode('Ablehnung')?.eintrag.code).toBe(70);
    expect(findeStatusCode('VN techn. geprüft')?.eintrag.code).toBe(95);
  });

  it('trifft trotz abweichender Schreibweise (NFD, Casing, Leerzeichen)', () => {
    expect(findeStatusCode('  techn geprüft ')?.eintrag.code).toBe(38);
    expect(findeStatusCode('BEWILLIGT')?.eintrag.code).toBe(59);
  });

  it('greift nachrangig auf den losen Schlüssel zurück und sagt das', () => {
    const t = findeStatusCode('Stellungnahme zur Rücknahmeempf');   // Punkt fehlt
    expect(t?.eintrag.code).toBe(72);
    expect(t?.art).toBe('variante-lose');
    expect(findeStatusCode('NF gestellt')?.art).toBe('exakt');
  });

  it('rät NICHT — unbekannter Text bleibt ohne Code', () => {
    expect(findeStatusCode('Irgendein Wunschstatus')).toBeNull();
    expect(findeStatusCode('')).toBeNull();
    expect(findeStatusCode(undefined)).toBeNull();
    expect(findeStatusCode(42)).toBeNull();
  });

  it('lässt katalogfremde Werte unberührt (Pitfall #9)', () => {
    for (const v of ['neu', 'genehmigt', 'archiviert', 'in_pruefung', 'nachbesserung', 'abgelehnt']) {
      expect(findeStatusCode(v)).toBeNull();
    }
  });

  it('verwirft mehrdeutige lose Schlüssel, statt einen der Kandidaten zu wählen', () => {
    const index = baueStatusCodeIndex([
      { code: 1, text: 'A-B', varianten: [] },
      { code: 2, text: 'A B', varianten: [] },
    ]);
    // Beide fallen auf denselben losen Schlüssel „a b" — exakt trifft nur „A B".
    expect(findeStatusCode('A B', index)?.eintrag.code).toBe(2);
    expect(findeStatusCode('A/B', index)).toBeNull();
  });
});

describe('STATUS_CODE_KATALOG', () => {
  it('führt die 30 Codes der Parametertabelle, jeden genau einmal', () => {
    const codes = STATUS_CODE_KATALOG.map(e => e.code);
    expect(codes).toHaveLength(30);
    expect(new Set(codes).size).toBe(30);
    expect([...codes].sort((a, b) => a - b)).toEqual(codes);   // aufsteigend
  });

  it('ordnet jedem Code entweder eine ZAH-Phase oder den Marker-Status zu', () => {
    for (const e of STATUS_CODE_KATALOG) {
      const hatPhase = SEED_CODE_ZU_ZAH_PHASE.has(e.code);
      const istMarker = SEED_MARKER_CODES.has(e.code);
      expect(hatPhase || istMarker).toBe(true);
      expect(hatPhase && istMarker).toBe(false);
    }
  });

  it('statusCodeEintrag findet über die Nummer zurück', () => {
    expect(statusCodeEintrag(59)?.text).toBe('bewilligt');
    expect(statusCodeEintrag(1)).toBeNull();
  });
});

describe('Abdeckung des echten Bestands', () => {
  /**
   * Die 25 Statuswerte, die im Bestand (9 314 Anträge, Import 27.07.2026)
   * tatsächlich vorkommen — ausgezählt aus der List-View.
   *
   * Der Guard sichert die **Varianten**: „Ablehnung" (70), „Rücknahmeempfehlung"
   * (71) und „VN techn. geprüft" (95) stehen im Export anders als in der
   * Parametertabelle. Fiele eine dieser Zeilen beim Pflegen weg, verlören
   * schlagartig 135 Anträge ihre Phase — und zwar still.
   */
  const IM_BESTAND: readonly string[] = [
    'Schlussvermerk', 'abgelehnt/zurückgezogen', 'bewilligt', 'bearbeitungsreif', 'beendet',
    'beantragt', 'VN geprüft', 'ablehnungsreif', 'Gutachten fertig', 'Irrläufer',
    'VN techn. geprüft', 'NF gestellt', 'Ablehnung', 'NL eingegangen', 'Widerruf',
    'Anhörung zum Widerruf', 'Rücknahmeempfehlung', 'kaufm geprüft',
    'Bewilligungsentwurf VDI/VDE-IT', 'techn geprüft', 'Stellungnahme zur Rücknahmeempfehlung',
    'Widerspruch zur Ablehnung', 'unvollständig', 'keine weiteren NF', 'abgebrochen',
  ];

  it('jeder im Bestand vorkommende Statuswert bekommt einen Code', () => {
    const ohne = IM_BESTAND.filter(w => findeStatusCode(w) === null);
    expect(ohne, `Ohne Code: ${ohne.join(', ')}`).toEqual([]);
  });

  it('jeder davon bekommt eine ZAH-Phase oder ist ausdrücklich ein Marker', () => {
    const offen = IM_BESTAND.filter(w => {
      const code = findeStatusCode(w)?.eintrag.code;
      if (code === undefined) return true;
      return !SEED_CODE_ZU_ZAH_PHASE.has(code) && !SEED_MARKER_CODES.has(code);
    });
    expect(offen, `Ohne Phase und ohne Marker-Kennzeichen: ${offen.join(', ')}`).toEqual([]);
  });
});

describe('reichereWerteAn', () => {
  it('setzt Code, Varianten und ZAH-Phase', () => {
    const [a] = reichereWerteAn([wert('NF gestellt')]);
    expect(a?.code).toBe(35);
    expect(a?.zahPhaseId).toBe('vollstaendigkeit');
    expect(a?.marker).toBeUndefined();
  });

  it('markiert Marker-Codes und lässt sie bewusst ohne Phase', () => {
    const [a] = reichereWerteAn([wert('Irrläufer')]);
    expect(a?.code).toBe(29);
    expect(a?.marker).toBe(true);
    expect(a?.zahPhaseId).toBeNull();
  });

  it('reicht Werte ohne Code-Treffer unverändert durch', () => {
    const eingang = wert('genehmigt');
    const [a] = reichereWerteAn([eingang]);
    expect(a).toEqual(eingang);
  });

  it('überschreibt vorhandene Kuration nicht', () => {
    const kuratiert: StatusWertEintrag = { ...wert('NF gestellt'), zahPhaseId: 'pruefung', zieltage: 21 };
    const [a] = reichereWerteAn([kuratiert]);
    // Der Wert trägt noch keinen Code, bekommt ihn also — aber die von Hand
    // gesetzte Phase und die Zieltage bleiben stehen.
    expect(a?.code).toBe(35);
    expect(a?.zahPhaseId).toBe('pruefung');
    expect(a?.zieltage).toBe(21);
  });

  it('lässt bereits zugeordnete Werte vollständig in Ruhe', () => {
    const schon: StatusWertEintrag = { ...wert('irgendwas'), code: 88 };
    expect(reichereWerteAn([schon])[0]).toBe(schon);
  });
});

describe('Seed-Anbindung', () => {
  const seed = baueSeedVersion();

  it('liefert die ZAH-Phasen-Tabelle mit', () => {
    expect(seed.zahPhasen?.map(p => p.id)).toEqual([
      'eingang', 'vollstaendigkeit', 'pruefung', 'entscheidung', 'begleitung', 'abgeschlossen',
    ]);
  });

  it('verkoppelt die Förder-Statuswerte mit ihrem Code', () => {
    const nf = seed.werte.find(w => w.feldId === 'status' && w.wert === 'nf gestellt');
    expect(nf?.code).toBe(35);
    // Dasselbe Vokabular liegt unter beiden Wert-Feldern.
    const nfVb = seed.werte.find(w => w.feldId === 'verbund_status' && w.wert === 'nf gestellt');
    expect(nfVb?.code).toBe(35);
  });

  it('zaehleOhneCode zählt genau die Werte ohne Zuordnung', () => {
    const nurStatus = seed.werte.filter(w => w.feldId === 'status');
    const ohne = nurStatus.filter(w => w.code === undefined);
    expect(zaehleOhneCode(nurStatus)).toBe(ohne.length);
  });

  it('ist deterministisch — zweimal gebaut, identisches Ergebnis', () => {
    expect(JSON.stringify(baueSeedVersion())).toBe(JSON.stringify(seed));
  });
});
