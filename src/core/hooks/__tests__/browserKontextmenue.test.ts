/**
 * Der Rechtsklick zeigt nur noch etwas, wo er etwas kann (v4.41).
 *
 * Die Regel ist rein; geprüft wird zusätzlich, dass sie EINMAL app-weit hängt —
 * ein Handler je Seite wäre wieder die Sorte Zustand, die auseinanderläuft.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { zeigtBrowserMenue } from '../useBrowserKontextmenue';

function rechtsklick(over: Partial<Parameters<typeof zeigtBrowserMenue>[0]> = {}) {
  return zeigtBrowserMenue({
    istEingabefeld: false,
    hatTextauswahl: false,
    mitUmschalt: false,
    ...over,
  });
}

describe('zeigtBrowserMenue', () => {
  it('unterdrückt das Browser-Menü im Normalfall', () => {
    expect(rechtsklick()).toBe(false);
  });

  it('lässt es in Eingabefeldern stehen (Einfügen hat keinen App-Ersatz)', () => {
    expect(rechtsklick({ istEingabefeld: true })).toBe(true);
  });

  it('lässt es bei markiertem Text stehen (Kopieren)', () => {
    expect(rechtsklick({ hatTextauswahl: true })).toBe(true);
  });

  it('hält Umschalt als Notausgang offen', () => {
    expect(rechtsklick({ mitUmschalt: true })).toBe(true);
  });
});

describe('Die Regel hängt genau einmal, app-weit', () => {
  it('wird in der Shell gemountet', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/core/ShellLayout.tsx'), 'utf8');
    expect(src).toMatch(/useBrowserKontextmenue\(\)/);
  });

  it('hört am Dokument, nicht an einem Wrapper (Portale!)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/core/hooks/useBrowserKontextmenue.ts'), 'utf8');
    expect(src).toMatch(/document\.addEventListener\('contextmenu'/);
    // Bubble-Phase: die Menüs der App kommen zuerst dran und setzen ihr
    // `preventDefault` selbst — ein Capture-Listener nähme ihnen den Klick weg.
    expect(src).not.toMatch(/addEventListener\('contextmenu',[^)]*true\)/);
    expect(src).toMatch(/defaultPrevented/);
  });
});
