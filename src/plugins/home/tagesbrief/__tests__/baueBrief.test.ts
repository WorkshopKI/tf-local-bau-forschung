import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { baueBrief, DECKEL, DRINGLICH_AB_TAGEN } from '../baueBrief';
import type { BriefPunkt, ThemaId } from '../typen';

/** Minimaler Punkt — die Tests interessieren nur `themaId` und `tage`. */
function punkt(themaId: ThemaId, tage: number | null, text: string = themaId): BriefPunkt {
  return {
    themaId,
    segmente: [{ art: 'text', text }],
    satz: text,
    tage,
    frage: `Was ist mit ${text}?`,
  };
}

const ALLE: ReadonlySet<ThemaId> = new Set<ThemaId>([
  'stillstand', 'zu-tun', 'liegt-bei-anderen', 'kuerzel-status', 'nachtlauf', 'eingang',
  'entwuerfe', 'weitermachen', 'feedback', 'registry',
]);

describe('baueBrief — Rangfolge nur wo eine Uhr tickt', () => {
  it('sortiert Uhr-Punkte aufsteigend: überfällig zuerst', () => {
    const b = baueBrief({
      punkte: [punkt('zu-tun', 5, 'A'), punkt('stillstand', -12, 'B'), punkt('zu-tun', 0, 'C')],
      aktiv: ALLE,
      laedt: false,
    });
    expect(b.punkte.map(p => p.satz)).toEqual(['B', 'C', 'A']);
  });

  it('Punkte ohne Uhr ranken nie mit — sie landen im Nachsatz', () => {
    const b = baueBrief({
      punkte: [punkt('nachtlauf', null, 'N'), punkt('stillstand', 3, 'F'), punkt('feedback', null, 'FB')],
      aktiv: ALLE,
      laedt: false,
    });
    expect(b.punkte.map(p => p.satz)).toEqual(['F']);
    expect(b.nachsatz.map(p => p.satz)).toEqual(['N', 'FB']);
  });

  it('der Nachsatz folgt der Katalog-Reihenfolge, nicht der Eingabe', () => {
    const b = baueBrief({
      // feedback (umfeld) steht im Katalog HINTER nachtlauf (bewegung)
      punkte: [punkt('feedback', null, 'FB'), punkt('nachtlauf', null, 'N')],
      aktiv: ALLE,
      laedt: false,
    });
    expect(b.nachsatz.map(p => p.satz)).toEqual(['N', 'FB']);
  });

  it('bei Gleichstand entscheidet die Katalog-Reihenfolge', () => {
    const b = baueBrief({
      // zu-tun steht im Katalog HINTER stillstand — gleiche Tageszahl
      punkte: [punkt('zu-tun', 7, 'spaeter'), punkt('stillstand', 7, 'frueher')],
      aktiv: ALLE,
      laedt: false,
    });
    expect(b.punkte.map(p => p.satz)).toEqual(['frueher', 'spaeter']);
  });
});

describe('baueBrief — Deckel und Schwelle', () => {
  it('kappt auf den Deckel und nennt die Zahl der weggelassenen', () => {
    const viele = Array.from({ length: DECKEL + 3 }, (_, i) => punkt('stillstand', i, `P${i}`));
    const b = baueBrief({ punkte: viele, aktiv: ALLE, laedt: false });
    expect(b.punkte).toHaveLength(DECKEL);
    expect(b.weitere).toBe(3);
  });

  it('ohne Kappung ist `weitere` 0', () => {
    const b = baueBrief({ punkte: [punkt('stillstand', 1)], aktiv: ALLE, laedt: false });
    expect(b.weitere).toBe(0);
  });

  it('verwirft, was jenseits der Dringlichkeits-Schwelle liegt', () => {
    const b = baueBrief({
      punkte: [punkt('stillstand', DRINGLICH_AB_TAGEN + 1, 'fern'), punkt('stillstand', DRINGLICH_AB_TAGEN, 'nah')],
      aktiv: ALLE,
      laedt: false,
    });
    expect(b.punkte.map(p => p.satz)).toEqual(['nah']);
    // Verworfen heisst verworfen — nicht heimlich als „weitere" mitzählen.
    expect(b.weitere).toBe(0);
  });

  it('ein eigener Deckel überschreibt den Standard (Messläufe)', () => {
    const viele = Array.from({ length: 4 }, (_, i) => punkt('stillstand', i));
    const b = baueBrief({ punkte: viele, aktiv: ALLE, laedt: false, deckel: 2 });
    expect(b.punkte).toHaveLength(2);
    expect(b.weitere).toBe(2);
  });
});

