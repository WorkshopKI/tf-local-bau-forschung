/**
 * Die Überlagerung der Fremddaten durch die kuratierte Fassung.
 *
 * Bewacht wird der Zweck, nicht die Mechanik: **die Chronik und die
 * Verlaufs-Spur zeigen für dasselbe Kürzel dieselbe Zeichenkette.** Beide Reiter
 * liegen in derselben Sektion; vorher las sich `XKS` links „DL-Gutachten fertig
 * - FB/AB" (Fassung) und rechts „Gutachten fertig" (einkompilierter Katalog).
 *
 * Und die Ausnahme, die genauso wichtig ist: wo die Projektformen etwas
 * Verschiedenes sagen, gewinnt der Katalog weiter — die Fassung kennt nur einen
 * Wortlaut je Code.
 */
import { describe, it, expect } from 'vitest';
import { kuerzelAuskunft, ueberlagereKuration } from '../kuerzel-katalog';
import { baueUebergaenge } from '../verlauf';
import type { FeldVorkommen } from '../feld-aufloesung';
import type { StatusFeldEintrag } from '../typen';

function feld(code: string, label: string): StatusFeldEintrag {
  return {
    feldId: `D_${code}`, label, typ: 'datum', ebene: 'tv', code,
    prominenzDefault: 'normal', aktiv: true, unkuratiert: false,
  };
}

describe('ueberlagereKuration — die Fassung gewinnt, wo sie sprechen kann', () => {
  it('setzt den kuratierten Wortlaut über den Katalog', () => {
    const roh = kuerzelAuskunft('XKS', 'NW');
    expect(roh.bezeichnung).toBe('Gutachten fertig');

    const auf = ueberlagereKuration(roh, 'Gutachten fertig (Team-Wortlaut)');
    expect(auf.bezeichnung).toBe('Gutachten fertig (Team-Wortlaut)');
    expect(auf.herkunft).toBe('kuratiert');
    expect(auf.eindeutig).toBe(true);
  });

  it('lässt form-divergente Kürzel in Ruhe — dort kann die Fassung nichts sagen', () => {
    // `AB` heißt in NW/FuE etwas anderes als in DL. Eine flache Kuration
    // darüberzulegen gäbe jedem DL-Antrag wieder den NW-Wortlaut: genau der
    // Zustand vor v3.13, der 78,9 % der Anträge betraf.
    const dl = kuerzelAuskunft('AB', 'DL');
    expect(dl.bedeutungsdivergenz).toBe(true);

    const auf = ueberlagereKuration(dl, 'irgendein flacher Wortlaut');
    expect(auf).toBe(dl);
  });

  it('gibt einem dem Katalog unbekannten Kürzel trotzdem einen Namen', () => {
    // Der Katalog kennt 36 Codes der flachen Zuarbeit nicht. Ein kuratierter
    // Name ist dort besser als gar keiner.
    const roh = kuerzelAuskunft('GIBTESNICHT', 'NW');
    expect(roh.bezeichnung).toBeNull();

    const auf = ueberlagereKuration(roh, 'Sonderfall der Kuration');
    expect(auf.bezeichnung).toBe('Sonderfall der Kuration');
    expect(auf.eindeutig).toBe(true);
  });

  it('gibt dieselbe Referenz zurück, wenn es nichts zu tun gibt', () => {
    const roh = kuerzelAuskunft('XKS', 'NW');
    expect(ueberlagereKuration(roh, 'Gutachten fertig')).toBe(roh);
    expect(ueberlagereKuration(roh, '   ')).toBe(roh);
    expect(ueberlagereKuration(roh, undefined)).toBe(roh);
  });
});

describe('Chronik und Verlaufs-Spur zeigen denselben Text', () => {
  /** Ein Übergang aus genau einem gesetzten Datum — ohne C16-Regeln. */
  function spurText(f: StatusFeldEintrag): string | null {
    const vorkommen: FeldVorkommen[] = [{ feld: f, wert: '01.03.2024' }];
    return baueUebergaenge({
      vorkommen, projektform: 'NW', art: 'tv',
      regeln: new Map(), felderNachCode: new Map(), verbundKuerzel: [],
    })[0]?.bezeichnung ?? null;
  }

  it('die Spur übernimmt den Wortlaut, den die Chronik rendert', () => {
    // Die Chronik zeigt `feld.label` — hier wörtlich derselbe Eintrag.
    const f = feld('XKS', 'Gutachten fertig (vom Team umbenannt)');
    expect(spurText(f)).toBe(f.label);
  });

  it('eine Fassung, die den Katalogtext trägt, ändert nichts', () => {
    expect(spurText(feld('XKS', 'Gutachten fertig'))).toBe('Gutachten fertig');
  });

  it('bei form-divergenten Kürzeln bleibt die Spur bei ihrer Projektform', () => {
    // Die Fassung sagt hier bewusst etwas anderes — und wird überstimmt.
    const f = feld('AB', 'flacher Wortlaut aus einer Projektform');
    expect(spurText(f)).toBe('bewilligungsreif/Akte an Euronorm');
  });
});
