import { describe, it, expect } from 'vitest';
import type { AntragListItem } from '@/core/services/csv/types';
import {
  parseBearbeiterFilter,
  antragMatchesBearbeiter,
  applyBearbeiterFilter,
  applyInaktiveExclusion,
  isAlleMode,
  hasAnyKuerzelData,
  bearbeiterScopeLabel,
  sichtModus,
  kuerzelSchreibweisen,
  anzeigeTokensFuer,
} from '../bearbeiterFilter';

function makeAntrag(extra: Record<string, unknown>): AntragListItem {
  return {
    aktenzeichen: '16KN0001',
    programm_id: 'p1',
    _updated_at: '2026-01-01',
    ...extra,
  } as AntragListItem;
}

describe('bearbeiterScopeLabel (v1.1 — Modus sichtbar)', () => {
  it('gibt „Alle Bearbeiter" im inaktiven/„alle"-Modus', () => {
    expect(bearbeiterScopeLabel(parseBearbeiterFilter('alle', false))).toBe('Alle Bearbeiter');
    expect(bearbeiterScopeLabel(parseBearbeiterFilter(undefined, false))).toBe('Alle Bearbeiter');
  });

  it('gibt „Kürzel …" bei gesetztem Kürzel (Vertretung mit „/")', () => {
    expect(bearbeiterScopeLabel(parseBearbeiterFilter('thu', false))).toBe('Kürzel THU');
    expect(bearbeiterScopeLabel(parseBearbeiterFilter('MUE, SCH', false))).toBe('Kürzel MUE/SCH');
  });

  it('nimmt die Schreibweise, wo sie bekannt ist (v4.48)', () => {
    const mode = { ...parseBearbeiterFilter('THÜ, MUE', false), anzeigeTokens: ['THü', 'MuE'] };
    expect(bearbeiterScopeLabel(mode)).toBe('Kürzel THü/MuE');
  });

  it('faellt ohne Schreibweise auf das Token zurueck — nie leer', () => {
    const mode = { ...parseBearbeiterFilter('THÜ', false), anzeigeTokens: undefined };
    expect(bearbeiterScopeLabel(mode)).toBe('Kürzel THÜ');
  });
});

describe('kuerzelSchreibweisen (v4.48 — Anzeige ≠ Vergleichsform)', () => {
  it('findet die Schreibweise in beiden Bearbeiter-Spalten', () => {
    const map = kuerzelSchreibweisen(
      [makeAntrag({ tib_kuerz: 'THü' }), makeAntrag({ bib_kuerz: 'DaHa' })],
      ['THÜ', 'DAHA'],
    );
    expect([...map]).toEqual([['THÜ', 'THü'], ['DAHA', 'DaHa']]);
  });

  it('findet sie auch in den Begleitungs-Spalten — dieselbe Person', () => {
    const map = kuerzelSchreibweisen([makeAntrag({ ztp_kuerz: 'JuHe' })], ['JUHE']);
    expect(map.get('JUHE')).toBe('JuHe');
  });

  it('laesst ein unauffindbares Kuerzel weg (Aufrufer nimmt das Token)', () => {
    const map = kuerzelSchreibweisen([makeAntrag({ tib_kuerz: 'THü' })], ['THÜ', 'XYZ']);
    expect(map.has('XYZ')).toBe(false);
    expect(map.size).toBe(1);
  });

  it('nimmt den ERSTEN Treffer und liest danach nicht weiter', () => {
    // Im echten Bestand widerspricht sich kein Kuerzel; die Regel muss trotzdem
    // festliegen, sonst haengt die Anzeige an der Sortierung der Liste.
    const map = kuerzelSchreibweisen(
      [makeAntrag({ tib_kuerz: 'MaL' }), makeAntrag({ tib_kuerz: 'MAL' })],
      ['MAL'],
    );
    expect(map.get('MAL')).toBe('MaL');
  });

  it('normalisiert die gefundene Schreibweise nach NFC (Pitfall #22)', () => {
    // Codepoints explizit: ein literal getippter Umlaut laesst offen, welche
    // Unicode-Form in der Datei steht — und genau die ist hier der Prueffall.
    const nfd = 'TH\u0075\u0308';  // u + Combining Diaeresis
    const nfc = 'TH\u00FC';        // dasselbe Kuerzel, ein Codepoint
    expect(nfd).not.toBe(nfc);     // sonst prueft der Test nichts
    const map = kuerzelSchreibweisen([makeAntrag({ tib_kuerz: nfd })], [nfd.toUpperCase()]);
    expect([...map.values()][0]).toBe(nfc);
  });

  it('anzeigeTokensFuer gibt jedes Token zurueck — gefunden oder nicht', () => {
    expect(anzeigeTokensFuer(
      [makeAntrag({ tib_kuerz: 'MaL' })],
      ['MAL', 'XYZ'],
    )).toEqual(['MaL', 'XYZ']);
  });

  it('anzeigeTokensFuer haelt die Reihenfolge der Tokens', () => {
    // Die Beschriftung liest „Kürzel A/B" — vertauscht waere sie eine andere
    // Aussage, und die Map-Reihenfolge haengt an der Reihenfolge der Antraege.
    expect(anzeigeTokensFuer(
      [makeAntrag({ tib_kuerz: 'ScH' }), makeAntrag({ tib_kuerz: 'MuE' })],
      ['MUE', 'SCH'],
    )).toEqual(['MuE', 'ScH']);
  });

  it('scannt gar nicht ohne Tokens', () => {
    expect(kuerzelSchreibweisen([makeAntrag({ tib_kuerz: 'THü' })], []).size).toBe(0);
  });
});

