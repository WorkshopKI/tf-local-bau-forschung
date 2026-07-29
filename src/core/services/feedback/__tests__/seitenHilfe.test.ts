import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entferneTechnik, getSeitenHilfe, teileTitel } from '../screenContext';

const DOCS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', '..', '..',
  'docs', 'feedback-kontext',
);

const SEITEN_DOCS = readdirSync(DOCS_DIR)
  .filter(name => name.endsWith('.md') && name.toLowerCase() !== 'readme.md');

describe('entferneTechnik', () => {
  it('schneidet ab der Technik-Ueberschrift bis Dateiende ab', () => {
    const gestrippt = entferneTechnik(
      '# Titel\n\nSichtbarer Text.\n\n## Technik\n\nRoute `/x`, Flag `y`.\n',
    );
    expect(gestrippt).toContain('Sichtbarer Text.');
    expect(gestrippt).not.toContain('Technik');
    expect(gestrippt).not.toContain('Flag');
  });

  it('entfernt die Technik-Fett-Label, laesst die anderen stehen', () => {
    const gestrippt = entferneTechnik(
      '**Zweck:** Arbeitsseite.\n' +
      '**Datenmodell dahinter:** `useStore` (IDB).\n' +
      '**Typische Aktionen:** suchen, filtern.\n' +
      '**Code:** `src/plugins/x/` — `XPage.tsx`.\n',
    );
    expect(gestrippt).toContain('**Zweck:**');
    expect(gestrippt).toContain('**Typische Aktionen:**');
    expect(gestrippt).not.toContain('Datenmodell dahinter');
    expect(gestrippt).not.toContain('XPage.tsx');
  });

  it('laesst ein Doc ohne Technik-Teile unveraendert (bis auf trim)', () => {
    const doc = '# Titel\n\n- Punkt eins\n- Punkt zwei';
    expect(entferneTechnik(doc)).toBe(doc);
  });
});

describe('teileTitel', () => {
  it('zieht die H1 heraus und gibt den Rest als Rumpf zurueck', () => {
    expect(teileTitel('# Fristen & Meilensteine\n\nText.')).toEqual({
      titel: 'Fristen & Meilensteine',
      rumpf: 'Text.',
    });
  });

  it('kommt ohne H1 aus', () => {
    expect(teileTitel('Nur Text.')).toEqual({ titel: '', rumpf: 'Nur Text.' });
  });
});

describe('getSeitenHilfe', () => {
  it('liefert Titel und Rumpf des Meilenstein-Docs ohne Technik-Teil', () => {
    const hilfe = getSeitenHilfe('meilensteine');
    expect(hilfe).not.toBeNull();
    expect(hilfe?.titel).toBe('Fristen & Meilensteine');
    expect(hilfe?.markdown).toContain('Diese Woche');
    // Route + Feature-Flag stehen unter `## Technik` und gehen den Nutzer nichts an.
    expect(hilfe?.markdown).not.toContain('meilensteinMonitoring');
  });

  it('liefert null fuer eine Seite ohne Kontext-Doc', () => {
    expect(getSeitenHilfe('gibt-es-nicht')).toBeNull();
  });
});

describe('kein Kontext-Doc zeigt Nutzern Code-Interna', () => {
  // Die Docs dienen zwei Konsumenten (Feedback-KI + Seiten-Hilfe). Code-Pfade
  // duerfen deshalb nur in den Technik-Teilen stehen, die entferneTechnik kappt —
  // sonst liest ein Sachbearbeiter Dateinamen. Stand heute halten das alle Docs
  // ein; der Test haelt es so.
  it.each(SEITEN_DOCS)('%s enthaelt nach dem Strip keine Datei-/Pfadangaben', (name) => {
    const sichtbar = entferneTechnik(readFileSync(join(DOCS_DIR, name), 'utf-8'));
    const treffer = sichtbar
      .split(/\r?\n/)
      .filter(z => /src\/|\.tsx|\.ts\b/.test(z));
    expect(
      treffer,
      `${name}: Code-Angaben ausserhalb des Technik-Teils.\n` +
      `Diese Zeilen sieht der Nutzer im Hilfe-Dialog:\n${treffer.join('\n')}\n` +
      `Loesung: nach unten unter eine "## Technik"-Ueberschrift verschieben ` +
      `(die KI bekommt weiterhin das ganze Doc).`,
    ).toEqual([]);
  });
});
