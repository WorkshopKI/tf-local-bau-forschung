/**
 * Der EINE Weg in die Zwischenablage (Guard `no-raw-clipboard`).
 *
 * Warum nicht direkt `navigator.clipboard.writeText`: Chrome lehnt den Aufruf mit
 * „Document is not focused" ab, wenn das Dokument im selben Tick den Fokus verliert.
 * Aufgefallen ist das an den „Kopieren & <Dienst> öffnen"-Knöpfen (v2.301.3): lag das
 * Öffnen an einem `<a target="_blank">`, startete die Navigation zeitgleich mit dem
 * Kopier-Aufruf. Der Fehler landete in einem nie gerenderten `error`-State, die
 * Zwischenablage behielt still ihren ALTEN Inhalt, und im Chat landete ein Auftrag aus
 * einer früheren Fassung. Dieselbe Race trifft jeden Kopier-Knopf neben einem Link,
 * einem Dialog-Schluss oder einem Fokus-Wechsel — deshalb liegt der Helfer im Core.
 *
 * Zwei Zusagen an den Aufrufer:
 *  1. Der Rückfall (`execCommand('copy')` über ein unsichtbares Textfeld) läuft
 *     automatisch — veraltet, aber unter `file://` verlässlich und synchron.
 *  2. Scheitern BEIDE Wege, wird geworfen. Der Aufrufer darf dann nicht „kopiert"
 *     behaupten und schon gar keinen externen Dienst mit dem alten Inhalt öffnen.
 *
 * Reihenfolge bei „kopieren und öffnen": erst `await kopiereText(...)`, dann öffnen.
 */

/** Rückfall ohne Clipboard-API: unsichtbares Textfeld + `execCommand` (synchron). */
function kopiereUeberTextfeld(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  // Außerhalb des Sichtfelds, aber fokussierbar — `display:none` würde die Auswahl verhindern.
  ta.style.position = 'fixed';
  ta.style.top = '-1000px';
  ta.setAttribute('readonly', 'true');
  document.body.appendChild(ta);
  try {
    ta.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(ta);
  }
}

/**
 * Schreibt `text` in die Zwischenablage. Wirft mit klarer Meldung, wenn BEIDE Wege
 * scheitern — der Aufrufer darf dann NICHT so tun, als sei kopiert worden.
 */
export async function kopiereText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text); // allow-raw-clipboard: die eine Heimat des Schreibwegs
    return;
  } catch {
    if (kopiereUeberTextfeld(text)) return;
    // Bewusst ohne Nennung des Inhalts: der Helfer kopiert längst nicht mehr nur
    // Deep-Research-Aufträge, sondern auch Kürzel, Titel und seit v4.0 Ordner-
    // pfade. „Auftragstext" stand dann wörtlich unter einem Pfad-Knopf.
    throw new Error('Kopieren in die Zwischenablage fehlgeschlagen — bitte den Text von Hand markieren und kopieren.');
  }
}
