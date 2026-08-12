/**
 * Reine Bausteine des Hilfe-Fensters: Zeichenketten rein, Zeichenketten raus.
 *
 * Warum getrennt von `hilfeFenster.ts`: die Vitest-Suite läuft unter
 * `environment: 'node'` (vitest.config.mts) — es gibt weder jsdom noch
 * @testing-library. Alles, was als DOM-Baumbau geschrieben wäre, wäre damit
 * unprüfbar. Hier steht darum die gesamte Erzeugung als String-Arbeit; der
 * Nachbar `hilfeFenster.ts` bleibt eine dünne Schale, die sie ins Fenster hängt.
 */

import { marked } from 'marked';
import { sanitizeHtml } from '@/components/ui/MarkdownRenderer';
import {
  berechneAngedocktGeometrie,
  type Bildschirm,
  type FensterGeometrie,
} from '@/components/fenster/fensterGeometrie';

/** Ein Fenster pro App — der Name greift auch nach einem Reload des Openers. */
export const HILFE_FENSTER_NAME = 'teamflow-seitenhilfe';

/** Element-IDs, über die Aufbau und Aktualisierung sich wiederfinden. */
export const HILFE_IDS = {
  stil: 'tf-stil',
  titel: 'tf-titel',
  fest: 'tf-fest',
  hinweis: 'tf-hinweis',
  hinweisText: 'tf-hinweis-text',
  nachziehen: 'tf-nachziehen',
  inhalt: 'tf-inhalt',
} as const;

/**
 * Die Theme-Tokens, die das Fenster braucht. Kopiert werden die AUFGELÖSTEN
 * Werte (`getComputedStyle`) — damit stimmen Hell/Dunkel und der gewählte Akzent
 * automatisch, ohne dass theme.css (557 Zeilen) irgendwo zweitverwertet wird.
 *
 * Ein `theme.css?raw`-Import wäre der naheliegende, aber falsche Weg: die Datei
 * beginnt mit `@import "tailwindcss"` — im Fenster wären das tote Ladeversuche
 * unter `file://`, also Console-Fehler.
 */
export const LESE_TOKENS = [
  '--tf-bg',
  '--tf-bg-secondary',
  '--tf-text',
  '--tf-text-secondary',
  '--tf-border',
  '--tf-hover',
  '--tf-primary',
  '--tf-radius',
  '--tf-radius-sm',
] as const;

/** Breite des Fensters in px. */
export const HILFE_BREITE = 560;

// ── Textwerkzeuge ─────────────────────────────────────────────────────────────

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Hängt `target`/`rel` an externe Links. Ohne das navigiert ein Klick im Fenster
 * von `about:blank` weg — danach ist es cross-origin und der Parent kann es NIE
 * WIEDER beschreiben (`win.document` wirft). Heute trägt kein Kontext-Doc einen
 * externen Link; das hier ist die Versicherung gegen das erste, das einen bekommt.
 */
export function externeLinksIsolieren(html: string): string {
  return html.replace(
    /<a\s+([^>]*?)href="(https?:\/\/[^"]*)"([^>]*?)>/gi,
    (_treffer, vor: string, url: string, nach: string) =>
      `<a ${vor}href="${url}"${nach} target="_blank" rel="noopener noreferrer">`,
  );
}

/**
 * Macht relative `url(…)` in kopiertem CSS absolut. Nötig, weil das Fenster
 * `about:blank` ist und keine Basis-URL hat: im Single-File-Build sind die
 * Schrift-Dateien `data:`-URLs (`assetsInlineLimit: Infinity`) und bleiben
 * unangetastet, am Dev-Server sind sie relativ und liefen sonst ins Leere.
 */
