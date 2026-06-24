import { describe, it, expect } from 'vitest';
import { parseSkillOutput } from '../parse';

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

  it('zerlegt fett-umschlossene Überschriften (**### Finaler Text**)', () => {
    const raw = [
      '**### Quellenanalyse**',
      '„ZITAT-MARKER aus der VB.“ (2.1)',
      '',
      '**### Entwurf**',
      'Roher Entwurf.',
      '',
      '**### Finaler Text**',
      'Das Vorhaben wirkt dezentral.',
    ].join('\n');
    const out = parseSkillOutput(raw);
    expect(out.quellenanalyse).toContain('ZITAT-MARKER');
    expect(out.entwurf).toBe('Roher Entwurf.');
    expect(out.finalerText).toBe('Das Vorhaben wirkt dezentral.');
    expect(out.warnung).toBeUndefined();
  });

  it('toleriert #### + Doppelpunkt, Fett ohne Hashes und Einrückung', () => {
    const raw = '#### Quellenanalyse:\nQ.\n\n  **Finaler Text**\nDer finale Satz.';
    const out = parseSkillOutput(raw);
    expect(out.quellenanalyse).toBe('Q.');
    expect(out.finalerText).toBe('Der finale Satz.');
    expect(out.warnung).toBeUndefined();
  });

  it('erkennt Prosa ohne führenden Marker NICHT als Überschrift', () => {
    const raw = 'Der Entwurf des Systems ist robust. Der Finaler Text folgt im Antrag.';
    const out = parseSkillOutput(raw);
    // kein Gerüst → alles als finalerText (matches.length === 0)
    expect(out.finalerText).toBe(raw);
    expect(out.warnung).toBeDefined();
  });

  it('liefert bei erkennbarem Gerüst NIE die Quellenanalyse als finalerText (Regression)', () => {
    // Fett-umschlossenes Gerüst, kein „Finaler Text"/„Entwurf" → Fallback darf den
    // Zitat-Block NICHT durchreichen.
    const raw = '**### Quellenanalyse**\n„GEHEIMES-ZITAT“ (1.1)\nMehr Zitate hier.';
    const out = parseSkillOutput(raw);
    expect(out.finalerText).not.toContain('GEHEIMES-ZITAT');
    expect(out.finalerText).toBe('');
    expect(out.warnung).toBeDefined();
  });
});

describe('parseSkillOutput — strukturierte Teile (teilStruktur)', () => {
  const STRUKTUR = [
    { key: 'hintergrund', label: 'Hintergrund' },
    { key: 'stand_der_technik', label: 'Stand der Technik' },
    { key: 'loesungsweg', label: 'Lösungsweg' },
  ];
  const finalerJson = (objs: string) => `### Quellenanalyse\nZitat. (VB 1)\n\n### Finaler Text\n${objs}`;

  it('mappt JSON-Teile in deklarierter Reihenfolge auf teile[] + joint finalerText', () => {
    const raw = finalerJson('[{"key":"hintergrund","text":"H-Text."},{"key":"stand_der_technik","text":"S-Text."},{"key":"loesungsweg","text":"L-Text."}]');
    const out = parseSkillOutput(raw, STRUKTUR, '\n\n');
    expect(out.teile).toHaveLength(3);
    expect(out.teile!.map(t => t.key)).toEqual(['hintergrund', 'stand_der_technik', 'loesungsweg']);
    // Label kommt aus der Deklaration (nie aus dem Modell-Output).
    expect(out.teile![0]).toEqual({ key: 'hintergrund', label: 'Hintergrund', text: 'H-Text.' });
    // finalerText = Teile per teilJoin verbunden, OHNE Badge/Label.
    expect(out.finalerText).toBe('H-Text.\n\nS-Text.\n\nL-Text.');
    expect(out.finalerText).not.toContain('Hintergrund');
  });

  it('respektiert die Deklarations-Reihenfolge auch bei vertauschter Modell-Reihenfolge', () => {
    const raw = finalerJson('[{"key":"loesungsweg","text":"L."},{"key":"hintergrund","text":"H."},{"key":"stand_der_technik","text":"S."}]');
    const out = parseSkillOutput(raw, STRUKTUR);
    expect(out.teile!.map(t => t.text)).toEqual(['H.', 'S.', 'L.']);
  });

  it('verwirft unbekannte Keys, lässt fehlende aus', () => {
    const raw = finalerJson('[{"key":"hintergrund","text":"H."},{"key":"erfunden","text":"X."}]');
    const out = parseSkillOutput(raw, STRUKTUR);
    expect(out.teile!.map(t => t.key)).toEqual(['hintergrund']);
    expect(out.finalerText).toBe('H.');
  });

  it('Truncation: angeschnittenes letztes Teil-Objekt verworfen, vordere überleben', () => {
    const raw = finalerJson('[{"key":"hintergrund","text":"H."},{"key":"stand_der_technik","text":"S."},{"key":"loesungsweg","text":"abge');
    const out = parseSkillOutput(raw, STRUKTUR);
    expect(out.teile!.map(t => t.key)).toEqual(['hintergrund', 'stand_der_technik']);
  });

  it('weicher teilJoin (\\n) für Fließtext-Skills', () => {
    const raw = finalerJson('[{"key":"hintergrund","text":"Satz eins."},{"key":"stand_der_technik","text":"Satz zwei."}]');
    const out = parseSkillOutput(raw, STRUKTUR, '\n');
    expect(out.finalerText).toBe('Satz eins.\nSatz zwei.');
  });

  it('Plain-Text-Fallback: Modell liefert Prosa statt JSON → heutiges Verhalten, teile undefiniert', () => {
    const raw = '### Finaler Text\nDas Vorhaben überwacht Prozesse dezentral und energieautark.';
    const out = parseSkillOutput(raw, STRUKTUR, '\n\n');
    expect(out.teile).toBeUndefined();
    expect(out.finalerText).toBe('Das Vorhaben überwacht Prozesse dezentral und energieautark.');
  });

  it('ohne teilStruktur: byte-identisch (kein teile-Feld, JSON bleibt roher finalerText)', () => {
    const json = '[{"key":"hintergrund","text":"H."}]';
    const raw = finalerJson(json);
    const out = parseSkillOutput(raw);
    expect(out.teile).toBeUndefined();
    expect(out.finalerText).toBe(json);
  });

  it('toleriert ```json-Fence um das Teile-Array', () => {
    const raw = '### Finaler Text\n```json\n[{"key":"hintergrund","text":"H."}]\n```';
    const out = parseSkillOutput(raw, STRUKTUR);
    expect(out.teile!.map(t => t.text)).toEqual(['H.']);
  });
});