describe('sichtModus (v4.47 — Meine/Alle ohne Kürzel-Verlust)', () => {
  it('reicht den Modus in der Sicht „meine" unverändert durch', () => {
    const eigen = parseBearbeiterFilter('THÜ', true);
    expect(sichtModus(eigen, 'meine')).toBe(eigen);
  });

  it('schaltet in der Sicht „alle" ab — inkl. der Tokens', () => {
    const alle = sichtModus(parseBearbeiterFilter('THÜ', false), 'alle');
    expect(alle.active).toBe(false);
    // Tokens müssen fallen: applyBearbeiterFilter prüft `active` zwar zuerst,
    // aber ein Modus mit Tokens und active:false wäre eine Falle für jeden
    // Konsumenten, der nur die Tokens liest.
    expect(alle.tokens).toEqual([]);
  });

  it('behält `includeBegleitung` in beiden Sichten — es beschreibt die Spalten, nicht den Ausschnitt', () => {
    expect(sichtModus(parseBearbeiterFilter('THÜ', true), 'alle').includeBegleitung).toBe(true);
    expect(sichtModus(parseBearbeiterFilter('THÜ', false), 'alle').includeBegleitung).toBe(false);
  });

  it('bleibt ohne Kürzel in beiden Sichten inaktiv', () => {
    expect(sichtModus(parseBearbeiterFilter('', false), 'meine').active).toBe(false);
    expect(sichtModus(parseBearbeiterFilter('alle', false), 'alle').active).toBe(false);
  });

  it('lässt in der Sicht „alle" jeden Antrag durch, den „meine" ausblendet', () => {
    const fremder = makeAntrag({ tib_kuerz: 'XYZ' });
    const eigen = parseBearbeiterFilter('THÜ', false);
    expect(antragMatchesBearbeiter(fremder, sichtModus(eigen, 'meine'))).toBe(false);
    expect(antragMatchesBearbeiter(fremder, sichtModus(eigen, 'alle'))).toBe(true);
  });
});

