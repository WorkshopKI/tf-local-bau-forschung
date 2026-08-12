/**
 * React in einem EIGENEN Browser-Fenster — ohne die App ein zweites Mal zu
 * starten.
 *
 * ── Warum `about:blank` und keine zweite App-Instanz ──────────────────────────
 * `window.open('', NAME, …)` mit LEERER URL navigiert nicht: das Fenster bleibt
 * das initiale `about:blank` und erbt die Herkunft des Openers. Damit teilt es
 * sich Realm, Modul-Instanzen und Zustands-Stores mit der App — der Inhalt ist
 * dieselbe laufende Anwendung, nur in einem anderen Rahmen. Ein Fenster, das
 * `#/route` lädt, wäre stattdessen ein zweiter Kaltstart samt Anmelde-Gates,
 * zweitem IndexedDB-Zugriff und zweitem Satz Ordner-Handles.
 * Dasselbe Verfahren trägt seit v2.402 die Seiten-Hilfe (`help/hilfeFenster.ts`)
 * und steht in docs/agents/file-protocol-pitfalls.md als „OK unter file://".
 *
 * ── Warum eine zweite React-Wurzel und kein Portal ────────────────────────────
 * `createPortal` in ein fremdes Dokument rendert zwar, reagiert aber nicht:
 * React hängt seine Ereignis-Zuhörer an den WURZEL-Container, und ein Klick in
 * einem anderen Dokument erreicht ihn nie. Also `createRoot` im Fenster. Kein
 * `StrictMode` — die Wurzel entsteht imperativ im Klick-Handler, nicht in einem
 * Effekt, das doppelte Aufrufen hätte hier nichts zu prüfen.
 *
 * ── Warum die Stile KOPIERT und nicht neu erzeugt werden ──────────────────────
 * Die Hilfe schreibt rohes DOM und kommt mit einer Handvoll aufgeloester Tokens
 * aus. Ein React-Baum bringt Tailwind-Utilities und Modul-CSS mit; beides steht
 * im Hauptdokument als `<style>` (im Single-File-Build EIN Block, gemessen
 * 278 KB, also eine Zeichenketten-Kopie ohne Ladevorgang; am Dev-Server mehrere
 * Vite-Knoten). Ein `<base href>` erledigt dabei alle relativen URLs auf einmal —
 * `about:blank` hat selbst keine Basis-URL.
 *
 * Zwei Beobachter halten das Fenster lebendig: einer auf `documentElement`
 * (Hell/Dunkel + gewählter Akzent stehen dort als Attribut bzw. Inline-Property),
 * einer auf `document.head` (am Dev-Server kommen Stile per HMR nach).
 */
import { createRoot, type Root } from 'react-dom/client';
import { fensterFeatures, type FensterGeometrie } from './fensterGeometrie';

/** Marke an den kopierten Knoten, damit ein Neu-Spiegeln die alten wegräumt. */
const SPIEGEL_MARKE = 'data-tf-spiegel';
/** Attribute der Wurzel, die Aussehen tragen. `style` ist der App-Akzent. */
const WURZEL_ATTRIBUTE = ['data-theme', 'class', 'style', 'lang'] as const;

export interface AppFensterGriff {
  /** Zeichnet den Inhalt neu. Beliebig oft — dieselbe Wurzel, ein React-Update. */
  rendere: (inhalt: React.ReactNode) => void;
  schliesse: () => void;
  offen: () => boolean;
  /** Holt das Fenster nach vorn (zweiter Klick auf denselben Knopf). */
  fokussiere: () => void;
}

export interface AppFensterOptionen {
  /** Fenstername. Ein benanntes Fenster gibt sich nach einem App-Reload wieder
   *  her, statt ein zweites aufzumachen. */
  name: string;
  titel: string;
  geo: FensterGeometrie;
  /**
   * Läuft genau EINMAL, wenn das Fenster nicht mehr zu bespielen ist — egal ob
   * der Nutzer es zugemacht, `Escape` gedrückt oder der Aufrufer `schliesse()`
   * gerufen hat. Ohne ihn hielte der Aufrufer einen toten Griff für lebendig
   * und öffnete beim nächsten Klick ein zweites Fenster daneben.
   */
  beiEnde?: () => void;
}

/**
 * Öffnet ein Fenster und gibt einen Griff darauf zurück, oder `null`, wenn der
 * Popup-Blocker zugeschlagen hat.
 *
 * **SYNCHRON aus einem Klick-Handler aufrufen** — kein `await` davor, sonst
 * zählt die Geste nicht mehr (dieselbe Regel wie `oeffneHilfeFenster` und
 * `services/ai/connect-ki.ts`).
 */
