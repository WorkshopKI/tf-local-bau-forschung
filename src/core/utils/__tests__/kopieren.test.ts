/**
 * Node-Umgebung ohne DOM — `navigator`/`document` werden für den Test minimal gestellt.
 * Geprüft wird der Kontrakt, nicht die Browser-Implementierung: ein gescheiterter
 * Kopiervorgang muss WERFEN, damit der Aufrufer nicht „kopiert" behauptet und einen
 * externen Dienst mit dem alten Inhalt der Zwischenablage öffnet.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { kopiereText } from '../kopieren';

interface FakeTextarea {
  value: string; style: Record<string, string>;
  setAttribute: () => void; select: () => void;
}

function stelleUmgebung(opts: {
  writeText?: (t: string) => Promise<void>;
  execCommand?: () => boolean;
}): { entfernt: () => number; letztesFeld: () => FakeTextarea | null } {
  let feld: FakeTextarea | null = null;
  let entfernt = 0;
  vi.stubGlobal('navigator', {
    clipboard: opts.writeText ? { writeText: opts.writeText } : undefined,
  });
  vi.stubGlobal('document', {
    createElement: () => {
      feld = { value: '', style: {}, setAttribute: () => undefined, select: () => undefined };
      return feld;
    },
    body: { appendChild: () => undefined, removeChild: () => { entfernt += 1; } },
    execCommand: opts.execCommand ?? (() => false),
  });
  return { entfernt: () => entfernt, letztesFeld: () => feld };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('kopiereText', () => {
  it('nutzt die Clipboard-API, wenn sie greift', async () => {
    const writeText = vi.fn(async () => undefined);
    stelleUmgebung({ writeText });
    await kopiereText('Auftragstext');
    expect(writeText).toHaveBeenCalledWith('Auftragstext');
  });

  it('fällt auf das Textfeld zurück, wenn die API ablehnt („Document is not focused")', async () => {
    const umg = stelleUmgebung({
      writeText: async () => { throw new Error('Document is not focused'); },
      execCommand: () => true,
    });
    await expect(kopiereText('Auftragstext')).resolves.toBeUndefined();
    expect(umg.letztesFeld()?.value).toBe('Auftragstext');
    expect(umg.entfernt()).toBe(1); // Hilfs-Textfeld wieder abgeräumt
  });

  it('wirft, wenn BEIDE Wege scheitern — nie stillschweigend', async () => {
    stelleUmgebung({
      writeText: async () => { throw new Error('verweigert') },
      execCommand: () => false,
    });
    await expect(kopiereText('Auftragstext')).rejects.toThrow(/Zwischenablage/);
  });

  it('ohne Clipboard-API greift direkt der Rückfall', async () => {
    const umg = stelleUmgebung({ execCommand: () => true });
    await expect(kopiereText('Auftragstext')).resolves.toBeUndefined();
    expect(umg.letztesFeld()?.value).toBe('Auftragstext');
  });
});
