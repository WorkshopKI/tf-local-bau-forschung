/**
 * Guards der Sichtbarkeits-Achsen.
 *
 * Modul-lokal statt in `src/__tests__/conventions-*.test.ts`: sie prüfen den
 * Katalog dieses Moduls gegen seine Quellen, nicht eine projektweite
 * Schreibregel. Nur `sichtbarkeit-eine-mechanik` ist ein echter Codebase-Scan
 * und steht deshalb am Ende mit derselben Marker-Konvention
 * (`// allow-sichtbarkeit-eine-mechanik: <grund>`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SICHTBARKEITS_KATALOG } from '../katalog';
import { istMarkiert } from '../regel';
import { seiteId, widgetId, abschnittId } from '../types';
import { ALL_TS_FILES, relPath } from '@/__tests__/conventions-lib';

const SRC = join(__dirname, '..', '..', '..');

/** Plugin-Ids per Text-Scan: `plugins.config.ts` zu importieren bricht unter Vitest (pdfjs-Worker). */
function pluginIds(): string[] {
  const basis = join(SRC, 'plugins');
  const ids: string[] = [];
  for (const ordner of readdirSync(basis, { withFileTypes: true })) {
    if (!ordner.isDirectory()) continue;
    for (const datei of ['index.ts', 'index.tsx']) {
      const pfad = join(basis, ordner.name, datei);
      if (!existsSync(pfad)) continue;
      const treffer = /^\s{2}id: '([^']+)'/m.exec(readFileSync(pfad, 'utf8'));
      if (treffer?.[1]) ids.push(treffer[1]);
    }
  }
  return ids;
}

function textVon(...teile: string[]): string {
  return readFileSync(join(SRC, ...teile), 'utf8');
}

const IDS = new Set(SICHTBARKEITS_KATALOG.map(e => e.id));

