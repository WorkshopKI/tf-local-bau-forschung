/**
 * Der Feld-Vorrat des To-do-Editors und die Prüfung, die ihn begleitet — beide
 * müssen dieselbe Menge meinen (v2.386). Läuft der Editor auf einem anderen
 * Vokabular als die Auswertung, baut man dort Regeln, die nie zutreffen.
 */
import { describe, it, expect } from 'vitest';
import { referenzierbareFelder, type StatusFeldEintrag } from '@/core/status';
import { baueTodoFeldVorrat } from '../todoFeldVorrat';

const feld = (p: Partial<StatusFeldEintrag> & { feldId: string }): StatusFeldEintrag => ({
  label: p.feldId, typ: 'datum', ebene: 'tv', kategorieId: 'tv.ab', rollen: [],
  prominenzDefault: 'normal', aktiv: true, unkuratiert: false, ...p,
});

const FELDER: StatusFeldEintrag[] = [
  feld({ feldId: 'status', typ: 'wert', label: 'TV-Status' }),
  feld({ feldId: 'D_XPC+', code: 'XPC+', label: 'PreCheck Verbund', textSpalte: 'T_XPC+' }),
  feld({ feldId: 'D_AK4', code: 'AK4', label: 'Gutachten kaufm.' }),
  feld({ feldId: 'D_ALT', code: 'ALT', aktiv: false }),
];

describe('baueTodoFeldVorrat', () => {
  it('bietet die Katalog-Felder samt Begleit-Textspalte an', () => {
    const ids = baueTodoFeldVorrat(FELDER).map(s => s.feldId);
    expect(ids).toContain('D_XPC+');
    expect(ids, 'T_XPC+ trägt einen anderen Wert als D_XPC+ (R20/R21)').toContain('T_XPC+');
  });

  it('stellt die kanonischen Felder nach vorn und sortiert den Rest stabil', () => {
    expect(baueTodoFeldVorrat(FELDER).map(s => s.feldId))
      .toEqual(['status', 'D_AK4', 'D_XPC+', 'T_XPC+']);
  });

  it('lässt stillgelegte Felder weg — eine Regel darauf wäre stumm', () => {
    expect(baueTodoFeldVorrat(FELDER).map(s => s.feldId)).not.toContain('D_ALT');
  });

  it('gibt der Textspalte den Typ „wert" (die Mappe fragt sie mit „gefüllt")', () => {
    expect(baueTodoFeldVorrat(FELDER).find(s => s.feldId === 'T_XPC+')?.typ).toBe('wert');
  });

  it('deckt sich mit dem, was die Import-Validierung durchlässt', () => {
    // Der eigentliche Punkt: Editor-Angebot ⊆ Prüf-Menge. Wäre das verletzt,
    // böte der Editor ein Feld an, das der Share-Import später zurückweist.
    const erlaubt = referenzierbareFelder(FELDER);
    for (const s of baueTodoFeldVorrat(FELDER)) {
      expect(erlaubt.has(s.feldId), `${s.feldId} wird angeboten, aber nicht akzeptiert`).toBe(true);
    }
  });
});

describe('referenzierbareFelder', () => {
  it('nimmt Feld und Textspalte auf, sonst nichts', () => {
    expect([...referenzierbareFelder(FELDER)].sort())
      .toEqual(['D_AK4', 'D_ALT', 'D_XPC+', 'T_XPC+', 'status']);
  });
});
