import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  entferneTechnik, getAppUeberblick, getKnownScreenContextIds, getSeitenHilfe, teileTitel,
  KURATION_PLUGIN_IDS,
} from '../screenContext';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const DOCS_DIR = join(REPO, 'docs', 'feedback-kontext');
const PLUGINS_DIR = join(REPO, 'src', 'plugins');

const SEITEN_DOCS = readdirSync(DOCS_DIR)
  .filter(name => name.endsWith('.md') && name.toLowerCase() !== 'readme.md');

/** Plugins, die nur noch auf eine andere Seite umleiten (kein eigener Bildschirm). */
const REDIRECT_SEITEN = new Set(['chat', 'feedback-kuration']);

/**
 * Seiten, die ein Doc haben und darum auch den Hilfe-Knopf tragen müssen.
 * `kuration` ist keine Plugin-ID, sondern das gemeinsame Doc der sieben
 * Kurator-Seiten — die stehen einzeln in KURATION_PLUGIN_IDS.
 */
const HILFE_PFLICHT: string[] = [
  ...getKnownScreenContextIds().filter(id => id !== 'kuration'),
  ...KURATION_PLUGIN_IDS,
]
  // `hideFromNav`-Redirects haben keinen eigenen Seitenkopf, also auch keinen Platz
  // für den Hilfe-Knopf; ihr Doc dient nur noch der Feedback-KI (sie erklärt, wohin
  // die Seite aufgegangen ist). `chat` → /suche?assistent=1 (Panel-Umbau),
  // `feedback-kuration` → /feedback-board (v2.364, Verwaltung ist im Board).
  .filter(id => !REDIRECT_SEITEN.has(id));

/** Alle `pluginId="…"`-Werte, mit denen der Hilfe-Knopf irgendwo eingebaut ist. */
function verdrahteteIds(): Set<string> {
  const treffer = new Set<string>();
  const dateien = readdirSync(PLUGINS_DIR, { recursive: true, encoding: 'utf-8' })
    .filter(p => p.endsWith('.tsx'));
  for (const rel of dateien) {
    const text = readFileSync(join(PLUGINS_DIR, rel), 'utf-8');
    for (const m of text.matchAll(/SeitenHilfeButton\s+pluginId="([^"]+)"/g)) {
      treffer.add(m[1] ?? '');
    }
  }
  return treffer;
}

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

describe('getAppUeberblick', () => {
  // Speist den Abschnitt „Überblick" in „Über die App". Bis v2.360 sah `_app.md`
  // nur die Feedback-KI — deshalb stand der Deployment-Absatz oben mitten im Text.
  it('liefert den App-Ueberblick ohne den Technik-Teil', () => {
    const ueberblick = getAppUeberblick();
    expect(ueberblick).not.toBeNull();
    expect(ueberblick?.markdown).toContain('Förderanträge');
    expect(ueberblick?.markdown).not.toContain('Single-File-Build');
    expect(ueberblick?.markdown).not.toContain('IndexedDB');
    expect(ueberblick?.markdown).not.toContain('hideFromNav');
  });
});

describe('jede Seite mit Doc traegt auch den Hilfe-Knopf', () => {
  // Der Coverage-Guard erzwingt das DOC; ohne diesen hier haette eine neue Seite
  // zwar Hilfe-Text, aber keinen Weg dorthin — und niemand merkt es.
  it('kein Doc ohne Einbau', () => {
    const eingebaut = verdrahteteIds();
    const fehlend = HILFE_PFLICHT.filter(id => !eingebaut.has(id));
    expect(
      fehlend,
      `Diesen Seiten fehlt <SeitenHilfeButton pluginId="…" /> im Seitenkopf:\n` +
      `${fehlend.join(', ')}\n` +
      `Einbau ist eine Zeile (actions-Slot des PageHeader bzw. rechts neben der H1).`,
    ).toEqual([]);
  });

  it('kein Einbau ohne Doc (Tippfehler in der pluginId)', () => {
    const unbekannt = [...verdrahteteIds()].filter(id => getSeitenHilfe(id) === null);
    expect(
      unbekannt,
      `Fuer diese pluginIds gibt es kein Kontext-Doc — der Knopf rendert dort nichts:\n` +
      `${unbekannt.join(', ')}`,
    ).toEqual([]);
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
