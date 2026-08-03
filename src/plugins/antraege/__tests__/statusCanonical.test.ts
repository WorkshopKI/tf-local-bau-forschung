import { describe, it, expect } from 'vitest';
import {
  getStatusCategory,
  isOpenStatus,
  isInPruefungStatus,
  isNachforderungStatus,
  isBewilligtStatus,
  isBegleitungStatus,
  isClosedStatus,
  statusRang,
} from '@/core/utils/status-canonical';

describe('getStatusCategory — Foerderantraege (CSV-Rohwerte)', () => {
  it.each([
    ['beantragt', 'offen'],
    ['bearbeitungsreif', 'offen'],
    // v2.383: Code 36 liegt in der Phase Vollständigkeit und gehört zum
    // Nachforderungs-Zyklus (35–37) — 37 „keine weiteren NF" lag schon vorher
    // dort, 36 zieht nach. Bleibt `isOpenStatus`.
    ['NL eingegangen', 'nachforderung'],
    // Amtliche Schreibweisen, die die alte Handtabelle nicht kannte und die
    // deshalb auf `sonstige` fielen — seit v2.383 über den Code-Katalog.
    ['Skizze eingegangen', 'offen'],
    ['Ablehnung versandt', 'entscheidung'],
    ['Rücknahmeempfehlung versandt', 'entscheidung'],
    ['Stellungnahme zur Rücknahmeempfehlung', 'entscheidung'],
    ['VN technisch geprüft', 'begleitung'],
    // Antrags-Pruefung (vor Bewilligung) bleibt in_pruefung
    ['techn geprüft', 'in_pruefung'],
    ['kaufm geprüft', 'in_pruefung'],
    ['Gutachten fertig', 'in_pruefung'],
    // Begleit-Phase nach Bewilligung: VN/ZB-Pruefung + Widerrufs-Verfahren
    ['VN geprüft', 'begleitung'],
    ['VN techn. geprüft', 'begleitung'],
    ['Widerruf', 'begleitung'],
    ['Anhörung zum Widerruf', 'begleitung'],
    ['bewilligungsreif', 'entscheidung'],
    ['ablehnungsreif', 'entscheidung'],
    ['Bewilligungsentwurf VDI/VDE-IT', 'entscheidung'],
    // Ablehnung + Ruecknahme zaehlen als entscheidung (noch im Verfahren, pre-
    // Bewilligung), NICHT als final-abgelehnt — Foerderantraege haben keinen
    // final-`abgelehnt`-Endzustand; negativ-final landet in
    // `abgelehnt/zurueckgezogen` (abgeschlossen).
    ['Ablehnung', 'entscheidung'],
    ['Rücknahmeempfehlung', 'entscheidung'],
    ['NF gestellt', 'nachforderung'],
    ['keine weiteren NF', 'nachforderung'],
    ['bewilligt', 'bewilligt'],
    ['Schlussvermerk', 'abgeschlossen'],
    ['beendet', 'abgeschlossen'],
    ['abgelehnt/zurückgezogen', 'abgeschlossen'],
    ['abgebrochen', 'abgeschlossen'],
    // Marker (29/88/93/94) laufen ohne Phase neben dem Verfahren — `sonstige`
    // ist hier die Aussage, nicht die Lücke.
    ['Irrläufer', 'sonstige'],
    ['Sonderstatus', 'sonstige'],
    ['assoziierter Partner', 'sonstige'],
    // v2.383: Code 33 liegt in der Phase Vollständigkeit und ist offene Arbeit.
    // Unter `sonstige` war er in keiner Arbeitsliste sichtbar. Die Asymmetrie zu
    // 29 Irrläufer (bleibt Marker) ist gewollt.
    ['unvollständig', 'offen'],
  ] as const)('"%s" → %s', (raw, expected) => {
    expect(getStatusCategory(raw)).toBe(expected);
  });
});

describe('getStatusCategory — unkuratierte Werte ohne amtlichen Code', () => {
  // Was der Katalog nicht kennt, ist `sonstige` — „wir wissen es nicht" ist eine
  // eigene Aussage, nicht der Anfang des Verfahrens. Bis v2.395 stand hier eine
  // zweite Handtabelle mit Snake-Case-Werten der Bauantrag-Demo.
  it.each([
    'neu', 'in_bearbeitung', 'genehmigt', 'archiviert', 'nachbesserung',
    'in_begutachtung', 'eingereicht',
  ])('"%s" → sonstige', raw => {
    expect(getStatusCategory(raw)).toBe('sonstige');
  });
});