export function oeffneAppFenster(
  { name, titel, geo, beiEnde }: AppFensterOptionen,
): AppFensterGriff | null {
  const win = window.open('', name, fensterFeatures(geo));
  if (!win) return null;

  let wurzel: Root | null = null;
  let stilWaechter: MutationObserver | null = null;
  let themaWaechter: MutationObserver | null = null;
  let geloest = false;

  const lebt = (): boolean => {
    if (geloest || win.closed) return false;
    // Weg-navigiert (externer Link) ⇒ cross-origin ⇒ jeder Zugriff wirft.
    try {
      return !!win.document;
    } catch {
      return false;
    }
  };

  /** Beobachter trennen und die Wurzel abbauen — ohne das Fenster zu schließen. */
  const loese = (): void => {
    if (geloest) return;
    geloest = true;
    stilWaechter?.disconnect();
    themaWaechter?.disconnect();
    stilWaechter = null;
    themaWaechter = null;
    const w = wurzel;
    wurzel = null;
    // Nicht mitten im Lebenszyklus abbauen (React warnt) — ein Tick später.
    if (w) queueMicrotask(() => { try { w.unmount(); } catch { /* Fenster schon weg */ } });
    window.removeEventListener('pagehide', beiOpenerEnde);
    beiEnde?.();
  };

  const schliesse = (): void => {
    loese();
    try { win.close(); } catch { /* schon zu */ }
  };

  /** Der Opener geht (Reload, Navigation): das Fenster MUSS mit. Ohne React-
   *  Wurzel zeigte es sonst einen eingefrorenen Stand — also eine Lüge. */
  const beiOpenerEnde = (): void => { schliesse(); };

  try {
    const doc = win.document;
    doc.documentElement.lang = 'de';
    doc.title = titel;
    doc.head.innerHTML = `<meta charset="utf-8"><base href="${document.baseURI}">`;
    doc.body.innerHTML = '';

    spiegleStile(doc);
    spiegleWurzelAttribute(doc);

    const behaelter = doc.createElement('div');
    behaelter.id = 'tf-fenster-wurzel';
    doc.body.appendChild(behaelter);
    wurzel = createRoot(behaelter);

    // Escape schließt — wie in der Seiten-Hilfe. Der Zuhörer hängt am Dokument
    // des Fensters, gesetzt vom Opener aus; im Fenster läuft kein eigenes Script.
    doc.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') schliesse();
    });
    win.addEventListener('pagehide', loese);
    window.addEventListener('pagehide', beiOpenerEnde);

    themaWaechter = new MutationObserver(() => {
      if (lebt()) try { spiegleWurzelAttribute(win.document); } catch { loese(); }
    });
    themaWaechter.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [...WURZEL_ATTRIBUTE],
    });

    // Nur am Dev-Server relevant (HMR schiebt <style> nach); im Single-File-Build
    // feuert das nie. Ohne ihn wäre jede CSS-Änderung im Fenster unsichtbar.
    let geplant = false;
    stilWaechter = new MutationObserver(mutationen => {
      if (geplant || !mutationen.some(betrifftStil)) return;
      geplant = true;
      queueMicrotask(() => {
        geplant = false;
        if (lebt()) try { spiegleStile(win.document); } catch { loese(); }
      });
    });
    stilWaechter.observe(document.head, {
      childList: true, subtree: true, characterData: true,
    });
  } catch {
    schliesse();
    return null;
  }

  return {
    rendere: (inhalt: React.ReactNode): void => {
      if (!lebt() || !wurzel) return;
      try { wurzel.render(inhalt); } catch { loese(); }
    },
    schliesse,
    offen: lebt,
    fokussiere: (): void => { if (lebt()) try { win.focus(); } catch { loese(); } },
  };
}

/** Ob eine Mutation ein Stylesheet betrifft (Text-Änderung oder Knoten-Tausch). */
function betrifftStil(m: MutationRecord): boolean {
  const istStil = (n: Node): boolean => {
    const el = n.nodeType === 3 ? n.parentNode : n;
    const name = (el as Element | null)?.nodeName;
    return name === 'STYLE' || name === 'LINK';
  };
  if (m.type === 'characterData') return istStil(m.target);
  return [...m.addedNodes, ...m.removedNodes].some(istStil);
}

/**
 * Kopiert alle Stylesheets des Hauptdokuments in Dokument-Reihenfolge. Voll
 * statt inkrementell: die Reihenfolge entscheidet über die Kaskade, und ein
 * gezieltes Nachpflegen müsste sie selbst nachbilden. Der Preis ist eine
 * 278-KB-Kopie — und die fällt nur am Dev-Server je HMR-Runde an.
 */
function spiegleStile(ziel: Document): void {
  for (const alt of Array.from(ziel.querySelectorAll(`[${SPIEGEL_MARKE}]`))) alt.remove();
  for (const knoten of Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))) {
    const kopie = ziel.importNode(knoten, true) as HTMLElement;
    kopie.setAttribute(SPIEGEL_MARKE, '');
    ziel.head.appendChild(kopie);
  }
}

/** Hell/Dunkel und der gewählte Akzent stehen an `<html>` — nicht im Stylesheet. */
function spiegleWurzelAttribute(ziel: Document): void {
  for (const name of WURZEL_ATTRIBUTE) {
    const wert = document.documentElement.getAttribute(name);
    if (wert === null) ziel.documentElement.removeAttribute(name);
    else ziel.documentElement.setAttribute(name, wert);
  }
}
