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

/**
 * Zwei Wege, den Hilfe-Knopf zu verdrahten:
 *
 *  1. direkt im Seitenkopf — `<SeitenHilfeButton pluginId="…" />`;
 *  2. als Hub in der Einstellungs-Seitenform — die Seite reicht ihre `pluginId`
 *     an `SettingsHubPage`, und der Rahmen setzt den Knopf (seit v4.33 tun das
 *     Einstellungen und Kuration).
 *
 * Beide zaehlen als Einbau; entscheidend ist, dass es einen Weg zur Hilfe gibt,
 * nicht welche Datei den Knopf schreibt.
 */
const EINBAU_MUSTER = [
  /SeitenHilfeButton\s+pluginId="([^"]+)"/g,
  /SettingsHubPage[^>]*\spluginId="([^"]+)"/g,
];

/** Alle `pluginId="…"`-Werte, mit denen der Hilfe-Knopf irgendwo eingebaut ist. */
function verdrahteteIds(): Set<string> {
  const treffer = new Set<string>();
  const dateien = readdirSync(PLUGINS_DIR, { recursive: true, encoding: 'utf-8' })
    .filter(p => p.endsWith('.tsx'));
  for (const rel of dateien) {
    const text = readFileSync(join(PLUGINS_DIR, rel), 'utf-8');
    for (const muster of EINBAU_MUSTER) {
      for (const m of text.matchAll(muster)) treffer.add(m[1] ?? '');
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

/** Genau der Text, den der Hilfe-Dialog rendert. */
function sichtbarerText(name: string): string {
  return entferneTechnik(readFileSync(join(DOCS_DIR, name), 'utf-8'));
}

/**
 * Der sichtbare Text, zerlegt in das, was der Leser als einen Block wahrnimmt:
 * Leerzeilen trennen, und jede Aufzaehlungs-/Ueberschriftenzeile beginnt einen neuen
 * Block. Fortsetzungszeilen gehoeren zum laufenden Block — `marked` laeuft mit
 * `breaks: false`, ein Hard-Wrap im Quelltext ist im Dialog also unsichtbar.
 */
function absaetze(sichtbar: string): string[] {
  const blocks: string[] = [];
  let aktuell: string[] = [];
  const schliessen = (): void => {
    const text = aktuell.join(' ').trim();
    if (text !== '') blocks.push(text);
    aktuell = [];
  };
  for (const zeile of sichtbar.split(/\r?\n/)) {
    if (zeile.trim() === '') { schliessen(); continue; }
    if (/^\s*([-*]\s|#{1,6}\s)/.test(zeile)) schliessen();
    aktuell.push(zeile.trim());
  }
  schliessen();
  return blocks;
}

describe('kein Kontext-Doc zeigt Nutzern Code-Interna', () => {
  // Die Docs dienen zwei Konsumenten (Feedback-KI + Seiten-Hilfe). Code-Pfade
  // duerfen deshalb nur in den Technik-Teilen stehen, die entferneTechnik kappt —
  // sonst liest ein Sachbearbeiter Dateinamen. Stand heute halten das alle Docs
  // ein; der Test haelt es so.
  it.each(SEITEN_DOCS)('%s enthaelt nach dem Strip keine Datei-/Pfadangaben', (name) => {
    const treffer = sichtbarerText(name)
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

  // Der Test oben faengt Datei-Pfade — nicht aber Routen (`/status-cockpit`),
  // Feature-Flags (`statusCockpit`) und Komponentennamen (`KompaktListe`), die
  // genauso nur Entwickler etwas angehen. Beides zusammen ergibt die Zusage:
  // oberhalb von "## Technik" steht kein Bezeichner aus dem Code.
  it.each(SEITEN_DOCS)('%s nennt Nutzern keine Routen/Flags/Komponenten', (name) => {
    const tokens = [...sichtbarerText(name).matchAll(/`([^`\n]+)`/g)].map(m => m[1] ?? '');
    const treffer = tokens.filter(t =>
      // routenfoermig: /status-cockpit, /chat
      /^\/[a-z0-9][a-z0-9/_-]*$/.test(t) ||
      // Bezeichner mit Camel-/Pascal-Hoecker: statusCockpit, KompaktListe.
      // Fachliche Kuerzel ohne Hoecker (`MS01`, `16KN######`, `.msg`) bleiben erlaubt.
      (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(t) && /[a-z][A-Z]/.test(t)),
    );
    expect(
      treffer,
      `${name}: Diese Bezeichner sieht der Nutzer im Hilfe-Dialog:\n` +
      `${treffer.map(t => `  \`${t}\``).join('\n')}\n` +
      `Loesung: im sichtbaren Teil streichen oder umschreiben ` +
      `("die Kompakt-Spalte" statt \`KompaktListe\`); Technisches gehoert unter "## Technik".`,
    ).toEqual([]);
  });

  it.each(SEITEN_DOCS)('%s zeigt keine Technik-Fett-Label', (name) => {
    // Faengt die Variante, die entferneTechnik NICHT kennt — "**Datenmodell:**"
    // statt "**Datenmodell dahinter:**" stand so lange sichtbar im MAP-Doc.
    const treffer = sichtbarerText(name)
      .split(/\r?\n/)
      .filter(z => /^\s*\*\*(Datenmodell|Code|Route|Flag|Technik)/i.test(z));
    expect(
      treffer,
      `${name}: Technik-Block im sichtbaren Teil.\n${treffer.join('\n')}\n` +
      `Loesung: ans Doc-Ende unter eine "## Technik"-Ueberschrift verschieben.`,
    ).toEqual([]);
  });
});

describe('jedes Kontext-Doc ist lesbar strukturiert', () => {
  // marked laeuft mit `breaks: false` (siehe MarkdownRenderer): OHNE Leerzeilen
  // verschmilzt ein ganzes Doc zu EINEM Absatz. Genau so sahen bis v2.369 neun
  // der Docs im Hilfe-Dialog aus — eine Bleiwueste, die niemand liest.
  //
  // Die Schwelle darf nur SINKEN. Erste Fassung war 1200 (der Wert, der die neun
  // Bleiwuesten riss und alle anderen durchliess) — zu lasch: auslastung.md lag mit
  // 1151 knapp darunter und war beim Gegenlesen trotzdem eine Wand. Seither sind
  // auch dessen Tab-Beschreibungen Unterpunkte; 700 ist die neue Obergrenze.
  const MAX_ABSCHNITT_CHARS = 700;

  it.each(SEITEN_DOCS)(`%s hat keinen Absatz ueber ${MAX_ABSCHNITT_CHARS} Zeichen`, (name) => {
    const zuLang = absaetze(sichtbarerText(name))
      .filter(a => a.length > MAX_ABSCHNITT_CHARS)
      .map(a => `  ${a.length} Zeichen: ${a.slice(0, 90)}…`);
    expect(
      zuLang,
      `${name}: Absatz zu lang fuer den Hilfe-Dialog (max. ${MAX_ABSCHNITT_CHARS}).\n` +
      `${zuLang.join('\n')}\n` +
      `Loesung: in Unterpunkte je UI-Bereich brechen (Vorbild: auslastung.md).`,
    ).toEqual([]);
  });

  it.each(SEITEN_DOCS)('%s fuehrt "Typische Aktionen" als Liste', (name) => {
    const zeilen = sichtbarerText(name).split(/\r?\n/);
    const idx = zeilen.findIndex(z => /^\s*(\*\*Typische Aktionen:?\*\*|#{2,3}\s+Typische Aktionen)/i.test(z));
    if (idx === -1) return; // Docs mit eigener Gliederung (kuration, meilensteine, …)

    const rest = (zeilen[idx] ?? '').replace(/^\s*(\*\*Typische Aktionen:?\*\*|#{2,3}\s+Typische Aktionen)/i, '').trim();
    expect(rest, `${name}: "Typische Aktionen" muss allein auf seiner Zeile stehen, gefolgt von "- "-Punkten.`)
      .toBe('');

    const naechste = zeilen.slice(idx + 1).find(z => z.trim() !== '') ?? '';
    expect(naechste.trimStart(), `${name}: nach "Typische Aktionen" folgt keine Aufzaehlung.`)
      .toMatch(/^-\s/);
  });

  it.each(SEITEN_DOCS)('%s stellt "## Technik" ans Doc-Ende', (name) => {
    // entferneTechnik bricht bei der ERSTEN Technik-Ueberschrift ab. Was danach
    // kommt, sieht kein Nutzer mehr — auch versehentlich dorthin gerutschter
    // Nutzertext nicht, und das faellt sonst niemandem auf.
    const zeilen = readFileSync(join(DOCS_DIR, name), 'utf-8').split(/\r?\n/);
    const idx = zeilen.findIndex(z => /^#{2,3}\s+Technik\b/i.test(z.trimStart()));
    if (idx === -1) return;

    const danach = zeilen.slice(idx + 1).filter(z => /^#{1,6}\s+\S/.test(z.trimStart()));
    expect(
      danach,
      `${name}: Ueberschrift NACH "## Technik" — dieser Teil ist im Hilfe-Dialog unsichtbar:\n` +
      `${danach.join('\n')}`,
    ).toEqual([]);
  });
});