describe('getStatusCategory — Edge-Cases', () => {
  it('undefined → sonstige', () => {
    expect(getStatusCategory(undefined)).toBe('sonstige');
  });
  it('null → sonstige', () => {
    expect(getStatusCategory(null)).toBe('sonstige');
  });
  it('leerer String → sonstige', () => {
    expect(getStatusCategory('')).toBe('sonstige');
  });
  it('nur Whitespace → sonstige', () => {
    expect(getStatusCategory('   ')).toBe('sonstige');
  });
  it('unbekannter Wert → sonstige', () => {
    expect(getStatusCategory('fantasieStatus42')).toBe('sonstige');
  });
  it('Number statt String → sonstige', () => {
    expect(getStatusCategory(42 as unknown)).toBe('sonstige');
  });
  it('Case-Insensitivity: BEWILLIGT', () => {
    expect(getStatusCategory('BEWILLIGT')).toBe('bewilligt');
  });
  it('Case-Insensitivity: NF Gestellt', () => {
    expect(getStatusCategory('NF Gestellt')).toBe('nachforderung');
  });
  it('Whitespace-Toleranz: "  bewilligt  "', () => {
    expect(getStatusCategory('  bewilligt  ')).toBe('bewilligt');
  });
});

describe('isOpenStatus — deckt offen + in_pruefung + nachforderung + entscheidung + begleitung ab', () => {
  it.each([
    'beantragt', 'bearbeitungsreif', 'NL eingegangen',
    // v2.383: Code 33 ist offene Arbeit in der Vollständigkeitsphase und taucht
    // damit erstmals in den Arbeitslisten auf, statt unter `sonstige` zu liegen.
    'unvollständig', 'Skizze eingegangen',
    'kaufm geprüft', 'Gutachten fertig', 'techn geprüft',
    // VN-Stati zaehlen jetzt als Begleitung — bleiben aber offen (noch nicht abgeschlossen)
    'VN geprüft', 'VN techn. geprüft', 'ZB eingegangen',
    'NF gestellt', 'keine weiteren NF',
    'bewilligungsreif', 'ablehnungsreif',
    // Ablehnung/Widerruf sind noch im Verfahren, nicht final-abgelehnt
    'Ablehnung', 'Widerruf', 'Anhörung zum Widerruf',
  ])('"%s" ist offen', s => {
    expect(isOpenStatus(s)).toBe(true);
  });
  it.each([
    'bewilligt',
    'Schlussvermerk', 'abgebrochen', 'abgelehnt/zurückgezogen',
    // Marker laufen neben dem Verfahren — kein Arbeitsvorrat.
    'Irrläufer', 'Sonderstatus', '', undefined,
    // Unkuratiert (`sonstige`) ist ebenfalls nicht offen.
    'genehmigt', 'archiviert', 'abgeschlossen',
  ])('"%s" ist NICHT offen', s => {
    expect(isOpenStatus(s)).toBe(false);
  });
});

describe('isBewilligtStatus', () => {
  it('"bewilligt" → true', () => expect(isBewilligtStatus('bewilligt')).toBe(true));
  it('"BEWILLIGT" → true (case-insensitiv)', () => expect(isBewilligtStatus('BEWILLIGT')).toBe(true));
  it('bewilligungsreif → false (Entscheidungs-Vorbereitung, nicht "bewilligt")', () => {
    expect(isBewilligtStatus('bewilligungsreif')).toBe(false);
  });
  it('Schlussvermerk → false (abgeschlossen, nicht "bewilligt")', () => {
    expect(isBewilligtStatus('Schlussvermerk')).toBe(false);
  });
});

describe('isNachforderungStatus', () => {
  it('Foerderantrag "NF gestellt" → true', () => expect(isNachforderungStatus('NF gestellt')).toBe(true));
  it('Foerderantrag "keine weiteren NF" → true', () => expect(isNachforderungStatus('keine weiteren NF')).toBe(true));
  it('Foerderantrag "NL eingegangen" → true', () => expect(isNachforderungStatus('NL eingegangen')).toBe(true));
  it('"techn geprüft" → false', () => expect(isNachforderungStatus('techn geprüft')).toBe(false));
});

describe('isInPruefungStatus — Antrags-Pruefung (vor Bewilligung)', () => {
  it('Foerderantrag "techn geprüft" → true', () => expect(isInPruefungStatus('techn geprüft')).toBe(true));
  it('Foerderantrag "kaufm geprüft" → true', () => expect(isInPruefungStatus('kaufm geprüft')).toBe(true));
  it('Foerderantrag "Gutachten fertig" → true', () => expect(isInPruefungStatus('Gutachten fertig')).toBe(true));
  it('"bewilligt" → false', () => expect(isInPruefungStatus('bewilligt')).toBe(false));
  // VN-Stati sind nicht mehr Antrags-Pruefung — die sind in Begleitung
  it('"VN geprüft" → false (ist Begleitung, nicht Antrags-Pruefung)', () => {
    expect(isInPruefungStatus('VN geprüft')).toBe(false);
  });
  it('"VN techn. geprüft" → false (Begleitung)', () => {
    expect(isInPruefungStatus('VN techn. geprüft')).toBe(false);
  });
});

