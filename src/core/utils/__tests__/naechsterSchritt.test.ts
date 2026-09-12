/*
 * Seit v4.3 gibt die Formel nur noch die HANDLUNG aus. Das Phasenwort links war
 * ein drittes Vokabular neben Katalog und Arbeitsliste — zwei seiner Wörter
 * („Fachprüfung", „Nachforderung") standen in keiner Fassung, und
 * `bearbeitungsreif` lief hier unter „Eingang", laut Auslieferung aber unter
 * „Vollständigkeit". Was hier geprüft wird, ist deshalb die Aktion; die
 * Beschriftung des Verfahrensschritts prüft `zah-phasen-daten.test.ts`.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  naechsterSchritt, normalisierePrecheck, precheckUrteil, precheckUrteilVonZeile, schrittText,
} from '../naechsterSchritt';
import {
  setCodePhasenSnapshot, resetZahPhasenSnapshotFuerTests, SEED_PHASEN_SCHNITT,
} from '@/core/status/zah-phasen';

afterEach(() => resetZahPhasenSnapshotFuerTests());

describe('naechsterSchritt — gemappte Roh-Stati (Kern-Tabelle)', () => {
  const cases: Array<[string, string]> = [
    // status, aktion
    ['beantragt', 'Vollständigkeit prüfen'],
    ['bearbeitungsreif', 'Vollständigkeit prüfen'],
    ['NL eingegangen', 'Nachlieferung prüfen'],
    ['techn geprüft', 'Gutachten beginnen'],
    ['kaufm geprüft', 'Gutachten beginnen'],
    ['Gutachten fertig', 'Gutachten freigeben'],
    ['bewilligungsreif', 'Bewilligung vorbereiten'],
    ['ablehnungsreif', 'Ablehnungsbescheid erstellen'],
    ['NF gestellt', 'Nachforderung nachhalten'],
    // Zyklus abgeschlossen, Antrag vollständig — nachzuhalten ist nichts mehr
    // (v2.411). Bis dahin stand hier dieselbe Formel wie bei „NF gestellt".
    ['keine weiteren NF', 'Fachprüfung beginnen'],
  ];

  it.each(cases)('%s → %s', (status, aktion) => {
    expect(naechsterSchritt(status)).toEqual({ aktion });
  });

  it('gibt die interne Notiz `eingangsFormel` NICHT nach außen', () => {
    // Sie steuert nur die PreCheck-Regel unten; im Ergebnis hätte sie nichts
    // verloren (und stünde sonst im `toEqual` jedes Aufrufers).
    expect(Object.keys(naechsterSchritt('beantragt')!)).toEqual(['aktion']);
  });

  it('trimmt Whitespace vor dem Lookup', () => {
    expect(naechsterSchritt('  beantragt  ')).toEqual({ aktion: 'Vollständigkeit prüfen' });
  });

  it('Begleitphase bekommt KEINE Antragsphasen-Aktion', () => {
    // Ein geprüfter Verwendungsnachweis löst kein Gutachten aus. Der Ablauf
    // nach der Bewilligung ist nicht abgebildet — also gar keine Anweisung.
    for (const status of ['VN geprüft', 'VN techn. geprüft']) {
      expect(naechsterSchritt(status)?.aktion).toBe('');
    }
  });
});

describe('naechsterSchritt — Fallback (nicht gemappt, aber gesetzt)', () => {
  it('liefert eine leere Aktion statt einer erratenen', () => {
    // 'bewilligt' ist kein Bearbeitungs-Schritt.
    expect(naechsterSchritt('bewilligt')).toEqual({ aktion: '' });
    expect(naechsterSchritt('irgendwas-neues')).toEqual({ aktion: '' });
  });
});

describe('naechsterSchritt — leerer/fehlender Status → null', () => {
  it('undefined → null', () => {
    expect(naechsterSchritt(undefined)).toBeNull();
  });
  it('null → null', () => {
    expect(naechsterSchritt(null)).toBeNull();
  });
  it('leerer String → null', () => {
    expect(naechsterSchritt('')).toBeNull();
  });
  it('nur Whitespace → null', () => {
    expect(naechsterSchritt('   ')).toBeNull();
  });
});

/*
 * Was auf der engen Fläche tatsächlich steht — die eine Stelle, an der die Regel
 * „ohne Handlung zeigen wir den Status" lebt (Home-Zeile, Kanban-Karte,
 * Assistenten-Kontext).
 */
