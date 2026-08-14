/**
 * Wann zeigt der Rechtsklick noch das BROWSER-Menü? (v4.41)
 *
 * Kaum ein Eintrag darin hilft hier: „Zurück", „Neu laden", „Seitenquelltext
 * anzeigen", „Drucken" — die App läuft aus einer Datei, hat ihre eigene
 * Navigation und keine Seiten im Wortsinn. Wo sie selbst ein Menü führt
 * (Startseite, Feedback-Tickets), lag das Browser-Menü ohnehin daneben; überall
 * sonst war es eine Antwort auf eine Frage, die niemand gestellt hat.
 *
 * Also: **der Rechtsklick zeigt nur noch etwas, wo er etwas kann.** Drei
 * Ausnahmen bleiben, weil das Browser-Menü dort die einzige Bedienung ist:
 *
 *  - **Eingabefelder** — Einfügen. Es gibt keinen App-Ersatz dafür, und ohne
 *    Zwischenablage-Recht könnten wir auch keinen bauen.
 *  - **Markierter Text** — Kopieren. Wer erst markiert, meint genau das.
 *  - **Umschalt gedrückt** — der Notausgang. Firefox macht das seit je so; wer
 *    doch einmal „Bild speichern unter" oder „Untersuchen" braucht, kommt daran.
 *
 * Hat die App den Klick schon selbst beantwortet (`defaultPrevented`), rührt der
 * Handler ihn nicht mehr an — er ergänzt die Seiten-Menüs, er ersetzt sie nicht.
 */
import { useEffect } from 'react';

/**
 * Rein + node-testbar: die Regel ohne DOM. Der Aufrufer misst die drei Zustände
 * am Ereignis, hier steht nur, was sie bedeuten.
 */
export function zeigtBrowserMenue(opts: {
  /** Klick landete in `input` / `textarea` / `[contenteditable]`. */
  istEingabefeld: boolean;
  hatTextauswahl: boolean;
  /** Umschalt-Taste gedrückt — der bewusste Griff zum Browser-Menü. */
  mitUmschalt: boolean;
}): boolean {
  return opts.istEingabefeld || opts.hatTextauswahl || opts.mitUmschalt;
}

/**
 * Hängt die Regel EINMAL ans Dokument (Bubble-Phase, damit die Menüs der App
 * zuerst drankommen). Am Dokument statt an einem Wrapper-Div, weil Dialoge,
 * Popover und der Feedback-FAB in Portale unter `<body>` rendern.
 */
export function useBrowserKontextmenue(): void {
  useEffect(() => {
    const beiKontextmenue = (e: MouseEvent): void => {
      // Eine App-Stelle hat den Klick bereits übernommen (Startseiten-Menü,
      // Ticket-Menü) — die hat ihr eigenes `preventDefault` schon gesetzt.
      if (e.defaultPrevented) return;
      const ziel = e.target instanceof Element ? e.target : null;
      if (zeigtBrowserMenue({
        istEingabefeld: !!ziel?.closest('input, textarea, [contenteditable="true"]'),
        hatTextauswahl: !!window.getSelection()?.toString(),
        mitUmschalt: e.shiftKey,
      })) return;
      e.preventDefault();
    };
    document.addEventListener('contextmenu', beiKontextmenue);
    return () => document.removeEventListener('contextmenu', beiKontextmenue);
  }, []);
}