describe('sichtbarkeit-katalog', () => {
  it('vergibt jede Id genau einmal', () => {
    const gesehen = new Set<string>();
    const doppelt: string[] = [];
    for (const e of SICHTBARKEITS_KATALOG) {
      if (gesehen.has(e.id)) doppelt.push(e.id);
      gesehen.add(e.id);
    }
    expect(doppelt, `Doppelte Katalog-Ids: ${doppelt.join(', ')}`).toEqual([]);
  });

  it('sichtbarkeit-katalog-deckt-plugins — jedes Plugin hat einen seite:-Eintrag', () => {
    const fehlend = pluginIds().filter(id => !IDS.has(seiteId(id)));
    expect(
      fehlend,
      `Ohne Katalog-Eintrag kann der Kurator diese Seiten nicht kennzeichnen:\n` +
      fehlend.map(id => `  seite('${id}', '…'),`).join('\n') +
      `\nErgänzen in src/core/sichtbarkeit/katalog.ts.`,
    ).toEqual([]);
  });

  it('sichtbarkeit-deckt-widgets — jeder WidgetTyp hat einen widget:-Eintrag', () => {
    const text = textVon('plugins', 'home', 'widgets', 'widgetCatalog.ts');
    const typen = [...text.matchAll(/^ {4}typ: '([^']+)'/gm)].map(m => m[1] as string);
    expect(typen.length, 'Text-Scan von WIDGET_KATALOG lieferte nichts — Format geändert?').toBeGreaterThan(10);
    const fehlend = typen.filter(t => !IDS.has(widgetId(t)));
    expect(fehlend, `Widgets ohne Katalog-Eintrag: ${fehlend.join(', ')}`).toEqual([]);
  });

  it('sichtbarkeit-deckt-detailsektionen — jede DetailSektionId hat einen Eintrag', () => {
    const text = textVon('plugins', 'antraege', 'detailSektionen.ts');
    const block = /export type DetailSektionId =([\s\S]*?);/.exec(text)?.[1] ?? '';
    const sektionen = [...block.matchAll(/'([^']+)'/g)].map(m => m[1] as string);
    expect(sektionen.length, 'DetailSektionId-Union nicht gefunden').toBeGreaterThan(10);
    const fehlend = sektionen.filter(s => !IDS.has(abschnittId('antraege', `detail-${s}`)));
    expect(fehlend, `Detail-Sektionen ohne Katalog-Eintrag: ${fehlend.join(', ')}`).toEqual([]);
  });

  it('sichtbarkeit-unantastbar — die Wege zu den Schaltern tragen nie eine Marke', () => {
    const pflicht = [
      seiteId('home'),
      seiteId('einstellungen'),
      seiteId('kuration'),
      'reiter:einstellungen/profil',
      'reiter:kuration/sichtbarkeit',
      abschnittId('einstellungen', 'sec-umfang'),
      abschnittId('einstellungen', 'sec-kurator'),
      abschnittId('einstellungen', 'sec-freischaltung'),
      abschnittId('kuration', 'sec-sichtbarkeit'),
    ];
    for (const id of pflicht) {
      const e = SICHTBARKEITS_KATALOG.find(k => k.id === id);
      expect(e, `${id} fehlt im Katalog`).toBeDefined();
      expect(e?.unantastbar, `${id} muss unantastbar sein`).toBe(true);
      expect(istMarkiert(e?.marken ?? {}), `${id} darf keine Marke tragen`).toBe(false);
    }
  });

  it('sichtbarkeit-seite-behaelt-reiter — keine Seite verliert alle Reiter', () => {
    const reiterJeSeite = new Map<string, { alle: number; offen: number }>();
    for (const e of SICHTBARKEITS_KATALOG) {
      if (e.art !== 'reiter') continue;
      const stand = reiterJeSeite.get(e.seite) ?? { alle: 0, offen: 0 };
      stand.alle++;
      if (!istMarkiert(e.marken)) stand.offen++;
      reiterJeSeite.set(e.seite, stand);
    }
    const leer = [...reiterJeSeite.entries()].filter(([, s]) => s.offen === 0).map(([s]) => s);
    expect(
      leer,
      `Diese Seiten hätten mit ausgeschalteten Schaltern eine leere Reiter-Leiste: ${leer.join(', ')}`,
    ).toEqual([]);
  });

  it('sichtbarkeit-ids-existieren — jede Karten-Id im Baum steht im Katalog, und umgekehrt', () => {
    // Nur die ZWEI-Literal-Form: `abschnittId(hub, id)` mit Variablen (Settings-
    // Registry, Detail-Rahmen) baut seine Ids aus geprüften Quellen und ist
    // hier nicht gemeint.
    const muster = /abschnittId\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g;
    const gefunden = new Map<string, string>();   // Id → erste Fundstelle
    for (const datei of ALL_TS_FILES) {
      const rel = relPath(datei).replace(/\\/g, '/');
      if (rel.startsWith('src/core/sichtbarkeit/')) continue;
      for (const t of readFileSync(datei, 'utf8').matchAll(muster)) {
        const id = abschnittId(t[1] as string, t[2] as string);
        if (!gefunden.has(id)) gefunden.set(id, rel);
      }
    }
    expect(gefunden.size, 'Der Scan fand keine einzige Id — Aufrufform geändert?').toBeGreaterThan(10);

    const unbekannt = [...gefunden].filter(([id]) => !IDS.has(id));
    expect(
      unbekannt.map(([id, wo]) => `${id}  (${wo})`),
      `Diese Ids stehen im Baum, aber nicht im Katalog — der Abschnitt wäre für den\n` +
      `Kurator unsichtbar und für useSichtbar() immer sichtbar (unbekannt = sichtbar).`,
    ).toEqual([]);

    // Gegenrichtung: ein Karten-Eintrag ohne Hülle im Baum ist ein Schalter in
    // der Kurator-GUI, der nichts schaltet.
    const verwaist = SICHTBARKEITS_KATALOG
      .filter(e => e.art === 'abschnitt' && e.id.includes('/karte-'))
      .map(e => e.id)
      .filter(id => !gefunden.has(id));
    expect(
      verwaist,
      `Karten-Einträge ohne <WennSichtbar> im Baum — die Kurator-GUI zeigte einen\n` +
      `Schalter ohne Wirkung:\n  ${verwaist.join('\n  ')}`,
    ).toEqual([]);
  });

  it('sichtbarkeit-keine-doppelmarke — ein Kind wiederholt die Marke seines Wirts nicht', () => {
    const seiten = new Map(
      SICHTBARKEITS_KATALOG.filter(e => e.art === 'seite').map(e => [e.seite, e.marken]),
    );
    const doppelt: string[] = [];
    for (const e of SICHTBARKEITS_KATALOG) {
      if (e.art === 'seite') continue;
      const wirt = seiten.get(e.seite);
      if (!wirt) continue;
      if (e.marken.beta && wirt.beta) doppelt.push(`${e.id} (beta)`);
      if (e.marken.experte && wirt.experte) doppelt.push(`${e.id} (experte)`);
    }
    expect(
      doppelt,
      `Die Marke der Seite verbirgt das Kind ohnehin mit — eine zweite Marke wäre eine\n` +
      `zweite Stelle, an der dieselbe Aussage gepflegt werden muss:\n  ${doppelt.join('\n  ')}`,
    ).toEqual([]);
  });
});

describe('sichtbarkeit-eine-mechanik', () => {
  /** Nur diese drei dürfen die Rohfelder lesen; überall sonst fragt man `useSichtbar()`. */
  const ERLAUBT = [
    'src/core/hooks/useSichtbar.ts',
    'src/core/types/config.ts',
    'src/plugins/einstellungen/profil/UmfangGruppe.tsx',
  ];

  it('niemand liest profile.beta_features / experten_modus selbst', () => {
    const muster = /\b(beta_features|experten_modus)\b/;
    const treffer: string[] = [];
    for (const datei of ALL_TS_FILES) {
      const rel = relPath(datei).replace(/\\/g, '/');
      if (ERLAUBT.includes(rel) || rel.includes('__tests__')) continue;
      const zeilen = readFileSync(datei, 'utf8').split('\n');
      zeilen.forEach((zeile, i) => {
        if (!muster.test(zeile)) return;
        if (zeile.includes('allow-sichtbarkeit-eine-mechanik')) return;
        treffer.push(`${rel}:${i + 1}`);
      });
    }
    expect(
      treffer,
      `Die beiden Profil-Schalter werden über useSichtbar() gelesen, nie direkt —\n` +
      `sonst entsteht neben der UND-Regel eine zweite, die irgendwann anders antwortet.\n\n` +
      treffer.join('\n'),
    ).toEqual([]);
  });
});
