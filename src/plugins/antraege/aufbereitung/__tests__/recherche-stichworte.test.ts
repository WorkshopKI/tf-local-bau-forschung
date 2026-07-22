import { describe, it, expect } from 'vitest';
import {
  bereinigeStichworte, LEERE_STICHWORTE, parseStichworte, pruefeStichwort,
  stichworteBrauchbar, traegtZahlwert,
} from '../recherche-stichworte';
import type { BekannteStammwerte } from '../recherche-leak';

const werte: BekannteStammwerte = {
  antragsteller: 'Musterfirma GmbH',
  foerderkennzeichen: 'ZF4711901AB3',
  akronym: 'AGENTFLOW',
};

describe('traegtZahlwert', () => {
  it('erkennt Kennzahlen, Marktgrößen und Zielwerte', () => {
    for (const s of ['hoechstens 10 s Latenz', '1,2 Mrd. Euro Marktvolumen', '30-50 Agenten', 'CAGR 12 %', '200 000 Unternehmen']) {
      expect(traegtZahlwert(s), s).toBe(true);
    }
  });

  it('lässt etablierte Fachbegriffe mit Ziffer stehen', () => {
    for (const s of ['5G-Campusnetz', 'Industrie 4.0', '3D-Druck', 'CO2-Bilanzierung', 'B2B-Vertrieb']) {
      expect(traegtZahlwert(s), s).toBe(false);
    }
  });
});

describe('pruefeStichwort', () => {
  it('nimmt einen sauberen Begriff an und normalisiert ihn', () => {
    expect(pruefeStichwort('  Multi-Agenten-Systeme  ', 5, werte)).toEqual({ ok: true, wert: 'Multi-Agenten-Systeme' });
  });

  it('schneidet Aufzählungszeichen und Satz-Endzeichen ab', () => {
    expect(pruefeStichwort('- Prozesssimulation.', 5, werte)).toEqual({ ok: true, wert: 'Prozesssimulation' });
  });

  it('kappt einen ganzen Satz auf die Wortgrenze', () => {
    const p = pruefeStichwort('Die Simulation von Veränderungsprozessen in mittelständischen Unternehmen', 4, werte);
    expect(p).toEqual({ ok: true, wert: 'Die Simulation von Veränderungsprozessen' });
  });

  it('lehnt Zahlwerte mit Begründung ab', () => {
    expect(pruefeStichwort('Latenz unter 10 Sekunden', 4, werte)).toEqual({ ok: false, grund: 'zahlwert' });
  });

  it('lehnt identifizierende Angaben ab', () => {
    expect(pruefeStichwort('Musterfirma GmbH', 5, werte)).toEqual({ ok: false, grund: 'identifizierend' });
    expect(pruefeStichwort('AGENTFLOW-Plattform', 5, werte)).toEqual({ ok: false, grund: 'identifizierend' });
  });

  it('lehnt Leeres ab', () => {
    expect(pruefeStichwort('   ', 5, werte)).toEqual({ ok: false, grund: 'leer' });
    expect(pruefeStichwort(42, 5, werte)).toEqual({ ok: false, grund: 'leer' });
  });
});

describe('bereinigeStichworte', () => {
  it('filtert, dedupliziert und kappt die Listenlänge', () => {
    const { stichworte, entfernt } = bereinigeStichworte({
      themenfeld: 'Agentenbasierte Simulation',
      anwendungsdomaene: 'Produzierender Mittelstand',
      technologien: ['Multi-Agenten-Systeme', 'multi-agenten-systeme', 'Sprachmodelle', 'Skalierung auf 50 Agenten'],
      leistungsdimensionen: ['Latenz', 'Skalierbarkeit der Agentenzahl'],
      marktsegmente: ['Maschinenbau', 'Musterfirma GmbH'],
      suchbegriffeEn: ['agent-based simulation'],
    }, werte);

    expect(stichworte.technologien).toEqual(['Multi-Agenten-Systeme', 'Sprachmodelle']);
    expect(stichworte.marktsegmente).toEqual(['Maschinenbau']);
    expect(stichworte.leistungsdimensionen).toEqual(['Latenz', 'Skalierbarkeit der Agentenzahl']);
    // Nur echte Verluste zählen — die Dublette ist keiner.
    expect(entfernt).toBe(2);
  });

  it('respektiert die Höchstzahl je Liste', () => {
    const viele = ['a-eins', 'b-zwei', 'c-drei', 'd-vier', 'e-fuenf'];
    const { stichworte } = bereinigeStichworte({ marktsegmente: viele });
    expect(stichworte.marktsegmente).toHaveLength(4);
  });

  it('ist idempotent (bereits bereinigt bleibt gleich)', () => {
    const einmal = bereinigeStichworte({
      themenfeld: 'Agentenbasierte Simulation',
      technologien: ['Multi-Agenten-Systeme'],
    }, werte).stichworte;
    expect(bereinigeStichworte(einmal, werte)).toEqual({ stichworte: einmal, entfernt: 0 });
  });

  it('verkraftet fehlende und falsch getypte Felder', () => {
    const { stichworte } = bereinigeStichworte({ technologien: 'kein Array' as unknown });
    expect(stichworte).toEqual(LEERE_STICHWORTE);
  });
});

describe('stichworteBrauchbar', () => {
  const basis = { ...LEERE_STICHWORTE, themenfeld: 'Agentensimulation' };

  it('verlangt ein Themenfeld', () => {
    expect(stichworteBrauchbar({ ...basis, themenfeld: '', technologien: ['a', 'b'] })).toBe(false);
  });

  it('verlangt zwei Technologien oder ein Marktsegment', () => {
    expect(stichworteBrauchbar(basis)).toBe(false);
    expect(stichworteBrauchbar({ ...basis, technologien: ['a'] })).toBe(false);
    expect(stichworteBrauchbar({ ...basis, technologien: ['a', 'b'] })).toBe(true);
    expect(stichworteBrauchbar({ ...basis, marktsegmente: ['Maschinenbau'] })).toBe(true);
  });
});

describe('parseStichworte', () => {
  it('liest den letzten JSON-Block und bereinigt ihn', () => {
    const raw = 'Denkschritt …\n```json\n{"themenfeld": "Sensorik", "technologien": ["MEMS", "Signalverarbeitung"]}\n```';
    expect(parseStichworte(raw)?.stichworte.technologien).toEqual(['MEMS', 'Signalverarbeitung']);
  });

  it('gibt null zurück, wenn nach der Bereinigung nichts übrig bleibt', () => {
    const raw = '```json\n{"themenfeld": "Marktvolumen 1,2 Mrd. Euro"}\n```';
    expect(parseStichworte(raw)).toBeNull();
  });

  it('gibt null bei Fließtext zurück', () => {
    expect(parseStichworte('Nur Prosa, kein JSON.')).toBeNull();
  });
});
