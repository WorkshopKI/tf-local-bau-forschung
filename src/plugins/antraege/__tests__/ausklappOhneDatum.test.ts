/**
 * Die terminlosen Einträge des Vorgangsverlaufs.
 *
 * Der Test, auf den es ankommt, ist der letzte: `D_AAI` führt eine Begleitnotiz
 * in `T_AAI`. Wer die beiden `T_`-Fälle verwechselt — eigene Textspalte vs.
 * Notiz an einem Datumsfeld — schreibt den Antragsimport in diesen Block und
 * gleichzeitig unter den Chronik-Eintrag. Dasselbe Ereignis stünde zweimal da,
 * einmal mit Termin und einmal ohne.
 */
import { describe, it, expect } from 'vitest';
import type { FeldVorkommen } from '@/core/status';
import type { Prominenz, StatusFeldEintrag } from '@/core/status/typen';
import { baueOhneDatum } from '@/plugins/antraege/ausklapp/vorgangsverlauf/ohneDatum';

function feld(p: Partial<StatusFeldEintrag> & { feldId: string }): StatusFeldEintrag {
  return {
    label: p.feldId,
    typ: 'text',
    ebene: 'tv',
    rollen: [],
    prominenzDefault: 'normal' as Prominenz,
    aktiv: true,
    unkuratiert: false,
    ...p,
  };
}

/** Ein Texteintrag, wie `sammleVorkommen` ihn liefert. */
function text(
  feldId: string, wert: string, opt: { code?: string; label?: string; tvId?: string } = {},
): FeldVorkommen {
  return {
    feld: feld({
      feldId,
      ...(opt.code ? { code: opt.code } : {}),
      ...(opt.label ? { label: opt.label } : {}),
    }),
    wert,
    ...(opt.tvId ? { tvId: opt.tvId } : {}),
  };
}

describe('baueOhneDatum', () => {
  it('nimmt die Codes, deren eigene Spalte eine Textspalte ist', () => {
    const liste = baueOhneDatum([
      text('T_ABK', '302400', { code: 'ABK', label: 'Bewilligungskosten' }),
      text('T_AMA', '3', { code: 'AMA', label: 'Anzahl Mitarbeiter' }),
    ]);
    expect(liste.map(e => e.code)).toEqual(['AMA', 'ABK']);   // nach Bezeichnung
    expect(liste.map(e => e.wert)).toEqual(['3', '302400']);
  });

  it('lässt Datumsfelder draußen — sie stehen in der Chronik', () => {
    const datum: FeldVorkommen = {
      feld: feld({ feldId: 'D_ARZ', typ: 'datum', code: 'ARZ' }),
      wert: '28.07.2026',
    };
    expect(baueOhneDatum([datum])).toEqual([]);
  });

  it('lässt die App-eigenen Wert-Projektionen draußen', () => {
    const status: FeldVorkommen = {
      feld: feld({ feldId: 'status', typ: 'wert', label: 'TV-Status' }),
      wert: 'ablehnungsreif',
    };
    expect(baueOhneDatum([status])).toEqual([]);
  });

  it('lässt „ignoriert" und inaktive Felder draußen', () => {
    const ignoriert: FeldVorkommen = {
      feld: feld({ feldId: 'T_YW', code: 'YW', prominenzDefault: 'ignoriert' }),
      wert: 'x',
    };
    const inaktiv: FeldVorkommen = {
      feld: feld({ feldId: 'T_HINT', code: 'HINT', aktiv: false }),
      wert: 'y',
    };
    expect(baueOhneDatum([ignoriert, inaktiv])).toEqual([]);
  });

  it('nimmt „nebensächlich" mit — der Block hat keinen eigenen Schalter', () => {
    const neben: FeldVorkommen = {
      feld: feld({ feldId: 'T_AR', code: 'AR', prominenzDefault: 'nebensaechlich' }),
      wert: 'z',
    };
    expect(baueOhneDatum([neben]).map(e => e.code)).toEqual(['AR']);
  });

  it('faltet dieselbe Spalte über mehrere Teilvorhaben zu EINEM Eintrag', () => {
    const liste = baueOhneDatum([
      text('T_AVB', 'NF', { code: 'AVB', tvId: '16DS261011' }),
      text('T_AVB', 'NF', { code: 'AVB', tvId: '16DS261012' }),
    ]);
    expect(liste).toHaveLength(1);
    expect(liste[0]?.traeger).toBe('2 Teilvorhaben');
  });

  it('nennt das einzelne Teilvorhaben beim Namen, den Verbund als Verbund', () => {
    const liste = baueOhneDatum([
      text('T_AVU', '200000', { code: 'AVU', label: 'A', tvId: '16EP260076' }),
      text('T_XAT', '1', { code: 'XAT', label: 'B' }),
    ]);
    expect(liste.map(e => e.traeger)).toEqual(['16EP260076', 'Verbund']);
  });

  it('fällt ohne Code auf die Spalte zurück', () => {
    expect(baueOhneDatum([text('T_NEU', 'wert')])[0]?.code).toBe('T_NEU');
  });

  it('liefert für eine leere Eingabe eine leere Liste', () => {
    expect(baueOhneDatum([])).toEqual([]);
  });

  it('nimmt die BEGLEITNOTIZ eines Datumsfeldes NICHT auf', () => {
    // `D_AAI` trägt `textSpalte: 'T_AAI'`. `sammleVorkommen` legt daraus KEIN
    // eigenes Vorkommen an, sondern hängt den Text an den datierten Eintrag.
    const mitNotiz: FeldVorkommen = {
      feld: feld({
        feldId: 'D_AAI', typ: 'datum', code: 'AAI',
        label: 'Antragsimport aus ZIM-Foyer oder FZD', textSpalte: 'T_AAI',
      }),
      wert: '20.03.2026',
      text: 'Antragsimport aus ZIM-Foyer oder FZD (Vorgangscode: 2a4d29f1)',
    };
    expect(baueOhneDatum([mitNotiz])).toEqual([]);
  });
});
