/**
 * Die Erklärung der Zeichen im Trigger-Satz.
 *
 * Zwei Dinge stehen hier auf dem Prüfstand:
 *
 * 1. **Texterhaltung** — die Erklärung hängt nur an, sie schreibt nicht um. Wer
 *    die angereicherten Segmente verkettet, bekommt denselben Satz wie vorher.
 * 2. **Ehrlichkeit über die Lücken** — ein unbekanntes Kürzel an gedeuteter
 *    Position sagt „steht nicht im Katalog", eines an ungedeuteter schweigt. Wo
 *    keine Erklärung dranhängt, zeigt die Anzeige auch keine Geste; die
 *    Unterscheidung ist damit sichtbar und darf nicht verwischen.
 */
import { describe, it, expect } from 'vitest';
import {
  erklaereSegmente, erklaerKatalog, kuerzelErklaerung, statusErklaerung,
  ebeneErklaerung, empfaengerErklaerung,
} from '@/core/status/trigger-erklaerung';
import { kuerzelIndex } from '@/core/status/feld-zugriff';
import { baueSeedVersion } from '@/core/status/seed';
import { parseTriggerZeile } from '@/core/status/trigger-parser';
import { triggerSegmenteVon, alsText } from '@/core/status/trigger-satz';
import type { MappingVersion, StatusFeldEintrag } from '@/core/status/typen';

const seed = baueSeedVersion();
const katalog = erklaerKatalog(seed);
const index = kuerzelIndex(seed.felder);

/** Kurzform: Programm 76, Folge 1. */
const zeile = (kuerzel: string, prozedur: string, parameter: string) =>
  parseTriggerZeile({ programm: '76', kuerzel, folge: 1, prozedur, parameter });

describe('kuerzelIndex', () => {
  it('schlüsselt über normKey — der NFD-Trigger findet das NFC-Feld', () => {
    // Der Parser normalisiert nur das Kürzel der ZEILE, nicht die Kürzel in den
    // Parametern: `ohneTvKuerzel` kann NFD tragen. Der Join muss das aushalten.
    const feld = { feldId: 'D_ÄT', label: 'Ätzendes', code: 'ÄT' } as StatusFeldEintrag;
    const idx = kuerzelIndex([feld]);
    expect(kuerzelErklaerung(idx, 'ÄT'.normalize('NFD'))?.titel).toBe('Ätzendes');
    expect(kuerzelErklaerung(idx, 'ät')?.titel).toBe('Ätzendes');
  });

  it('entdoppelt einen Code an zwei Feldern — der erste gewinnt', () => {
    const erst = { feldId: 'bewilligung_datum', label: 'Bewilligung', code: 'ABB' } as StatusFeldEintrag;
    const zweit = { feldId: 'D_ABB', label: 'Doppelt', code: 'ABB' } as StatusFeldEintrag;
    expect(kuerzelIndex([erst, zweit]).get('abb')).toBe(erst);
  });

  it('überspringt Felder ohne Kürzel', () => {
    expect(kuerzelIndex([{ feldId: 'status', label: 'TV-Status' } as StatusFeldEintrag].slice()).size)
      .toBe(0);
  });
});

describe('kuerzelErklaerung', () => {
  it('nennt Bezeichnung und wer das Kürzel setzt', () => {
    const e = kuerzelErklaerung(index, 'ABB');
    expect(e?.titel).toBe('Bewilligung');
    expect(e?.zusatz).toMatch(/^wird gesetzt von /);
  });

  it('sagt bei einem neutralen Eintrag „von jedem", nicht „von niemandem"', () => {
    const neutral = kuerzelIndex([
      { feldId: 'D_NEU', label: 'Neutraler Eintrag', code: 'NEU', rollen: [] } as unknown as StatusFeldEintrag,
    ]);
    expect(kuerzelErklaerung(neutral, 'NEU')?.zusatz).toBe('von jedem zu setzen');
  });

  it('liefert null für ein Kürzel, das die Fassung nicht führt', () => {
    expect(kuerzelErklaerung(index, 'ZZZ')).toBeNull();
  });
});

describe('statusErklaerung', () => {
  it('nennt amtliche Bezeichnung und ZAH-Phase', () => {
    expect(statusErklaerung(katalog, 31)).toEqual({ titel: 'beantragt', zusatz: 'ZAH-Phase Eingang' });
  });

  it('kennzeichnet einen Marker-Status als solchen statt ihm eine Phase zu geben', () => {
    const e = statusErklaerung(katalog, 29);
    expect(e?.zusatz).toBe('Marker (ohne Phase)');
  });

  it('liefert null für einen Code, den der Katalog nicht führt', () => {
    // 74 kommt in der Trigger-Zuarbeit vor (`ABA/1`), steht aber in keinem
    // Status-Katalog — die Erklärung erfindet dafür nichts.
    expect(statusErklaerung(katalog, 74)).toBeNull();
  });

  it('lässt die kuratierte Fassung gegen den Auslieferungs-Schnitt gewinnen', () => {
    const umgehaengt: MappingVersion = {
      ...seed,
      werte: seed.werte.map(w => (w.code === 40 ? { ...w, zahPhaseId: 'entscheidung' as const } : w)),
    };
    expect(statusErklaerung(katalog, 40)?.zusatz).toBe('ZAH-Phase Prüfung');
    expect(statusErklaerung(erklaerKatalog(umgehaengt), 40)?.zusatz).toBe('ZAH-Phase Entscheidung');
  });

  it('greift auf den Auslieferungs-Schnitt zurück, wenn die Fassung keine Codes trägt', () => {
    const bestand: MappingVersion = {
      ...seed,
      werte: seed.werte.map(({ code: _c, zahPhaseId: _z, marker: _m, ...rest }) => rest),
    };
    expect(statusErklaerung(erklaerKatalog(bestand), 31))
      .toEqual({ titel: 'beantragt', zusatz: 'ZAH-Phase Eingang' });
  });
});

