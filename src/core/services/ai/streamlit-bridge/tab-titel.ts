/**
 * Formatierung des Browser-Tab-Titels im Streamlit-Tab (KI-Status nach außen).
 *
 * Problem: Das Bookmarklet zeigt seinen Zustand nur als Pill unten rechts **im**
 * KI-Tab — also genau dort, wo man nur hinsieht, wenn man hinwechselt. Wer in der
 * App arbeitet, sieht nicht, ob die interne KI vorankommt. Der Tab-Titel ist der
 * Kanal, der das ohne Tab-Wechsel sichtbar macht (der KI-Tab liegt in der
 * Chrome-Tab-Leiste neben der App).
 *
 * Laufzeit UND Antwort-Umfang, weil nur der wachsende Umfang belegt, dass die KI
 * vorankommt — eine reine Uhr tickt auch bei einem toten Server weiter.
 *
 * Das Symbol steht **vorne**, damit es sichtbar bleibt, wenn Chrome den Tab-Text
 * bei vielen offenen Tabs abschneidet.
 *
 * Wie `echo-match.ts` / `answer-selection.ts` ist die Logik im Bookmarklet
 * `bridge-snippet.source.js` **gespiegelt** (zwischen den `<tab-titel-core>`-
 * Markern; `?raw`-Inlining → kein Import). Der Drift-Test
 * (`__tests__/tab-titel.test.ts`) extrahiert die JS-Fassung und lässt beide
 * gegen dieselben Fixtures laufen.
 */

/** Zustand, den der Tab-Titel spiegelt (aus dem `setBadge`-Ton abgeleitet). */
export type TabZustandArt = 'ruhe' | 'laeuft' | 'fertig' | 'fehler';

/** Optionen für `formatiereTabTitel` (alle optional, siehe dort). */
export interface TabTitelOpts {
  /** Startzeitpunkt des Laufs (`Date.now()`); 0/fehlend → Uhr wird weggelassen. */
  seit?: number;
  /** „Jetzt" (`Date.now()`) — explizit, damit die Funktion pur/testbar bleibt. */
  jetzt?: number;
  /** Bisherige Antwortlänge in Zeichen. */
  zeichen?: number;
  /** Freitext für Zustände ohne Uhr (z. B. „Chat-Test läuft…", „Zeitüberschreitung"). */
  text?: string;
}

/** Symbol je Zustand. Bewusst nur drei — der Tab soll auf einen Blick lesbar sein. */
const TAB_SYMBOL: Record<Exclude<TabZustandArt, 'ruhe'>, string> = {
  laeuft: '⏳',
  fertig: '✅',
  fehler: '⚠️',
};

/**
 * Führendes Status-Präfix (`⏳ … · `) wieder abstreifen → der Originaltitel der
 * fremden Seite. Idempotent und mehrfach anwendbar: schützt davor, dass ein
 * bereits präfigierter Titel ein zweites Präfix bekommt (etwa wenn der Titel je
 * aus dem eigenen Ergebnis zurückgelesen wird).
 */
export function basisTitel(roh: string): string {
  let s = String(roh || '');
  // Symbol (mit optionalem Variantenselektor), dann ENTWEDER eine Uhr mit
  // optionalem Umfang (`0:42 · 1,4k`) ODER ein Freitext-Segment — genau die
  // Formen, die `formatiereTabTitel` erzeugt. Das Freitext-Segment ist faul
  // (`*?`), damit ein Basistitel mit eigenem „·" („Chat · AitisiGPT") nicht
  // angeknabbert wird.
  const praefix = /^[⏳✅⚠]️?\s(?:\d+:\d{2}(?:\s·\s\d+(?:,\d)?k?)?|[^·]*?)\s·\s+/;
  while (praefix.test(s)) s = s.replace(praefix, '');
  return s.trim();
}

/** Laufzeit als `m:ss` (42_000 → „0:42", 725_000 → „12:05"); negativ → „0:00". */
export function formatiereLaufzeit(ms: number): string {
  const sekGesamt = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const min = Math.floor(sekGesamt / 60);
  const sek = sekGesamt % 60;
  return min + ':' + (sek < 10 ? '0' : '') + sek;
}

/**
 * Antwort-Umfang kompakt. Unter 100 Zeichen **leer**, damit die Denkphase nicht
 * mit einer zappelnden Kleinstzahl flackert; ab 10k ohne Nachkommastelle.
 */
export function formatiereUmfang(zeichen: number): string {
  const n = Math.max(0, Math.floor(Number(zeichen) || 0));
  if (n < 100) return '';
  if (n < 1000) return String(n);
  if (n < 10000) return String(Math.round(n / 100) / 10).replace('.', ',') + 'k';
  return Math.round(n / 1000) + 'k';
}

/**
 * Baut den vollständigen Tab-Titel: `⏳ 0:42 · 1,4k · AitisiGPT (BETA)`.
 *
 * - `ruhe` → der Basistitel unverändert (die fremde Seite bekommt ihren Titel zurück).
 * - `laeuft` **mit** `seit` → Uhr, plus Umfang sobald genug Text da ist.
 * - `laeuft` **ohne** `seit` → `text` statt Uhr; deckt die kurzen Selbsttests ab
 *   („Prüfe ZAH-App…", „Chat-Test läuft…"), die keine Lauf-Schleife haben.
 * - `fertig`/`fehler` → `text` (Vorgabe „Fertig" bzw. „Fehler").
 */
export function formatiereTabTitel(
  art: TabZustandArt,
  basis: string,
  opts: TabTitelOpts = {},
): string {
  const rein = basisTitel(basis);
  if (art === 'ruhe') return rein;

  const teile: string[] = [];
  if (art === 'laeuft') {
    if (opts.seit) {
      teile.push(formatiereLaufzeit((opts.jetzt || 0) - opts.seit));
      const umfang = formatiereUmfang(opts.zeichen || 0);
      if (umfang) teile.push(umfang);
    } else {
      teile.push(opts.text || 'Arbeitet…');
    }
  } else {
    teile.push(opts.text || (art === 'fertig' ? 'Fertig' : 'Fehler'));
  }

  const kopf = TAB_SYMBOL[art] + ' ' + teile.join(' · ');
  return rein ? kopf + ' · ' + rein : kopf;
}