describe('schrittText', () => {
  it('zeigt die Handlung, wenn eine hinterlegt ist', () => {
    expect(schrittText('techn geprüft')).toBe('Gutachten beginnen');
  });

  it('fällt auf die Status-KURZform zurück, nicht auf den Rohwert', () => {
    expect(schrittText('bewilligt')).toBe('Bewilligt');
  });

  it('nimmt bei unbekanntem Status den Rohwert — sichtbar unfertig statt leer', () => {
    expect(schrittText('irgendwas-neues')).toBe('irgendwas-neues');
  });

  it('leerer Status → leerer Text, kein Rest der Formel', () => {
    expect(schrittText('')).toBe('');
    expect(schrittText(null)).toBe('');
    expect(schrittText(undefined)).toBe('');
    expect(schrittText('   ')).toBe('');
  });

  it('reicht den PreCheck-Kontext durch', () => {
    expect(schrittText('beantragt', 'PreCheck negativ')).toBe('PreCheck-Ergebnis klären');
  });
});

describe('naechsterSchritt — Abwärtskompatibilität des 2. Arguments', () => {
  it('OHNE 2. Argument bleibt das Legacy-Verhalten erhalten (kein „PreCheck durchführen")', () => {
    // Kein PreCheck-Kontext ⇒ Status-Regel greift unverändert.
    expect(naechsterSchritt('beantragt')).toEqual({ aktion: 'Vollständigkeit prüfen' });
  });
});

describe('naechsterSchritt — PreCheck-Regeln (2. Argument gesetzt)', () => {
  // PreCheck fehlt/ausstehend UND Status im Verfahrensschritt „Eingang"
  // ⇒ „PreCheck durchführen". `beantragt` (Code 31) liegt dort.
  const durchfuehren: Array<[string, string | null]> = [
    ['beantragt', ''],                    // ohne
    ['beantragt', null],                  // ohne (explizit null)
    ['beantragt', 'PreCheck ausstehend'], // offen/pending
  ];
  it.each(durchfuehren)('%s + precheck=%o → PreCheck durchführen', (status, pc) => {
    expect(naechsterSchritt(status, pc)).toEqual({ aktion: 'PreCheck durchführen' });
  });

  it('`bearbeitungsreif` liegt in der Vollständigkeit — kein PreCheck-Aufruf mehr', () => {
    // Bis v2.410 hing die Regel an der Arbeitsliste (`offen`) und traf damit
    // auch Codes der Vollständigkeit. 33/34 bekommen jetzt ihre kuratierte
    // Formel statt einer Anweisung aus einem Schritt, in dem sie nicht stehen.
    expect(naechsterSchritt('bearbeitungsreif', ''))
      .toEqual({ aktion: 'Vollständigkeit prüfen' });
    // Ohne kuratierte Formel bleibt gar keine Anweisung — die Fläche zeigt dann
    // den Status.
    expect(naechsterSchritt('unvollständig', '')).toEqual({ aktion: '' });
    expect(schrittText('unvollständig', '')).toBe('Unvollständig');
  });

  it('folgt dem VERFAHRENSSCHRITT, nicht der Arbeitsliste — Umhängen wirkt', () => {
    // Die Zusicherung hinter der Achsen-Korrektur (v2.411): Hängt die PL einen
    // Code um, wandert die Anweisung mit. Hinge die Regel weiter an der
    // Kategorie, bliebe sie beim nächsten Phasenschnitt still falsch stehen.
    expect(naechsterSchritt('beantragt', ''))
      .toEqual({ aktion: 'PreCheck durchführen' });

    // Code 31 („beantragt") aus dem Eingang in die Vollständigkeit gehängt:
    setCodePhasenSnapshot({
      codeZuPhase: new Map([...SEED_PHASEN_SCHNITT.codeZuPhase, [31, 'vollstaendigkeit']]),
      markerCodes: SEED_PHASEN_SCHNITT.markerCodes,
    });
    expect(naechsterSchritt('beantragt', ''))
      .toEqual({ aktion: 'Vollständigkeit prüfen' });
  });

  it('kuratierte Formel schlägt die PreCheck-Regel, wenn sie woanders hinzeigt', () => {
    // Umgekehrter Fall: ein Code der Vollständigkeit wandert in den Eingang.
    // Seine eigene Formel ist spezifischer als die allgemeine Regel — sonst
    // stünde bei „NL eingegangen" plötzlich „PreCheck durchführen". Getragen
    // wird die Unterscheidung seit v4.3 von `eingangsFormel`, nicht mehr von
    // einem Vergleich gegen das Wort „Eingang".
    setCodePhasenSnapshot({
      codeZuPhase: new Map([...SEED_PHASEN_SCHNITT.codeZuPhase, [36, 'eingang']]),
      markerCodes: SEED_PHASEN_SCHNITT.markerCodes,
    });
    expect(naechsterSchritt('NL eingegangen', ''))
      .toEqual({ aktion: 'Nachlieferung prüfen' });
  });

  it('positiver PreCheck fällt auf die Status-Regel zurück', () => {
    // Mockup: AIRES (Eingang, PreCheck positiv) → „Vollständigkeit prüfen".
    expect(naechsterSchritt('beantragt', 'PreCheck positiv - Verbund'))
      .toEqual({ aktion: 'Vollständigkeit prüfen' });
  });

  it('negativer PreCheck (nicht-terminal) → PreCheck-Ergebnis klären', () => {
    expect(naechsterSchritt('beantragt', 'PreCheck negativ'))
      .toEqual({ aktion: 'PreCheck-Ergebnis klären' });
  });

  it('negativer PreCheck greift auch bei fortgeschrittenem, nicht-terminalem Status', () => {
    expect(naechsterSchritt('Gutachten fertig', 'PreCheck negativ'))
      .toEqual({ aktion: 'PreCheck-Ergebnis klären' });
  });

  it('„durchführen" NUR in der Eingangs-Phase — fortgeschrittener Status ohne PreCheck fällt auf die Status-Regel zurück', () => {
    // 'Gutachten fertig' ist Kategorie in_pruefung, nicht 'offen' ⇒ keine durchführen-Regel.
    expect(naechsterSchritt('Gutachten fertig', ''))
      .toEqual({ aktion: 'Gutachten freigeben' });
  });

  it('Terminal-Status unterdrückt die PreCheck-Regeln (Fallback auf Status-Regel)', () => {
    expect(naechsterSchritt('Schlussvermerk', 'PreCheck negativ')?.aktion).toBe('');
    expect(naechsterSchritt('abgelehnt/zurückgezogen', '')?.aktion).toBe('');
    // Sichtbar bleibt trotzdem etwas — der Status selbst.
    expect(schrittText('Schlussvermerk', 'PreCheck negativ')).toBeTruthy();
  });
});