describe('parseBearbeiterFilter', () => {
  it('treats empty / undefined as inactive', () => {
    expect(parseBearbeiterFilter(undefined, false).active).toBe(false);
    expect(parseBearbeiterFilter('', false).active).toBe(false);
    expect(parseBearbeiterFilter('   ', false).active).toBe(false);
  });

  it('treats "alle" (case-insensitive) as inactive', () => {
    expect(parseBearbeiterFilter('alle', false).active).toBe(false);
    expect(parseBearbeiterFilter('ALLE', false).active).toBe(false);
    expect(parseBearbeiterFilter('  Alle  ', true).active).toBe(false);
  });

  it('parses a single token, uppercased', () => {
    const m = parseBearbeiterFilter('mue', false);
    expect(m.active).toBe(true);
    expect(m.tokens).toEqual(['MUE']);
    expect(m.includeBegleitung).toBe(false);
  });

  it('parses comma-separated tokens, trimmed and uppercased', () => {
    const m = parseBearbeiterFilter(' mue, sch , ko ', true);
    expect(m.active).toBe(true);
    expect(m.tokens).toEqual(['MUE', 'SCH', 'KO']);
    expect(m.includeBegleitung).toBe(true);
  });

  it('drops empty tokens between commas', () => {
    const m = parseBearbeiterFilter('mue,,sch', false);
    expect(m.tokens).toEqual(['MUE', 'SCH']);
  });
});