describe('baueBrief — ein Vorgang spricht einmal', () => {
  const mitGruppe = (themaId: ThemaId, tage: number, gruppe: string, satz: string): BriefPunkt =>
    ({ ...punkt(themaId, tage, satz), gruppe });

  it('behält je Vorgang nur den dringlichsten Punkt', () => {
    // Gemessen: „WidyLa" stand zweimal im selben Absatz (damals zwei Meilensteine
    // desselben Verbunds). Ein Brief, der einen Vorgang wiederholt, fasst nichts
    // zusammen.
    const b = baueBrief({
      punkte: [
        mitGruppe('stillstand', -167, 'VB1', 'WidyLa spät'),
        mitGruppe('zu-tun', -139, 'VB1', 'WidyLa weniger spät'),
        mitGruppe('stillstand', -150, 'VB2', 'ATLAS'),
      ],
      aktiv: ALLE,
      laedt: false,
    });
    expect(b.punkte.map(p => p.satz)).toEqual(['WidyLa spät', 'ATLAS']);
  });

  it('zählt das Verdrängte NICHT als „weitere" mit', () => {
    // Sonst versprächen „und N weitere" Vorgänge, die längst genannt sind.
    const b = baueBrief({
      punkte: [
        mitGruppe('stillstand', -9, 'VB1', 'A'),
        mitGruppe('zu-tun', -8, 'VB1', 'A nochmal'),
      ],
      aktiv: ALLE,
      laedt: false,
      deckel: 1,
    });
    expect(b.punkte).toHaveLength(1);
    expect(b.weitere).toBe(0);
  });

  it('ein Punkt ohne Gruppe spricht für sich', () => {
    const b = baueBrief({
      punkte: [punkt('zu-tun', -5, 'A'), punkt('stillstand', -4, 'B')],
      aktiv: ALLE,
      laedt: false,
    });
    expect(b.punkte).toHaveLength(2);
  });

  it('die Entdopplung greift NICHT in den Nachsatz', () => {
    // Seit die Nachsatz-Punkte ihren Vorgang mitführen (damit die Rückfrage ihn
    // dem Assistenten mitgeben kann), tragen auch sie eine `gruppe`. Sie darf
    // sie nicht verdrängen: „zuletzt warst du bei CALYPSO" ist eine andere
    // Aussage als „CALYPSO ist überfällig", auch wenn beide denselben Vorgang
    // nennen. Die Entdopplung läuft nur über die Uhr-Punkte.
    const b = baueBrief({
      punkte: [
        mitGruppe('zu-tun', -302, 'VB1', 'CALYPSO überfällig'),
        { ...punkt('weitermachen', null, 'zuletzt warst du bei CALYPSO'), gruppe: 'VB1' },
      ],
      aktiv: ALLE,
      laedt: false,
    });
    expect(b.punkte.map(p => p.satz)).toEqual(['CALYPSO überfällig']);
    expect(b.nachsatz.map(p => p.satz)).toEqual(['zuletzt warst du bei CALYPSO']);
  });
});

describe('baueBrief — Themenwahl', () => {
  it('lässt abgewählte Themen ganz weg, in beiden Teilen', () => {
    const b = baueBrief({
      punkte: [punkt('zu-tun', 2, 'Z'), punkt('stillstand', 1, 'S'), punkt('feedback', null, 'FB')],
      aktiv: new Set<ThemaId>(['stillstand']),
      laedt: false,
    });
    expect(b.punkte.map(p => p.satz)).toEqual(['S']);
    expect(b.nachsatz).toEqual([]);
  });
});

describe('baueBrief — Leere braucht eine Erklärung', () => {
  it('benennt die geprüften Themen, statt „nichts zu tun" zu behaupten', () => {
    const b = baueBrief({
      punkte: [],
      aktiv: new Set<ThemaId>(['stillstand', 'nachtlauf', 'entwuerfe']),
      laedt: false,
    });
    expect(b.leerText).toBe(
      'Nichts Dringendes gefunden. Geprüft: Jetzt eingreifen, Änderungen über Nacht, Meine Entwürfe.',
    );
  });

  it('behauptet nichts, solange eine Quelle noch lädt', () => {
    const b = baueBrief({ punkte: [], aktiv: ALLE, laedt: true });
    expect(b.leerText).toBeNull();
    expect(b.laedt).toBe(true);
  });

  it('kein Leertext, sobald irgendetwas dasteht — auch nur im Nachsatz', () => {
    const b = baueBrief({ punkte: [punkt('feedback', null)], aktiv: ALLE, laedt: false });
    expect(b.leerText).toBeNull();
  });
});

describe('baueBrief — rein', () => {
  it('liest die Uhr nicht selbst: kein Date.now/new Date im Modul', () => {
    const src = readFileSync(join(__dirname, '..', 'baueBrief.ts'), 'utf-8');
    expect(src).not.toMatch(/Date\.now\(|new Date\(/);
  });

  it('lässt die Eingabe unangetastet', () => {
    const eingabe = [punkt('zu-tun', 9), punkt('stillstand', -1)];
    const kopie = JSON.parse(JSON.stringify(eingabe)) as unknown;
    baueBrief({ punkte: eingabe, aktiv: ALLE, laedt: false });
    expect(JSON.parse(JSON.stringify(eingabe))).toEqual(kopie);
  });
});
