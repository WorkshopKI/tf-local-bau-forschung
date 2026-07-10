import { describe, it, expect } from 'vitest';
import { sliceLesemodus } from '../lesemodus';
import type { VbSektion } from '../gliederung';

function sek(id: string, nummer: string | undefined, titel: string, start: number, end: number, ebene: 1 | 2 | 3 = 1): VbSektion {
  return { id, ...(nummer ? { nummer } : {}), titel, ebene, start, end, quelle: 'heading' };
}

// Markdown mit klaren Offsets: "# 1 A\n…\n# 2 B\n…\n# 3 C\n…"
const VB = '# 1 Ausgangssituation\nText A.\n# 3 Lösungsweg\nText C.\n# 9 Projektplan\nText H.';
const I_A = VB.indexOf('# 1');
const I_C = VB.indexOf('# 3');
const I_H = VB.indexOf('# 9');

describe('sliceLesemodus', () => {
  it('schneidet je Sektion den Span [start,end), inkl. Überschrift, in Dokumentreihenfolge', () => {
    const g = [
      sek('k-1', '1', 'Ausgangssituation', I_A, I_C),
      sek('k-3', '3', 'Lösungsweg', I_C, I_H),
      sek('k-9', '9', 'Projektplan', I_H, VB.length),
    ];
    const a = sliceLesemodus(VB, g);
    expect(a.map(x => x.id)).toEqual(['k-1', 'k-3', 'k-9']);
    expect(a[0]!.text).toBe('# 1 Ausgangssituation\nText A.');
    expect(a[1]!.text).toBe('# 3 Lösungsweg\nText C.');
    expect(a[2]!.text).toBe('# 9 Projektplan\nText H.');
    expect(a[0]!.nummer).toBe('1');
  });

  it('sortiert nach start (Eingabereihenfolge egal)', () => {
    const g = [
      sek('k-9', '9', 'Projektplan', I_H, VB.length),
      sek('k-1', '1', 'Ausgangssituation', I_A, I_C),
    ];
    expect(sliceLesemodus(VB, g).map(x => x.id)).toEqual(['k-1', 'k-9']);
  });

  it('lässt s-toc (Inhaltsverzeichnis) aus', () => {
    const g = [sek('s-toc', undefined, 'Inhaltsverzeichnis', 0, I_A), sek('k-1', '1', 'A', I_A, I_C)];
    expect(sliceLesemodus(VB, g).map(x => x.id)).toEqual(['k-1']);
  });

  it('end ≤ start → Span bis Dokumentende (kein negativer Slice)', () => {
    const g = [sek('k-1', '1', 'A', I_A, 0)];
    expect(sliceLesemodus(VB, g)[0]!.text.startsWith('# 1 Ausgangssituation')).toBe(true);
  });

  it('kappt Offsets an die Länge (robust gegen veraltete Gliederung)', () => {
    const g = [sek('k-x', 'X', 'Weg', 9000, 9999)];
    expect(sliceLesemodus(VB, g)[0]!.text).toBe('');
  });

  it('behält die Überschrift als Anker, auch wenn der Text leer ist', () => {
    const g = [sek('k-x', 'X', 'Leer', 9000, 9999)];
    const a = sliceLesemodus(VB, g)[0]!;
    expect(a.id).toBe('k-x');
    expect(a.titel).toBe('Leer');
  });
});
