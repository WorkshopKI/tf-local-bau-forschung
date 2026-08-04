/**
 * Seiten-Hilfe als eigenes Browser-Fenster — die Kurzanleitung NEBEN der App
 * statt als Modal DARÜBER.
 *
 * Der Dialog (`SeitenHilfeButton`) legt sich mit `h-[92vh]` über genau die Seite,
 * die er erklärt: wer die Schritte nachvollziehen will, schließt ihn, merkt sich
 * den Absatz, klickt, öffnet ihn wieder. Dieses Fenster löst das — es bleibt
 * stehen und läuft beim Seitenwechsel mit.
 *
 * Diese Datei ist die dünne Schale mit den Seiteneffekten; erzeugt wird alles in
 * `hilfeFensterDokument.ts` (rein und damit unter `environment: 'node'` prüfbar).
 *
 * ── Warum `about:blank` + DOM statt Blob-URL oder `document.write` ────────────
 * `window.open('', NAME, …)` mit LEERER URL navigiert nicht — das Fenster bleibt
 * das initiale `about:blank` und erbt die Herkunft des Openers. Der Parent hat
 * damit vollen DOM-Zugriff. Das trägt drei Zusagen:
 *  - Unter `file://` wäre `URL.createObjectURL` eine `blob:null/…`-URL mit
 *    opaquer Herkunft — für Top-Level-Navigation in Chrome unzuverlässig und im
 *    Projekt nirgends belegt. `window.open()` dagegen steht in
 *    docs/agents/file-protocol-pitfalls.md ausdrücklich als „OK unter file://".
 *  - Kein `document.write`: Text über DOM-APIs zu setzen kennt keine
 *    Encoding-Falle, ein geschriebener Byte-Strom schon (Umlaute).
 *  - Kein Script im Fenster: Feststeller und Escape hängen an `addEventListener`
 *    vom Parent aus. Es gibt also keine zweite Sanitizer-Oberfläche.
 *
 * ── Zwei Regeln aus dem Bestand, die den Aufruf formen ────────────────────────
 *  - `oeffneHilfeFenster` MUSS synchron aus einem User-Gesture-Handler laufen,
 *    kein `await` davor (Popup-Blocker, vgl. services/ai/connect-ki.ts).
 *  - Nie aus einem Mount-/Init-Pfad öffnen (Bug-Klasse 8): `meldeSeitenwechsel`
 *    AKTUALISIERT darum nur ein bereits offenes Fenster und öffnet nie eines.
 *
 * Der feste Fenstername trägt den Reload-Fall: nach einem App-Reload ist das
 * Modul-Singleton weg, das Fenster aber noch offen. `window.open('', NAME)`
 * greift dann dasselbe Fenster wieder, statt ein zweites aufzumachen.
 */

import { getSeitenHilfe } from '@/core/services/feedback/screenContext';
import {
  HILFE_FENSTER_NAME,
  HILFE_IDS,
  LESE_TOKENS,
  baueGeruestHtml,
  baueHilfeCss,
  baueKopfHtml,
  berechneGeometrie,
  fensterFeatures,
  fensterTitel,
  hilfeAlsHtml,
  hinweisText,
  machtUrlsAbsolut,
} from '@/components/help/hilfeFensterDokument';

/** Merker am Fenster-Objekt, um beim Neuaufbau den alten Escape-Handler zu lösen. */
interface FensterMitHandler extends Window {
  __tfEscHandler?: (e: KeyboardEvent) => void;
}

let fenster: FensterMitHandler | null = null;
let themaWaechter: MutationObserver | null = null;
let festgehalten = false;
/** Seite, auf der die APP steht (nicht zwingend die im Fenster gezeigte). */
let appSeiteId = '';
let appSeiteName = '';
/** Seite, die das Fenster gerade ZEIGT. */
let gezeigteSeiteId = '';

/** Das lebende Fenster, oder `null`. Ein Prädikat ginge hier nicht: Type-Guards
 *  beziehen sich auf Parameter, nicht auf Modul-Variablen. */
function lebendes(): FensterMitHandler | null {
  return fenster !== null && !fenster.closed ? fenster : null;
}

// ── Theme ─────────────────────────────────────────────────────────────────────