describe('ebeneErklaerung / empfaengerErklaerung', () => {
  it('benennt die Bezugsdatei-Nummern und sagt, dass die Zuordnung erschlossen ist', () => {
    expect(ebeneErklaerung('210')?.titel).toBe('Verbund-Ebene');
    expect(ebeneErklaerung('211')?.titel).toBe('Teilvorhaben-Ebene');
    expect(ebeneErklaerung('211')?.zusatz).toContain('erschlossen');
    expect(ebeneErklaerung('999')).toBeNull();
  });

  it('übersetzt bekannte Empfänger-Kürzel in ihre Rolle, erfindet aber keine', () => {
    expect(empfaengerErklaerung('TIB')?.titel).toContain('fachliche Bearbeitung');
    expect(empfaengerErklaerung('ZIM-Assistenz@vdivde-it.de')).toBeNull();
  });
});

describe('erklaereSegmente', () => {
  it('lässt den Satz Zeichen für Zeichen unverändert', () => {
    for (const p of ['<59|ABB|YIRR||||31|31', '211|74', 'XAAE|210|0', 'TIB|!.055.VorgInfo.01|BIB']) {
      const roh = triggerSegmenteVon(zeile('AAE', prozedurFuer(p), p));
      expect(alsText(erklaereSegmente(katalog, roh, index))).toBe(alsText(roh));
    }
  });

  it('erklärt Kürzel und Statuscodes im Bedingungssatz', () => {
    const s = erklaereSegmente(katalog, triggerSegmenteVon(zeile('AAE', 'TRG_TVs_Status_TV_VB', '<59|ABB|YIRR||||31|31')), index);
    const erklaert = new Map(s.filter(x => x.erklaerung).map(x => [x.text, x.erklaerung!.titel]));
    expect(erklaert.get('ABB')).toBe('Bewilligung');
    expect(erklaert.get('59')).toBe('bewilligt');
    expect(erklaert.get('31')).toBe('beantragt');
  });

  it('sagt bei einem gedeuteten, aber unbekannten Kürzel, dass es fehlt', () => {
    const s = erklaereSegmente(katalog, triggerSegmenteVon(zeile('AAE', 'TRG_TVs_Status_TV_VB', '<59|ZZZ|||||31|31')), index);
    expect(s.find(x => x.text === 'ZZZ')?.erklaerung?.titel).toBe('steht nicht im Katalog');
  });

  it('schweigt zu den ungedeuteten Zusatz-Argumenten', () => {
    // Position 4 deckt die Legacy-Doku nicht ab — dort steht nicht fest, dass es
    // überhaupt ein Kürzel ist. „Steht nicht im Katalog" behauptete diese Sicherheit.
    const s = erklaereSegmente(katalog, triggerSegmenteVon(zeile('AAE', 'TRG_TVs_Status_TV_VB', '<59|ABB|YIRR|ZZZ|||31|31')), index);
    expect(s.find(x => x.text === 'ZZZ')?.erklaerung).toBeUndefined();
  });

  it('erklärt ein katalogfremdes Kürzel, das die Fachseite benannt hat — auch an ungedeuteter Position', () => {
    // Der Unterschied zum Test darüber: bei `TTV2` ist BELEGT, dass es ein
    // Kürzel ist und welches. Genau das war der Grund fürs Schweigen, und mit
    // der Antwort aus V6 gilt er nicht mehr.
    const s = erklaereSegmente(katalog, triggerSegmenteVon(zeile('AAE', 'TRG_TVs_Status_TV_VB', '<59|ABB||TTV2|||31|31')), index);
    expect(s.find(x => x.text === 'TTV2')?.erklaerung?.titel).toBe('Testkürzel der Zuarbeit');
  });

  it('rührt Text-Segmente nicht an', () => {
    const roh = triggerSegmenteVon(zeile('ABA', 'TRG.Status.TV.VB', '211|74'));
    const s = erklaereSegmente(katalog, roh, index);
    expect(s.filter(x => x.art === 'text').every(x => x.erklaerung === undefined)).toBe(true);
    expect(s.find(x => x.art === 'ebene')?.erklaerung?.titel).toBe('Teilvorhaben-Ebene');
  });

  it('baut den Index selbst, wenn keiner hereingereicht wird', () => {
    const roh = triggerSegmenteVon(zeile('AAE', 'TRG_TVs_Status_TV_VB', '<59|ABB|||||31|31'));
    expect(erklaereSegmente(katalog, roh).find(x => x.text === 'ABB')?.erklaerung?.titel)
      .toBe('Bewilligung');
  });
});

/** Welche Prozedur zu diesem Parameter-Muster gehört — nur für den Texterhalt-Test. */
function prozedurFuer(parameter: string): string {
  if (parameter.startsWith('<')) return 'TRG_TVs_Status_TV_VB';
  if (parameter.includes('!.')) return 'TRG.VorgEintragMail';
  if (parameter.split('|').length === 3) return 'TRG.VorgEintragNeu';
  return 'TRG.Status.TV.VB';
}