describe('normalisierePrecheck', () => {
  const cases: Array<[string | null | undefined, ReturnType<typeof normalisierePrecheck>]> = [
    ['', 'ohne'],
    [undefined, 'ohne'],
    [null, 'ohne'],
    ['   ', 'ohne'],
    ['PreCheck positiv - Verbund', 'positiv'], // Bindestrich im Label darf NICHT als negativ zählen
    ['pre-check positiv', 'positiv'],
    ['PreCheck negativ', 'negativ'],
    ['PreCheck ausstehend', 'offen'],
    ['D_PC+', 'positiv'],
    ['D_PC-', 'negativ'],
    ['D_PC?', 'offen'],
  ];
  it.each(cases)('%o → %s', (label, expected) => {
    expect(normalisierePrecheck(label)).toBe(expected);
  });
});

/**
 * Der KITED-Fall (16KN125321, Export 11.09.2026): `D_PC-` am 22.01.2026, einen
 * Tag später `D_XPC+` am Verbund. Bis v6.65 standen beide in EINER Spalte, in
 * der das jüngste Datum gewann — die Zeile las „PreCheck positiv - Verbund" und
 * der Filter zählte den Antrag unter „positiv". 256 Teilvorhaben im Bestand.
 */
describe('precheckUrteil — zwei Teile, ein Urteil', () => {
  it('negativ am Teilvorhaben schlägt positiv am Verbund', () => {
    expect(precheckUrteil({ tv: 'pre-check negativ', vb: 'PreCheck positiv - Verbund' }))
      .toEqual({ klasse: 'negativ', label: 'pre-check negativ' });
  });

  it('negativ am Verbund schlägt positiv am Teilvorhaben — die Richtung ist egal', () => {
    expect(precheckUrteil({ tv: 'pre-check positiv', vb: 'PreCheck negativ' }).klasse).toBe('negativ');
  });

  it('sind sich beide einig, trägt das Urteil den Wortlaut des Teilvorhabens', () => {
    expect(precheckUrteil({ tv: 'pre-check positiv', vb: 'PreCheck positiv' }))
      .toEqual({ klasse: 'positiv', label: 'pre-check positiv' });
  });

  it('ein gesetzter Teil genügt — der fehlende zieht das Urteil nicht auf „ohne"', () => {
    expect(precheckUrteil({ vb: 'PreCheck positiv - Verbund' }))
      .toEqual({ klasse: 'positiv', label: 'PreCheck positiv - Verbund' });
    expect(precheckUrteil({ tv: 'pre-check negativ', vb: '' }).klasse).toBe('negativ');
  });

  it('ausstehend steht über gar nichts, aber unter einem echten Urteil', () => {
    expect(precheckUrteil({ tv: 'PreCheck ausstehend', vb: '' }).klasse).toBe('offen');
    expect(precheckUrteil({ tv: 'PreCheck ausstehend', vb: 'PreCheck positiv' }).klasse).toBe('positiv');
  });

  it('ohne beide Teile bleibt das Label leer — kein erfundener Wortlaut', () => {
    expect(precheckUrteil({})).toEqual({ klasse: 'ohne', label: '' });
    expect(precheckUrteilVonZeile({})).toEqual({ klasse: 'ohne', label: '' });
  });

  it('liest dieselben Felder aus einer List-View-Zeile', () => {
    expect(precheckUrteilVonZeile({
      precheck_tv_status_label: 'pre-check negativ',
      precheck_vb_status_label: 'PreCheck positiv - Verbund',
    }).klasse).toBe('negativ');
  });
});