describe('antragMatchesBearbeiter', () => {
  const mode = parseBearbeiterFilter('MUE, SCH', false);
  const modeWithBegleitung = parseBearbeiterFilter('MUE', true);

  it('passes everything when filter is inactive', () => {
    const inactive = parseBearbeiterFilter('alle', false);
    expect(antragMatchesBearbeiter(makeAntrag({}), inactive)).toBe(true);
    expect(antragMatchesBearbeiter(makeAntrag({ TiB_KUERZ: 'XYZ' }), inactive)).toBe(true);
  });

  it('matches on TiB_KUERZ', () => {
    expect(antragMatchesBearbeiter(makeAntrag({ TiB_KUERZ: 'MUE' }), mode)).toBe(true);
  });

  it('matches on BIB_KUERZ', () => {
    expect(antragMatchesBearbeiter(makeAntrag({ BIB_KUERZ: 'sch' }), mode)).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(antragMatchesBearbeiter(makeAntrag({ TiB_KUERZ: 'mue' }), mode)).toBe(true);
    expect(antragMatchesBearbeiter(makeAntrag({ BIB_KUERZ: 'Sch' }), mode)).toBe(true);
  });

  it('does NOT match Begleitung-Spalten by default', () => {
    expect(antragMatchesBearbeiter(makeAntrag({ ZTP_KUERZ: 'MUE' }), mode)).toBe(false);
    expect(antragMatchesBearbeiter(makeAntrag({ PFM_KUERZ: 'MUE' }), mode)).toBe(false);
  });

  it('matches Begleitung-Spalten when includeBegleitung is true', () => {
    expect(antragMatchesBearbeiter(makeAntrag({ ZTP_KUERZ: 'MUE' }), modeWithBegleitung)).toBe(true);
    expect(antragMatchesBearbeiter(makeAntrag({ PFM_KUERZ: 'MUE' }), modeWithBegleitung)).toBe(true);
  });

  it('does NOT match when no KUERZ column has the token', () => {
    expect(antragMatchesBearbeiter(makeAntrag({ TiB_KUERZ: 'XYZ' }), mode)).toBe(false);
  });

  it('does NOT match when antrag has no KUERZ columns at all', () => {
    expect(antragMatchesBearbeiter(makeAntrag({}), mode)).toBe(false);
  });

  it('ignores non-string KUERZ values', () => {
    expect(antragMatchesBearbeiter(makeAntrag({ TiB_KUERZ: 123 }), mode)).toBe(false);
    expect(antragMatchesBearbeiter(makeAntrag({ BIB_KUERZ: null }), mode)).toBe(false);
  });

  // Regression: CSV-Mapping mit `col.toLowerCase()`-Fallback erzeugt Antrag-
  // Properties wie `tib_kuerz` / `ztp_kuerz` (lowercase). Match muss
  // case-insensitive über den Property-Key laufen.
  it('matches lowercase property keys (CSV-Mapping-Fallback)', () => {
    const m = parseBearbeiterFilter('AM', true);
    expect(antragMatchesBearbeiter(makeAntrag({ ztp_kuerz: 'AM' }), m)).toBe(true);
    expect(antragMatchesBearbeiter(makeAntrag({ tib_kuerz: 'AM' }), m)).toBe(true);
    expect(antragMatchesBearbeiter(makeAntrag({ bib_kuerz: 'AM' }), m)).toBe(true);
    expect(antragMatchesBearbeiter(makeAntrag({ pfm_kuerz: 'AM' }), m)).toBe(true);
  });

  it('matches mixed-case property keys', () => {
    const m = parseBearbeiterFilter('AM', false);
    expect(antragMatchesBearbeiter(makeAntrag({ Tib_Kuerz: 'AM' }), m)).toBe(true);
    expect(antragMatchesBearbeiter(makeAntrag({ TIB_KUERZ: 'AM' }), m)).toBe(true);
  });

  it('does NOT match Begleitung lowercase when includeBegleitung=false', () => {
    const m = parseBearbeiterFilter('AM', false);
    expect(antragMatchesBearbeiter(makeAntrag({ ztp_kuerz: 'AM' }), m)).toBe(false);
    expect(antragMatchesBearbeiter(makeAntrag({ pfm_kuerz: 'AM' }), m)).toBe(false);
  });

  // Neue Semantik (Mai 2026): bearbeiter_inkl_begleitung steuert nur noch,
  // welche KUERZ-Spalten gematcht werden — NICHT mehr die Phase. Ein TIB-/
  // BIB-Match übersteuert die Phase: wer einmal als TIB auf dem Antrag
  // stand, sieht ihn auch nach Übergang in VN/ZB-Phase. Begründung:
  // Recherche nach alten ähnlichen Anträgen (Textvorlagen) braucht die
  // Sicht auch auf in-Begleitung-übergegangene Fälle.
  it('TIB-Match ohne Begleitung-Toggle: Antrag in Begleit-Phase bleibt sichtbar', () => {
    const m = parseBearbeiterFilter('AM', false);
    expect(antragMatchesBearbeiter(makeAntrag({
      tib_kuerz: 'AM', status: 'VN geprüft',
    }), m)).toBe(true);
  });
  it('TIB-Match mit Begleitung-Toggle: Antrag in Begleit-Phase wird gezeigt', () => {
    const m = parseBearbeiterFilter('AM', true);
    expect(antragMatchesBearbeiter(makeAntrag({
      tib_kuerz: 'AM', status: 'VN geprüft',
    }), m)).toBe(true);
  });
  it('TIB-Match ohne Begleitung-Toggle: Antrag in Antrags-Pruefung (kaufm geprueft) bleibt sichtbar', () => {
    const m = parseBearbeiterFilter('AM', false);
    expect(antragMatchesBearbeiter(makeAntrag({
      tib_kuerz: 'AM', status: 'kaufm geprüft',
    }), m)).toBe(true);
  });
  it('TIB-Match ohne Begleitung-Toggle: Antrag mit VN-Pattern bleibt jetzt sichtbar', () => {
    const m = parseBearbeiterFilter('AM', false);
    expect(antragMatchesBearbeiter(makeAntrag({
      tib_kuerz: 'AM', status: 'VN angefordert',
    }), m)).toBe(true);
  });
  it('TIB-Match ohne Begleitung-Toggle: bewilligt (final) bleibt sichtbar', () => {
    const m = parseBearbeiterFilter('AM', false);
    expect(antragMatchesBearbeiter(makeAntrag({
      tib_kuerz: 'AM', status: 'bewilligt',
    }), m)).toBe(true);
  });
  // ZTP/PFM-only Match ohne Begleitung-Toggle: Antrag bleibt unsichtbar,
  // weil ZTP/PFM-Spalten in diesem Modus gar nicht gemacht werden — auch
  // dann nicht, wenn der Antrag zufaellig in Begleit-Phase ist.
  it('ZTP-only Match ohne Begleitung-Toggle: Antrag in Begleit-Phase bleibt unsichtbar', () => {
    const m = parseBearbeiterFilter('AM', false);
    expect(antragMatchesBearbeiter(makeAntrag({
      ztp_kuerz: 'AM', status: 'VN geprüft',
    }), m)).toBe(false);
  });
});