describe('isBegleitungStatus — Verwendungsnachweis-/Zwischenbericht-Phase nach Bewilligung', () => {
  it('"VN geprüft" → true', () => expect(isBegleitungStatus('VN geprüft')).toBe(true));
  it('"VN techn. geprüft" → true', () => expect(isBegleitungStatus('VN techn. geprüft')).toBe(true));
  it('"techn geprüft" → false (Antrags-Pruefung)', () => {
    expect(isBegleitungStatus('techn geprüft')).toBe(false);
  });
  it('"bewilligt" → false', () => expect(isBegleitungStatus('bewilligt')).toBe(false));
  it('"Schlussvermerk" → false (abgeschlossen)', () => {
    expect(isBegleitungStatus('Schlussvermerk')).toBe(false);
  });
  // Pattern-Fallback: zukuenftige VN-/ZB-Varianten ohne explizites Mapping
  it('"VN angefordert" (nicht explizit gelistet) → true via Pattern-Fallback', () => {
    expect(isBegleitungStatus('VN angefordert')).toBe(true);
  });
  it('"ZB eingegangen" → true via Pattern-Fallback', () => {
    expect(isBegleitungStatus('ZB eingegangen')).toBe(true);
  });
  it('"ZB geprüft" → true via Pattern-Fallback', () => {
    expect(isBegleitungStatus('ZB geprüft')).toBe(true);
  });
  it('"ZB.techn" → true via Pattern-Fallback (Punkt-Delimiter)', () => {
    expect(isBegleitungStatus('ZB.techn')).toBe(true);
  });
  // Pattern darf NICHT versehentlich auf Worte mit "VN"/"ZB" als Substring matchen
  it('"AVN abgeschlossen" → false (kein VN-Praefix)', () => {
    expect(isBegleitungStatus('AVN abgeschlossen')).toBe(false);
  });
  it('"vnova" → false (kein Whitespace/Punkt nach vn)', () => {
    expect(isBegleitungStatus('vnova')).toBe(false);
  });
});

describe('isClosedStatus — final entschieden (bewilligt + abgelehnt + abgeschlossen)', () => {
  it.each([
    // bewilligt (final)
    'bewilligt',
    // abgeschlossen (final)
    'Schlussvermerk', 'beendet', 'abgelehnt/zurückgezogen', 'abgebrochen',
  ])('"%s" ist closed', s => {
    expect(isClosedStatus(s)).toBe(true);
  });
  it.each([
    'beantragt', 'VN geprüft', 'NF gestellt', 'bewilligungsreif',
    'eingereicht', 'in_pruefung', 'nachforderung',
    // Ablehnung/Widerruf sind NICHT closed — sie sind noch im Entscheidungs-Verfahren
    'Ablehnung', 'Widerruf', 'Anhörung zum Widerruf', 'Rücknahmeempfehlung',
  ])('"%s" ist NICHT closed', s => {
    expect(isClosedStatus(s)).toBe(false);
  });
});

describe('statusRang — kanonische Lebenszyklus-Ordnung', () => {
  it.each([
    ['beantragt', 1],        // offen
    ['techn geprüft', 2],    // in_pruefung
    ['NF gestellt', 3],      // nachforderung
    ['bewilligungsreif', 4], // entscheidung
    ['bewilligt', 5],        // bewilligt
    ['VN geprüft', 6],       // begleitung
    ['Schlussvermerk', 7],   // abgeschlossen
    // Rang 8 = Kategorie `abgelehnt` — vom Foerder-Katalog unbesetzt, deshalb
    // kein Beispielwert. Der Rang bleibt fuer kuratierte Fassungen reserviert.
    ['Irrläufer', 9],        // sonstige
  ] as const)('"%s" → Rang %i', (raw, rang) => {
    expect(statusRang(raw)).toBe(rang);
  });

  it('unbekannt/leer/undefined → Rang 9 (sonstige, ans Ende)', () => {
    expect(statusRang('fantasieStatus')).toBe(9);
    expect(statusRang('')).toBe(9);
    expect(statusRang(undefined)).toBe(9);
    expect(statusRang(null)).toBe(9);
  });

  it('ist monoton entlang des Verfahrens (offen < Prüfung < … < abgeschlossen)', () => {
    const lifecycle = ['beantragt', 'techn geprüft', 'NF gestellt', 'bewilligungsreif', 'bewilligt', 'VN geprüft', 'Schlussvermerk'];
    const ranks = lifecycle.map(statusRang);
    const sorted = [...ranks].sort((a, b) => a - b);
    expect(ranks).toEqual(sorted);
    expect(new Set(ranks).size).toBe(ranks.length); // strikt aufsteigend, keine Kollision
  });
});
