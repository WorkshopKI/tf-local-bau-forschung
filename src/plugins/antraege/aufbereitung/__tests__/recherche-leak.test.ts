import { describe, it, expect } from 'vitest';
import { findeLeaks, sammleIdentifizierendeWerte, type BekannteStammwerte } from '../recherche-leak';

const werte: BekannteStammwerte = {
  antragsteller: 'Musterfirma GmbH',
  foerderkennzeichen: '16KN123456',
  akronym: 'PROJEKTX',
  titel: 'Entwicklung eines neuartigen Sensorsystems',
  aktenzeichen: ['16KN123456', '16KN123457'],
  personennamen: ['Dr. Erika Mustermann'],
  weitereTitel: ['Teilvorhaben Bildverarbeitung'],
};

describe('findeLeaks', () => {
  it('meldet keinen Treffer bei einem sauberen, anonymen Prompt', () => {
    const p = 'Recherchiere den Stand der Technik zu optischen Sensoren für die industrielle Qualitätssicherung.';
    expect(findeLeaks(p, werte)).toEqual([]);
  });

  it('findet das Förderkennzeichen (exakter Substring)', () => {
    expect(findeLeaks('… vgl. 16KN123456 …', werte)).toContain('16KN123456');
  });

  it('findet den vollen Firmennamen und dessen distinktiven Bestandteil', () => {
    expect(findeLeaks('Auftraggeber ist die Musterfirma GmbH.', werte)).toContain('Musterfirma GmbH');
    // Namensbestandteil ≥ 4 Zeichen (auch ohne die Rechtsform)
    expect(findeLeaks('… von Musterfirma …', werte)).toContain('Musterfirma');
  });

  it('ist case-insensitiv', () => {
    expect(findeLeaks('das akronym projektx taucht auf', werte)).toContain('PROJEKTX');
  });

  it('flaggt generische Rechtsform-Tokens NICHT allein (GmbH)', () => {
    // „GmbH" allein ist stoplisted → darf keinen Treffer erzeugen
    expect(findeLeaks('Ein KMU (GmbH) im Maschinenbau.', werte)).toEqual([]);
  });

  it('findet ein TV-Aktenzeichen und einen weiteren Titel', () => {
    expect(findeLeaks('Aktenzeichen 16KN123457.', werte)).toContain('16KN123457');
    expect(findeLeaks('… im Teilvorhaben Bildverarbeitung …', werte)).toContain('Teilvorhaben Bildverarbeitung');
  });

  it('findet Personennamen-Bestandteile ≥ 4 Zeichen', () => {
    const t = findeLeaks('… Ansprechpartnerin Mustermann …', werte);
    expect(t).toContain('Mustermann');
  });

  it('sammelt keine zu kurzen Werte (< 4 Zeichen)', () => {
    const alle = sammleIdentifizierendeWerte({ akronym: 'AB', foerderkennzeichen: 'X1' });
    expect(alle).toEqual([]);
  });
});