describe('applyBearbeiterFilter', () => {
  const list: AntragListItem[] = [
    makeAntrag({ aktenzeichen: '1', TiB_KUERZ: 'MUE' }),
    makeAntrag({ aktenzeichen: '2', BIB_KUERZ: 'SCH' }),
    makeAntrag({ aktenzeichen: '3', ZTP_KUERZ: 'MUE' }),
    makeAntrag({ aktenzeichen: '4', TiB_KUERZ: 'XYZ' }),
    makeAntrag({ aktenzeichen: '5' }),
  ];

  it('returns all when filter is inactive', () => {
    const inactive = parseBearbeiterFilter('alle', false);
    expect(applyBearbeiterFilter(list, inactive)).toHaveLength(5);
  });

  it('keeps only Bearbeiter-matches by default', () => {
    const m = parseBearbeiterFilter('MUE', false);
    const result = applyBearbeiterFilter(list, m);
    expect(result.map(a => a.aktenzeichen)).toEqual(['1']);
  });

  it('keeps Bearbeiter + Begleitung when includeBegleitung', () => {
    const m = parseBearbeiterFilter('MUE', true);
    const result = applyBearbeiterFilter(list, m);
    expect(result.map(a => a.aktenzeichen).sort()).toEqual(['1', '3']);
  });

  it('matches multiple tokens (OR)', () => {
    const m = parseBearbeiterFilter('MUE, SCH', false);
    const result = applyBearbeiterFilter(list, m);
    expect(result.map(a => a.aktenzeichen).sort()).toEqual(['1', '2']);
  });
});

describe('hasAnyKuerzelData', () => {
  it('returns false when list is empty', () => {
    expect(hasAnyKuerzelData([], false)).toBe(false);
    expect(hasAnyKuerzelData([], true)).toBe(false);
  });

  it('returns false when no antrag has any KUERZ field', () => {
    const list = [makeAntrag({}), makeAntrag({ aktenzeichen: 'X', titel: 'Foo' })];
    expect(hasAnyKuerzelData(list, false)).toBe(false);
    expect(hasAnyKuerzelData(list, true)).toBe(false);
  });

  it('returns true when at least one antrag has TiB_KUERZ or BIB_KUERZ', () => {
    expect(hasAnyKuerzelData([makeAntrag({ TiB_KUERZ: 'MUE' })], false)).toBe(true);
    expect(hasAnyKuerzelData([makeAntrag({ BIB_KUERZ: 'SCH' })], false)).toBe(true);
  });

  it('ignores Begleitung when includeBegleitung=false', () => {
    expect(hasAnyKuerzelData([makeAntrag({ ZTP_KUERZ: 'MUE' })], false)).toBe(false);
    expect(hasAnyKuerzelData([makeAntrag({ PFM_KUERZ: 'MUE' })], false)).toBe(false);
  });

  it('includes Begleitung when includeBegleitung=true', () => {
    expect(hasAnyKuerzelData([makeAntrag({ ZTP_KUERZ: 'MUE' })], true)).toBe(true);
    expect(hasAnyKuerzelData([makeAntrag({ PFM_KUERZ: 'MUE' })], true)).toBe(true);
  });

  it('ignores empty / whitespace-only KUERZ values', () => {
    expect(hasAnyKuerzelData([makeAntrag({ TiB_KUERZ: '' })], false)).toBe(false);
    expect(hasAnyKuerzelData([makeAntrag({ TiB_KUERZ: '   ' })], false)).toBe(false);
  });

  it('ignores non-string values', () => {
    expect(hasAnyKuerzelData([makeAntrag({ TiB_KUERZ: 42 })], false)).toBe(false);
    expect(hasAnyKuerzelData([makeAntrag({ BIB_KUERZ: null })], false)).toBe(false);
  });

  // Regression: Property-Keys können je nach Column-Mapping uppercase
  // (`ZTP_KUERZ`), lowercase (`ztp_kuerz`) oder gemischt sein. Detection
  // muss alle Varianten finden.
  it('detects lowercase property keys', () => {
    expect(hasAnyKuerzelData([makeAntrag({ ztp_kuerz: 'AM' })], true)).toBe(true);
    expect(hasAnyKuerzelData([makeAntrag({ tib_kuerz: 'X' })], false)).toBe(true);
  });

  it('lowercase Begleitung ignored when includeBegleitung=false', () => {
    expect(hasAnyKuerzelData([makeAntrag({ ztp_kuerz: 'AM' })], false)).toBe(false);
    expect(hasAnyKuerzelData([makeAntrag({ pfm_kuerz: 'AM' })], false)).toBe(false);
  });

  it('detects mixed-case property keys', () => {
    expect(hasAnyKuerzelData([makeAntrag({ Tib_Kuerz: 'X' })], false)).toBe(true);
  });
});