export function machtUrlsAbsolut(css: string, basis: string): string {
  return css.replace(/url\((['"]?)([^'")]+)\1\)/gi, (treffer, anf: string, pfad: string) => {
    if (/^(data:|https?:|file:|\/\/)/i.test(pfad)) return treffer;
    try {
      return `url(${anf}${new URL(pfad, basis).href}${anf})`;
    } catch {
      return treffer;
    }
  });
}

/**
 * `:root`-Block aus den gelesenen Token-Werten. Werte mit CSS-Steuerzeichen
 * fallen raus — sie kämen zwar aus dem eigenen Dokument, aber ein Token ist
 * hier eine Zeichenkette, die ungeprüft in ein Stylesheet wandert.
 */
export function baueTokenBlock(werte: Record<string, string>): string {
  const zeilen: string[] = [];
  for (const name of LESE_TOKENS) {
    const wert = (werte[name] ?? '').trim();
    if (wert === '' || /[<>{};]/.test(wert)) continue;
    zeilen.push(`  ${name}: ${wert};`);
  }
  return `:root {\n${zeilen.join('\n')}\n}`;
}

/**
 * Grundregeln des Fensters. Die Tailwind-`[&_…]`-Kette aus MarkdownRenderer.tsx
 * gibt es hier nicht — sie lebt im Bundle des Hauptdokuments. Die Werte stehen
 * darum einmal als normales CSS, 1:1 zur Dialog-Fassung; einzig h2/h3 bekommen
 * Luft nach oben, weil dies eine Lesefläche ist und kein Ausschnitt.
 *
 * Das ist kein vermeidbares Duplikat: im Hauptdokument gilt Tailwind-Preflight
 * (genullte Margins), im Fenster nicht. Dieselben Regeln ohne Reset sähen anders
 * aus. Der Drift-Guard in `__tests__/hilfeFensterDokument.test.ts` hält beide
 * Listen deckungsgleich.
 */
export const HILFE_BASIS_CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; }
body {
  background: var(--tf-bg);
  color: var(--tf-text);
  font-family: 'Geist Variable', system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 0.875rem;
  display: flex;
  flex-direction: column;
}
.tf-kopf {
  position: sticky;
  top: 0;
  background: var(--tf-bg);
  border-bottom: 1px solid var(--tf-border);
  /* Seitliche Abstaende gleich denen des Inhalts, sonst steht die Ueberschrift
     eingerueckt gegen den Text darunter. */
  padding: 14px 28px 10px;
  flex: 0 0 auto;
}
/* Kopf und Inhalt teilen denselben Block, damit die Ueberschrift ueber dem Text
   sitzt und nicht daneben. Die seitlichen Abstaende stellt tf-kopf selbst.
   ACHTUNG: keine Backticks in diesen Kommentaren — der ganze Block ist ein
   Template-Literal, ein Backtick beendet ihn mittendrin. */
.tf-kopf .tf-spalte { padding: 0; }
.tf-kopf-zeile { display: flex; align-items: flex-start; gap: 12px; }
.tf-kopf h1 { font-size: 1.125rem; font-weight: 600; margin: 0; flex: 1 1 auto; }
.tf-unter { margin: 2px 0 0; font-size: 0.75rem; color: var(--tf-text-secondary); }
.tf-fest {
  display: flex; align-items: center; gap: 6px;
  font-size: 0.75rem; color: var(--tf-text-secondary);
  white-space: nowrap; cursor: pointer; user-select: none;
  padding: 3px 7px; border-radius: var(--tf-radius); flex: 0 0 auto;
}
.tf-fest:hover { background: var(--tf-hover); }
.tf-fest input { margin: 0; cursor: pointer; accent-color: var(--tf-primary); }
.tf-hinweis {
  display: none; align-items: center; gap: 8px; flex-wrap: wrap;
  margin-top: 10px; padding: 7px 10px;
  border: 1px solid var(--tf-border); border-left: 3px solid var(--tf-primary);
  border-radius: var(--tf-radius-sm);
  font-size: 0.75rem; color: var(--tf-text-secondary);
}
.tf-hinweis.tf-sichtbar { display: flex; }
.tf-hinweis button {
  font: inherit; color: var(--tf-primary); background: none;
  border: 1px solid var(--tf-border); border-radius: var(--tf-radius-sm);
  padding: 2px 8px; cursor: pointer;
}
.tf-hinweis button:hover { background: var(--tf-hover); }
/* Der Text laeuft ueber die volle Fensterbreite: wer das Fenster breiter zieht,
   will weniger scrollen, nicht eine schmale Spalte mit Rand daneben. Eine feste
   Leseweite (max-width) stand dem im Weg und ist bewusst raus. Der Scroller ist
   das <main>, der Block darin traegt nur die Innenabstaende — beides auf einem
   Element liesse die Bildlaufleiste mitten im Fenster stehen. */
main { flex: 1 1 auto; overflow-y: auto; }
.tf-spalte { width: 100%; }
main .tf-spalte { padding: 16px 28px 40px; line-height: 1.625; }
/* Eine Stufe unter dem Fenstertitel (tf-kopf h1, 1.125rem/600) — dieselbe Leiter
   wie im Hilfe-Dialog (MarkdownRenderer, Stufe "unterTitel"): 18 / 16 / 14 px.
   Der Text steht hier unter einer Ueberschrift, die schon da ist; groessere
   Abschnittszeilen stellten die Hierarchie auf den Kopf. */
main h1 { font-size: 1.125rem; font-weight: 600; margin: 0 0 0.75rem; }
main h2 { font-size: 1rem; font-weight: 600; margin: 1.5rem 0 0.5rem; }
main h3 { font-size: 0.875rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
main h2:first-child, main h3:first-child { margin-top: 0; }
main p { margin: 0 0 0.75rem; }
main ul { list-style: disc; padding-left: 1.25rem; margin: 0 0 0.75rem; }
main ol { list-style: decimal; padding-left: 1.25rem; margin: 0 0 0.75rem; }
main ul ul { list-style: circle; margin-top: 0.25rem; margin-bottom: 0; }
main li { margin-bottom: 0.25rem; }
main code {
  background: var(--tf-bg-secondary); padding: 0.125rem 0.375rem;
  border-radius: 0.25rem; font-size: 0.75rem;
}
main pre {
  background: var(--tf-bg-secondary); padding: 1rem;
  border-radius: var(--tf-radius-sm); overflow-x: auto; margin: 0 0 0.75rem;
}
main pre code { background: none; padding: 0; }
main table { width: 100%; border-collapse: collapse; margin: 0 0 0.75rem; }
main th {
  border: 1px solid var(--tf-border); padding: 0.5rem 0.75rem;
  text-align: left; background: var(--tf-bg-secondary);
}
main td { border: 1px solid var(--tf-border); padding: 0.5rem 0.75rem; }
main a { color: var(--tf-primary); text-decoration: underline; }
main blockquote {
  border-left: 4px solid var(--tf-primary); padding-left: 1rem;
  font-style: italic; color: var(--tf-text-secondary); margin: 0 0 0.75rem;
}
main strong { font-weight: 600; }
`;

/** Vollständiges Stylesheet: Schrift-Regeln der App + Tokens + Grundregeln. */
export function baueHilfeCss(werte: Record<string, string>, schriftCss = ''): string {
  return `${schriftCss}\n${baueTokenBlock(werte)}\n${HILFE_BASIS_CSS}`;
}

// ── Inhalt ────────────────────────────────────────────────────────────────────

/** Markdown → sanitisiertes, link-isoliertes HTML. Derselbe Weg wie der Dialog. */
export function hilfeAlsHtml(markdown: string): string {
  return externeLinksIsolieren(sanitizeHtml(marked.parse(markdown, { async: false }) as string));
}

/** Fenstertitel für Taskleiste, Alt-Tab und Screenreader-Ansage. */
export function fensterTitel(seitenTitel: string): string {
  const titel = seitenTitel.trim();
  return titel === '' ? 'Hilfe · TeamFlow' : `Hilfe: ${titel} · TeamFlow`;
}

/**
 * Zeile für den festgehaltenen Zustand, oder `null`. Ohne sie zeigt ein
 * festgehaltenes Fenster stillschweigend die Anleitung einer Seite, auf der man
 * gar nicht mehr ist — genau die Verwechslung, die das Fenster verhindern soll.
 */
export function hinweisText(
  festgehalten: boolean,
  gezeigteSeiteId: string,
  appSeiteId: string,
  appSeiteName: string,
): string | null {
  if (!festgehalten || appSeiteId === '' || appSeiteId === gezeigteSeiteId) return null;
  const name = appSeiteName.trim() === '' ? 'einer anderen Seite' : `„${appSeiteName}"`;
  return `Festgehalten — die App steht auf ${name}.`;
}

/** Kopfzeile + leerer Inhaltsbereich als HTML-String (`document.body.innerHTML`). */
export function baueGeruestHtml(): string {
  return `<header class="tf-kopf">
  <div class="tf-spalte">
    <div class="tf-kopf-zeile">
      <h1 id="${HILFE_IDS.titel}"></h1>
      <label class="tf-fest" title="Hält diese Anleitung fest, auch wenn Sie in der App auf eine andere Seite wechseln.">
        <input type="checkbox" id="${HILFE_IDS.fest}"><span>Anleitung festhalten</span>
      </label>
    </div>
    <p class="tf-unter">Kurzanleitung zu dieser Seite</p>
    <div class="tf-hinweis" id="${HILFE_IDS.hinweis}">
      <span id="${HILFE_IDS.hinweisText}"></span>
      <button type="button" id="${HILFE_IDS.nachziehen}">Mitlaufen lassen</button>
    </div>
  </div>
</header>
<main><div class="tf-spalte" id="${HILFE_IDS.inhalt}"></div></main>`;
}

/** `<head>`-Inhalt. Das `<style>` wird später einzeln nachgezogen (Theme-Wechsel). */
export function baueKopfHtml(css: string): string {
  return `<meta charset="utf-8"><style id="${HILFE_IDS.stil}">${css}</style>`;
}

// ── Geometrie ─────────────────────────────────────────────────────────────────
// Wohnt seit v3.47 in `components/fenster/fensterGeometrie.ts` — dort, wo auch
// das Kanban-Vollbild sie liest. Hier bleiben die Namen, unter denen die Hilfe
// sie kennt, damit dieser Umzug an ihr spurlos vorbeigeht.

export type { Bildschirm, FensterGeometrie } from '@/components/fenster/fensterGeometrie';
export { fensterFeatures } from '@/components/fenster/fensterGeometrie';

/** Rechts angedockt, volle nutzbare Höhe — die App bleibt links daneben sichtbar. */
export function berechneGeometrie(schirm: Bildschirm, breite = HILFE_BREITE): FensterGeometrie {
  return berechneAngedocktGeometrie(schirm, breite);
}