function lisTokens(): Record<string, string> {
  const stil = getComputedStyle(document.documentElement);
  const werte: Record<string, string> = {};
  for (const name of LESE_TOKENS) werte[name] = stil.getPropertyValue(name).trim();
  return werte;
}

/**
 * Sammelt die `@font-face`-Regeln des Hauptdokuments, damit das Fenster in der
 * App-Schrift läuft. Im Single-File-Build sind die Schrift-Dateien `data:`-URLs
 * (`assetsInlineLimit: Infinity`), es geht also nichts über die Leitung; am
 * Dev-Server sind sie relativ und werden gegen `document.baseURI` absolut
 * gemacht. Fremde (cross-origin) Stylesheets werfen beim Zugriff auf `cssRules`
 * — die werden übersprungen, dann greift der Fallback-Stack (system-ui). Das
 * ist ein Schönheitsfehler, kein Defekt.
 */
function sammleSchriftRegeln(): string {
  const teile: string[] = [];
  for (const blatt of Array.from(document.styleSheets)) {
    let regeln: CSSRuleList;
    try {
      regeln = blatt.cssRules;
    } catch {
      continue;
    }
    for (const regel of Array.from(regeln)) {
      // 5 = CSSRule.FONT_FACE_RULE (die Konstante fehlt in manchen DOM-Typen).
      if (regel.type === 5) teile.push(regel.cssText);
    }
  }
  return machtUrlsAbsolut(teile.join('\n'), document.baseURI);
}

function css(): string {
  return baueHilfeCss(lisTokens(), sammleSchriftRegeln());
}

/** Schreibt nur das Stylesheet neu — kein Rebuild, die Scrollposition bleibt. */
function zieheThemaNach(): void {
  const win = lebendes();
  if (!win) return;
  const stil = win.document.getElementById(HILFE_IDS.stil);
  if (stil) stil.textContent = css();
}

// ── Inhalt ────────────────────────────────────────────────────────────────────

/** Zeigt die Hilfe einer Seite — oder sagt, dass es für sie keine gibt. */
function zeige(pluginId: string): void {
  const win = lebendes();
  if (!win) return;
  const doc = win.document;
  const hilfe = getSeitenHilfe(pluginId);
  gezeigteSeiteId = pluginId;

  const titel = hilfe === null
    ? (appSeiteName !== '' ? appSeiteName : 'Ohne Kurzanleitung')
    : (hilfe.titel !== '' ? hilfe.titel : 'Hilfe');
  const koerper = hilfe === null
    ? '<p>Für diese Seite gibt es keine Kurzanleitung.</p>'
    : hilfeAlsHtml(hilfe.markdown);

  doc.title = fensterTitel(titel);
  const h1 = doc.getElementById(HILFE_IDS.titel);
  if (h1) h1.textContent = titel;
  const block = doc.getElementById(HILFE_IDS.inhalt);
  if (block) block.innerHTML = koerper;
  // Gescrollt wird das <main> darum herum, nicht der Lese-Block darin — der ist
  // nur breitenbegrenzt und hat selbst keinen Ueberlauf.
  const scroller = doc.querySelector('main');
  if (scroller) scroller.scrollTop = 0;
}

/** Schreibt Feststeller-Kästchen + Hinweiszeile passend zum Zustand. */
function zeichneZustand(): void {
  const win = lebendes();
  if (!win) return;
  const doc = win.document;
  const box = doc.getElementById(HILFE_IDS.fest) as HTMLInputElement | null;
  if (box) box.checked = festgehalten;

  const text = hinweisText(festgehalten, gezeigteSeiteId, appSeiteId, appSeiteName);
  const kasten = doc.getElementById(HILFE_IDS.hinweis);
  const span = doc.getElementById(HILFE_IDS.hinweisText);
  if (!kasten || !span) return;
  if (text === null) {
    kasten.classList.remove('tf-sichtbar');
    return;
  }
  span.textContent = text;
  kasten.classList.add('tf-sichtbar');
}

// ── Aufbau + Verdrahtung ──────────────────────────────────────────────────────

