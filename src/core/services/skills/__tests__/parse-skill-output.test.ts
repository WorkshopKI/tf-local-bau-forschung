import { describe, it, expect } from 'vitest';
import { parseSkillOutput } from '../kurzfassung-skill';

describe('parseSkillOutput', () => {
  it('zerlegt alle drei Abschnitte', () => {
    const raw = [
      '### Quellenanalyse',
      '"Das Sensormodul wird energieautark ausgeführt." (VB 2.1)',
      '',
      '### Entwurf',
      'Erster Entwurf der Kurzfassung.',
      '',
      '### Finaler Text',
      'Das Vorhaben überwacht Prozesse. Es funktioniert dezentral.',
    ].join('\n');

    const out = parseSkillOutput(raw);
    expect(out.quellenanalyse).toContain('energieautark');
    expect(out.entwurf).toBe('Erster Entwurf der Kurzfassung.');
    expect(out.finalerText.startsWith('Das Vorhaben überwacht Prozesse.')).toBe(true);
    expect(out.warnung).toBeUndefined();
  });

  it('toleriert fehlenden Entwurf-Teil', () => {
    const raw = '### Quellenanalyse\nQ-Inhalt.\n\n### Finaler Text\nFinaler Inhalt.';
    const out = parseSkillOutput(raw);
    expect(out.entwurf).toBe('');
    expect(out.quellenanalyse).toBe('Q-Inhalt.');
    expect(out.finalerText).toBe('Finaler Inhalt.');
    expect(out.warnung).toBeUndefined();
  });

  it('behandelt Ausgabe ohne Überschriften komplett als finalen Text + Warnung', () => {
    const raw = 'Nur Fließtext, keine Überschriften vorhanden.';
    const out = parseSkillOutput(raw);
    expect(out.finalerText).toBe(raw);
    expect(out.warnung).toBeDefined();
  });

  it('setzt Warnung + Fallback, wenn der finale Teil fehlt', () => {
    const raw = '### Quellenanalyse\nQ.\n\n### Entwurf\nNur ein Entwurf.';
    const out = parseSkillOutput(raw);
    expect(out.finalerText).toBe('Nur ein Entwurf.');
    expect(out.warnung).toBeDefined();
  });

  it('ist robust gegenüber Groß-/Kleinschreibung und ## statt ###', () => {
    const raw = '## quellenanalyse\nQ.\n\n## finaler text\nDas Vorhaben wirkt.';
    const out = parseSkillOutput(raw);
    expect(out.quellenanalyse).toBe('Q.');
    expect(out.finalerText).toBe('Das Vorhaben wirkt.');
  });
});