describe('isAlleMode', () => {
  it('true for empty / whitespace / undefined', () => {
    expect(isAlleMode(undefined)).toBe(true);
    expect(isAlleMode('')).toBe(true);
    expect(isAlleMode('   ')).toBe(true);
  });

  it('true for "alle" (case-insensitive)', () => {
    expect(isAlleMode('alle')).toBe(true);
    expect(isAlleMode('ALLE')).toBe(true);
    expect(isAlleMode('  Alle ')).toBe(true);
  });

  it('false for a concrete Kürzel or Vertretungs-Liste', () => {
    expect(isAlleMode('MUE')).toBe(false);
    expect(isAlleMode('MUE,SCH')).toBe(false);
  });
});

describe('applyInaktiveExclusion', () => {
  const list: AntragListItem[] = [
    makeAntrag({ aktenzeichen: '1', tib_kuerz: 'MUE' }), // aktiv
    makeAntrag({ aktenzeichen: '2', tib_kuerz: 'EXM' }), // inaktiv
    makeAntrag({ aktenzeichen: '3' }),                   // kein tib_kuerz
  ];
  const inaktiv: ReadonlySet<string> = new Set(['EXM']);

  it('blendet Anträge inaktiver MAs im „alle"-Modus aus', () => {
    const result = applyInaktiveExclusion(list, false, inaktiv, false);
    expect(result.map(a => a.aktenzeichen)).toEqual(['1', '3']);
  });

  it('lässt alles durch, wenn Inaktive eingeblendet werden', () => {
    expect(applyInaktiveExclusion(list, false, inaktiv, true)).toHaveLength(3);
  });

  it('lässt alles durch, wenn ein Kürzel-Filter aktiv ist (per-MA-Modus)', () => {
    expect(applyInaktiveExclusion(list, true, inaktiv, false)).toHaveLength(3);
  });

  it('No-op bei leerer Inaktiv-Menge (z.B. außerhalb pl/dev)', () => {
    expect(applyInaktiveExclusion(list, false, new Set(), false)).toHaveLength(3);
  });

  it('blendet einen Antrag ohne tib_kuerz nicht aus', () => {
    expect(applyInaktiveExclusion([makeAntrag({ aktenzeichen: '3' })], false, inaktiv, false)).toHaveLength(1);
  });

  it('blendet einen aktiven MA nicht aus', () => {
    expect(applyInaktiveExclusion([makeAntrag({ aktenzeichen: '1', tib_kuerz: 'MUE' })], false, inaktiv, false)).toHaveLength(1);
  });

  it('matcht trotz NFD-vs-NFC-Unterschied im tib_kuerz', () => {
    const nfc = 'THÜ';           // NFC: TH + Ü (komponiert)
    const nfd = 'THÜ';     // NFD: TH + U + combining diaeresis
    const setNfc: ReadonlySet<string> = new Set([nfc]);
    const antraege = [makeAntrag({ aktenzeichen: 'x', tib_kuerz: nfd })];
    expect(applyInaktiveExclusion(antraege, false, setNfc, false)).toHaveLength(0);
  });
});