function baueAuf(win: FensterMitHandler): void {
  const doc = win.document;
  doc.documentElement.lang = 'de';
  doc.head.innerHTML = baueKopfHtml(css());
  doc.body.innerHTML = baueGeruestHtml();

  doc.getElementById(HILFE_IDS.fest)?.addEventListener('change', e => {
    festgehalten = (e.target as HTMLInputElement).checked;
    if (!festgehalten && appSeiteId !== '') zeige(appSeiteId);
    zeichneZustand();
  });
  doc.getElementById(HILFE_IDS.nachziehen)?.addEventListener('click', () => {
    festgehalten = false;
    if (appSeiteId !== '') zeige(appSeiteId);
    zeichneZustand();
  });

  // Der Escape-Handler hängt am Dokument, das den Neuaufbau überlebt. Nach einem
  // App-Reload zeigt `__tfEscHandler` noch auf die (tote) Funktion der alten
  // Seite — erst lösen, dann neu hängen, sonst sammeln sich Leichen an.
  if (win.__tfEscHandler) doc.removeEventListener('keydown', win.__tfEscHandler);
  const esc = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') win.close();
  };
  win.__tfEscHandler = esc;
  doc.addEventListener('keydown', esc);

  win.addEventListener('pagehide', () => {
    if (fenster === win) loeseVomFenster();
  });
}

function loeseVomFenster(): void {
  themaWaechter?.disconnect();
  themaWaechter = null;
  fenster = null;
  festgehalten = false;
  gezeigteSeiteId = '';
}

/**
 * Ein Beobachter statt eines React-Hooks: Dark-Mode setzt `data-theme` auf
 * `<html>`, die Akzentfarbe setzt dort Inline-Custom-Properties. Beides fängt
 * derselbe Wächter — ohne ihn stünde ein helles Hilfe-Fenster neben einer
 * dunklen App.
 */
function beobachteThema(): void {
  themaWaechter?.disconnect();
  themaWaechter = new MutationObserver(zieheThemaNach);
  themaWaechter.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'style', 'class'],
  });
}

// ── Öffentliche Steuerung ─────────────────────────────────────────────────────

/**
 * Öffnet das Hilfe-Fenster für eine Seite (oder holt das bestehende nach vorn und
 * füllt es neu). SYNCHRON aus dem onClick aufrufen — kein `await` davor, sonst
 * greift der Popup-Blocker.
 *
 * @returns `false`, wenn der Browser das Fenster blockiert hat. Der Aufrufer
 *   lässt dann seinen Dialog offen und sagt es — die App hat kein Toast-System.
 */
export function oeffneHilfeFenster(pluginId: string, seitenName = ''): boolean {
  const geo = berechneGeometrie(window.screen);
  const win = window.open('', HILFE_FENSTER_NAME, fensterFeatures(geo)) as FensterMitHandler | null;
  if (!win) return false;

  fenster = win;
  appSeiteId = pluginId;
  if (seitenName !== '') appSeiteName = seitenName;
  // Ein ausdrücklicher Klick auf einer Seite heißt „zeig mir DIESE" — ein noch
  // gesetzter Feststeller aus einer früheren Sitzung liefe dem zuwider.
  festgehalten = false;

  try {
    baueAuf(win);
    zeige(pluginId);
    zeichneZustand();
  } catch {
    // Das Fenster wurde weg-navigiert (externer Link) und ist jetzt cross-origin.
    loeseVomFenster();
    return false;
  }
  beobachteThema();
  win.focus();
  return true;
}

/**
 * Meldet dem Fenster, wo die App gerade steht. Öffnet NIE eines (Bug-Klasse 8) —
 * ohne offenes Fenster ist das ein No-op. Bei gesetztem Feststeller bleibt der
 * Inhalt stehen; benannt wird der Zustand trotzdem.
 */
export function meldeSeitenwechsel(pluginId: string, seitenName: string): void {
  appSeiteId = pluginId;
  appSeiteName = seitenName;
  if (!lebendes()) return;
  try {
    if (!festgehalten) zeige(pluginId);
    zeichneZustand();
  } catch {
    loeseVomFenster();
  }
}

/** Für Diagnose + Tests. */
export function hilfeFensterOffen(): boolean {
  return lebendes() !== null;
}
