/**
 * Was die interne KI gerade anbietet — gemeldet von der Bridge, gemerkt bis zum
 * nächsten Mal.
 *
 * **Warum das persistiert wird.** Die Modell-Auswahlliste steht in der fremden
 * Seite, nicht bei uns. Ohne verbundene Bridge wüsste die App sonst nicht, welches
 * Modell hinter der Rolle `stark` steckt und wie weit dessen Fenster ist — und
 * genau das braucht sie auch offline: in den Einstellungen, in der
 * Kontext-Warnung, beim Zuschneiden einer Vorhabensbeschreibung, bevor überhaupt
 * jemand verbunden hat.
 *
 * **Gelernte Fenster hängen am MODELLNAMEN, nicht an der Rolle.** Das ist der
 * Unterschied, der ein unbekanntes Modell heilbar macht: bietet die interne KI
 * morgen etwas an, das dieser Build nicht kennt, wird sein Fenster beim ersten
 * Lauf trotzdem abgelesen und gemerkt. Ab dann kann es die Rolle `stark` tragen,
 * ohne dass jemand den Katalog anfasst ([modell-katalog.ts](./modell-katalog.ts)).
 *
 * Persistenz: `localStorage` — maschinenlokal (die Bridge ist es auch), synchron
 * lesbar (fliesst ohne Async-State in die Runner) und ein kleiner Skalar-Sack.
 * Kein Share-/IDB-Write.
 */
import { create } from 'zustand';
import type { AngebotenesModell, KiRolle, ModellAufloesung } from './modell-katalog';
import { loeseRolleAuf } from './modell-katalog';

const LS_KEY = 'teamflow_bridge_modelle';

/** Plausibilitätsgrenzen für ein abgelesenes Fenster (Schutz gegen Fehlparsen). */
const MIN_FENSTER = 2_048;
const MAX_FENSTER = 10_000_000;

/**
 * Nachschlage-Form eines Modellnamens.
 *
 * Nur Kleinschreibung + zusammengefasste Leerzeichen: die Seite schreibt ihre
 * Optionstexte stabil, und eine schärfere Normalisierung (Bindestriche,
 * Punkte weg) würde zwei verschiedene Modelle desselben Hauses zusammenwerfen —
 * womit ein gelerntes Fenster auf das falsche Modell zeigte.
 */
export function normModellText(text: string): string {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

interface Gemerkt {
  angeboten: AngebotenesModell[];
  fenster: Record<string, number>;
}

function lade(): Gemerkt {
  try {
    const roh = localStorage.getItem(LS_KEY);
    if (!roh) return { angeboten: [], fenster: {} };
    const d = JSON.parse(roh) as Partial<Gemerkt>;
    return {
      angeboten: Array.isArray(d.angeboten) ? d.angeboten.filter(m => m && typeof m.text === 'string') : [],
      fenster: d.fenster && typeof d.fenster === 'object' ? d.fenster : {},
    };
  } catch {
    return { angeboten: [], fenster: {} };
  }
}

function sichere(d: Gemerkt): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch { /* localStorage optional */ }
}

interface BridgeModelleStore extends Gemerkt {
  /** Die von der Bridge gemeldete Auswahlliste übernehmen. */
  meldeListe: (angeboten: readonly AngebotenesModell[]) => void;
  /** Ein an der Seite abgelesenes Kontextfenster festhalten. */
  lerneFenster: (text: string, tokens: number) => void;
}

function gleich(a: readonly AngebotenesModell[], b: readonly AngebotenesModell[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => x.text === b[i]?.text && !!x.aktiv === !!b[i]?.aktiv);
}

export const useBridgeModelle = create<BridgeModelleStore>((set, get) => ({
  ...lade(),
  meldeListe: (angeboten) => {
    const liste = angeboten.filter(m => m && typeof m.text === 'string' && m.text.trim())
      .map(m => ({ text: m.text.trim(), value: m.value, aktiv: !!m.aktiv }));
    // Unverändert? Dann auch nicht schreiben — die Liste kommt bei jedem Ping mit,
    // und ein Store-Update je Ping würde die Oberfläche grundlos neu rendern.
    if (gleich(get().angeboten, liste)) return;
    const next = { angeboten: liste, fenster: get().fenster };
    sichere(next);
    set(next);
  },
  lerneFenster: (text, tokens) => {
    const key = normModellText(text);
    if (!key) return;
    if (!Number.isFinite(tokens) || tokens < MIN_FENSTER || tokens > MAX_FENSTER) return;
    if (get().fenster[key] === tokens) return;
    const next = { angeboten: get().angeboten, fenster: { ...get().fenster, [key]: tokens } };
    sichere(next);
    set(next);
  },
}));

/** Synchroner Zugriff für Runner (kein Hook nötig). */
export function angeboteneModelle(): readonly AngebotenesModell[] {
  return useBridgeModelle.getState().angeboten;
}

/** Gelerntes Fenster eines Modells; `null` = noch nie an der Seite abgelesen. */
export function gelerntesFenster(text: string): number | null {
  const v = useBridgeModelle.getState().fenster[normModellText(text)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/**
 * Welches Modell trägt diese Rolle gerade? Die Verbindung der drei Schichten —
 * gemeldete Liste, gelernte Fenster, Katalog.
 *
 * **Die einzige Stelle, die eine Rolle in ein Modell übersetzt.** Wer das
 * nachbaut, baut die zweite Wahrheit; alle Konsumenten (Transport, Kontextfenster,
 * Auswahl-Oberfläche, Warnungen) gehen hier durch.
 */
export function aufloesungFuer(rolle: KiRolle): ModellAufloesung {
  return loeseRolleAuf(rolle, angeboteneModelle(), gelerntesFenster);
}

/**
 * Anzeigename des Modells, das eine Rolle gerade trägt.
 *
 * **Eine Quelle für die ganze App.** Wer ein Modell benennt — Auswahl,
 * Eskalations-Hinweis, Kontext-Warnung, Herkunft einer Fassung — nimmt diesen
 * Namen. Interne Kennungen in einer Oberfläche verlangen vom Leser eine
 * Übersetzung, die er nicht hat; und ein fest verdrahteter Modellname veraltet
 * genau dann still, wenn die interne KI ihr Modell tauscht.
 */
export function modellLabel(rolle: KiRolle): string {
  return aufloesungFuer(rolle).label;
}

/**
 * Kontextfenster aus der Chatlängen-Anzeige lesen
 * („Chatlänge [Token]: 0k von 62k" → 62000).
 *
 * **App-seitig, nicht im Bookmarklet.** Bis v5 lief dieselbe Regel gespiegelt im
 * Snippet mit — jede Korrektur daran hätte das ganze Team ein neues Lesezeichen
 * gekostet. Das Snippet meldet jetzt den ROHEN Text, ausgewertet wird hier.
 *
 * `0` heisst „nicht lesbar" — der Aufrufer bleibt dann bei seinem Rückfallwert.
 */
export function leseKontextTokens(text: string): number {
  const m = /von\s*([\d.,]+)\s*(k|m)?\b/i.exec(String(text || ''));
  if (!m || !m[1]) return 0;
  let zahl = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
  if (!isFinite(zahl) || zahl <= 0) return 0;
  const einheit = (m[2] || '').toLowerCase();
  if (einheit === 'k') zahl *= 1000;
  else if (einheit === 'm') zahl *= 1000000;
  return Math.round(zahl);
}
