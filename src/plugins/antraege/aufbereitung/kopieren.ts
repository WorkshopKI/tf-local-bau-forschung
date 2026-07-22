/**
 * Zwischenablage für die „Kopieren & <Dienst> öffnen"-Knöpfe des Recherche-Tabs.
 *
 * Warum eigen: dort wird kopiert UND ein neuer Tab geöffnet. Lag das Öffnen am
 * `<a target="_blank">`, startete die Navigation im selben Tick wie der Kopier-Aufruf —
 * verlor das Dokument dabei den Fokus, lehnte Chrome `writeText` mit „Document is not
 * focused" ab. Der Fehler landete in einem nie gerenderten `error`-State, die
 * Zwischenablage behielt still ihren ALTEN Inhalt, und im Chat landete ein Auftrag aus
 * einer früheren Fassung. Deshalb: erst kopieren (und den Erfolg belegen), dann öffnen.
 *
 * `execCommand('copy')` ist der Rückfall für den Fall, dass die Clipboard-API in dem
 * Moment nicht greift — veraltet, aber unter `file://` verlässlich und synchron.
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
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    if (kopiereUeberTextfeld(text)) return;
    throw new Error('Kopieren in die Zwischenablage fehlgeschlagen — bitte den Auftragstext von Hand markieren und kopieren.');
  }
}