/**
 * Der Rollen-Zuschnitt (Vorgangssystem): AB liest BIB/BFM/PFM, FB liest
 * TIB/ZTP. Die wichtigste Zusage steht im ersten Test — **ohne `rolle` ändert
 * sich nichts**. Die Förderanträge-Liste ruft denselben Filter auf und darf von
 * der Erweiterung nichts merken.
 */
describe('Rollen-Zuschnitt der Spalten', () => {
  const nurFb = makeAntrag({ aktenzeichen: 'fb', tib_kuerz: 'MUE' });
  const nurAb = makeAntrag({ aktenzeichen: 'ab', bib_kuerz: 'MUE' });
  const begleitFb = makeAntrag({ aktenzeichen: 'zt', ztp_kuerz: 'MUE' });
  const begleitAb = makeAntrag({ aktenzeichen: 'pf', pfm_kuerz: 'MUE' });
  const alle = [nurFb, nurAb, begleitFb, begleitAb];
  const az = (l: AntragListItem[]): string[] => l.map(a => a.aktenzeichen);

  it('ohne Rolle exakt wie bisher — Bearbeiter-Spalten beider Rollen', () => {
    const mode = parseBearbeiterFilter('MUE', false);
    expect(az(applyBearbeiterFilter(alle, mode))).toEqual(['fb', 'ab']);
    expect(mode.rolle).toBeUndefined();
  });

  it('ohne Rolle, mit Begleitung: alle vier Spalten', () => {
    const mode = parseBearbeiterFilter('MUE', true);
    expect(az(applyBearbeiterFilter(alle, mode))).toEqual(['fb', 'ab', 'zt', 'pf']);
  });

  it('AB sieht nur die BIB-Spalte', () => {
    const mode = { ...parseBearbeiterFilter('MUE', false), rolle: 'ab' as const };
    expect(az(applyBearbeiterFilter(alle, mode))).toEqual(['ab']);
  });

  it('FB sieht nur die TIB-Spalte', () => {
    const mode = { ...parseBearbeiterFilter('MUE', false), rolle: 'fb' as const };
    expect(az(applyBearbeiterFilter(alle, mode))).toEqual(['fb']);
  });

  it('mit Begleitung kommt je Rolle genau ihre Begleit-Spalte dazu', () => {
    const ab = { ...parseBearbeiterFilter('MUE', true), rolle: 'ab' as const };
    const fb = { ...parseBearbeiterFilter('MUE', true), rolle: 'fb' as const };
    expect(az(applyBearbeiterFilter(alle, ab))).toEqual(['ab', 'pf']);
    expect(az(applyBearbeiterFilter(alle, fb))).toEqual(['fb', 'zt']);
  });

  it('Rollen ohne eigene Spalten (QS/PA/Jur) behalten den vollen Satz', () => {
    // Ein leerer Spaltensatz blendete jeden Antrag aus — das wäre keine
    // Einschränkung, sondern ein stiller Totalausfall.
    const mode = { ...parseBearbeiterFilter('MUE', false), rolle: 'qs' as const };
    expect(az(applyBearbeiterFilter(alle, mode))).toEqual(['fb', 'ab']);
  });

  it('antragMatchesBearbeiter folgt demselben Zuschnitt', () => {
    const ab = { ...parseBearbeiterFilter('MUE', false), rolle: 'ab' as const };
    expect(antragMatchesBearbeiter(nurAb, ab)).toBe(true);
    expect(antragMatchesBearbeiter(nurFb, ab)).toBe(false);
  });

  it('inaktiver Filter reicht auch mit Rolle alles durch', () => {
    const mode = { ...parseBearbeiterFilter('alle', false), rolle: 'ab' as const };
    expect(az(applyBearbeiterFilter(alle, mode))).toEqual(az(alle));
  });
});
