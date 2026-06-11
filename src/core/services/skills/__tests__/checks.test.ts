import { describe, it, expect } from 'vitest';
import {
  splitSentences,
  checkSatzanzahl,
  checkKeineAufzaehlungen,
  checkPassivStil,
  runChecks,
} from '../checks';

/** 9-Satz-Kurzfassung (entspricht dem Mockup), „Der Antragsteller plant" in Satz 4. */
const NEUN_SAETZE =
  'Das Vorhaben adressiert die kontinuierliche Überwachung industrieller Fertigungsprozesse durch ein adaptives Sensornetzwerk. '
  + 'Ziel ist die frühzeitige Erkennung von Prozessabweichungen, um Ausschuss und ungeplante Stillstände zu reduzieren. '
  + 'Hierzu kombiniert das Vorhaben kostengünstige MEMS-Sensoren mit einer eingebetteten Auswerteeinheit. '
  + 'Der Antragsteller plant, ein selbstkalibrierendes Verfahren zu entwickeln. '
  + 'Ein wesentlicher Innovationsschritt liegt in der Verknüpfung lokaler Anomalieerkennung mit maschinellem Lernen. '
  + 'Die Auswertung erfolgt vollständig dezentral, sodass keine sensiblen Produktionsdaten das Werksnetz verlassen. '
  + 'Im Projektverlauf sollen Labormuster aufgebaut und an einer Referenzanlage erprobt werden. '
  + 'Die angestrebte Erkennungsgenauigkeit liegt bei über 95 Prozent. '
  + 'Angaben zur geplanten Markteinführung sind [Im Antrag nicht genannt].';

describe('splitSentences — Abkürzungen sind kein Satzende', () => {
  it('zählt „z. B." nicht als Satzgrenze', () => {
    expect(splitSentences('Das Modul nutzt z. B. MEMS-Sensoren. Es ist robust.')).toHaveLength(2);
  });

  it('zählt „z.B." (ohne Leerraum) nicht als Satzgrenze', () => {
    expect(splitSentences('Das Modul nutzt z.B. MEMS-Sensoren. Es ist robust.')).toHaveLength(2);
  });

  it('zählt „ca.", „bzw.", „d. h." nicht als Satzgrenze', () => {
    expect(splitSentences('Es werden ca. 50 Einheiten bzw. Module geprüft, d. h. alle Varianten. Fertig.')).toHaveLength(2);
  });

  it('erkennt echte Satzgrenzen mit ! und ?', () => {
    expect(splitSentences('Funktioniert das? Ja, sehr gut! Wirklich.')).toHaveLength(3);
  });

  it('zählt 9 Sätze in der Beispiel-Kurzfassung', () => {
    expect(splitSentences(NEUN_SAETZE)).toHaveLength(9);
  });
});

describe('checkSatzanzahl', () => {
  it('ist ok bei 9 Sätzen (Zielbereich 8–12)', () => {
    const r = checkSatzanzahl(NEUN_SAETZE);
    expect(r.level).toBe('ok');
    expect(r.label).toContain('9/8–12');
  });

  it('ist fehler bei zu wenigen Sätzen', () => {
    const r = checkSatzanzahl('Ein Satz. Zwei Sätze. Drei Sätze.');
    expect(r.level).toBe('fehler');
  });

  it('ist fehler bei zu vielen Sätzen', () => {
    const text = Array.from({ length: 14 }, (_, i) => `Dies ist Satz Nummer ${i + 1}.`).join(' ');
    const r = checkSatzanzahl(text);
    expect(r.level).toBe('fehler');
  });
});

describe('checkKeineAufzaehlungen', () => {
  it('ist ok bei reinem Fließtext', () => {
    expect(checkKeineAufzaehlungen(NEUN_SAETZE).level).toBe('ok');
  });

  it('ist fehler bei „- "-Aufzählung am Zeilenanfang', () => {
    const r = checkKeineAufzaehlungen('Das Vorhaben umfasst:\n- Punkt eins\n- Punkt zwei');
    expect(r.level).toBe('fehler');
  });

  it('ist fehler bei nummerierter Aufzählung', () => {
    const r = checkKeineAufzaehlungen('Ziele:\n1. Erstens\n2. Zweitens');
    expect(r.level).toBe('fehler');
  });
});

describe('checkPassivStil', () => {
  it('meldet „Der Antragsteller plant" als Hinweis mit Satz-Nummer', () => {
    const r = checkPassivStil(NEUN_SAETZE);
    expect(r.level).toBe('hinweis');
    expect(r.detail).toContain('Satz 4');
    expect(r.detail).toContain('Der Antragsteller plant');
  });

  it('meldet Arbeitspaket-Verweise (AP\\d)', () => {
    const r = checkPassivStil('Das Vorhaben steuert die Anlage über AP1 und AP2.');
    expect(r.level).toBe('hinweis');
  });

  it('ist ok bei durchgehend aktivem Stil', () => {
    expect(checkPassivStil('Das Vorhaben entwickelt ein Verfahren. Es überwacht Prozesse.').level).toBe('ok');
  });
});

describe('runChecks', () => {
  it('liefert genau drei Check-Ergebnisse', () => {
    const results = runChecks(NEUN_SAETZE);
    expect(results.map(r => r.id)).toEqual(['satzanzahl', 'keine-aufzaehlungen', 'aktiver-stil']);
  });
});
