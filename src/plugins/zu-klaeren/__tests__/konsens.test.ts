/**
 * Was diese Datei festnagelt:
 *
 * 1. Verglichen wird der Zielwert, nicht der gedrückte Knopf — `passt` und
 *    `andere → dieselbe Phase` sind einig, nicht uneinig.
 * 2. `unklar` ist fehlende Information, keine Gegenstimme (eigene Achse).
 * 3. Zurückgezogene Urteile zählen wie nie abgegeben.
 * 4. Freitext-Punkte sind nie strittig — sonst versteckte „nur strittige"
 *    ausgerechnet die Grundsatzfragen.
 * 5. Ein Sammel- oder Vertretungs-Kürzel darf nicht antworten.
 */
import { describe, it, expect } from 'vitest';
import { konsens, istAntwortfaehig, autorenVon } from '@/plugins/zu-klaeren/konsens';
import { falte } from '@/plugins/zu-klaeren/fold';
import type { KlaerungEintrag, KlaerungPunkt } from '@/plugins/zu-klaeren/typen';

const ZEILE: KlaerungPunkt = {
  id: 'code-38', klaerungId: 'k', art: 'phasenzuordnung',
  titel: '38 · techn geprüft', code: 38, seedZiel: 'pruefung',
};
// Bewusst KEINE Id aus `ALT_PUNKT_IDS` (`frage-1` …): die würde beim Falten
// übersetzt, und der Test prüfte dann etwas anderes, als er behauptet.
const FRAGE: KlaerungPunkt = {
  id: 'frage-freitext-fixture', klaerungId: 'k', art: 'freitext', titel: 'Warum?',
};

const stand = (...e: Partial<KlaerungEintrag>[]) => falte(
  e.map((x, i) => ({ ts: `2026-08-04T10:0${i}:00.000Z`, autor: 'X', punktId: ZEILE.id, ...x } as KlaerungEintrag)),
);

describe('konsens (Einigkeit misst den Zielwert, nicht den Knopf)', () => {
  it('ohne Antwort ist der Punkt offen, nicht einig', () => {
    expect(konsens(falte([]), ZEILE, []).zustand).toBe('offen');
  });

  it('ein einzelnes Urteil ist nie strittig', () => {
    const s = stand({ autor: 'MUE', urteil: 'andere', zielWert: 'entscheidung' });
    expect(konsens(s, ZEILE, ['MUE'])).toMatchObject({ zustand: 'einig', ziel: 'entscheidung' });
  });

  it('passt und andere auf dieselbe Phase sind einig', () => {
    // MUE drückt „passt" (= pruefung, der Seed-Wert), SCH wählt ausdrücklich
    // pruefung. Zwei Knöpfe, eine Aussage — hier darf kein Konflikt entstehen.
    const s = stand(
      { autor: 'MUE', urteil: 'passt' },
      { autor: 'SCH', urteil: 'andere', zielWert: 'pruefung' },
    );
    expect(konsens(s, ZEILE, ['MUE', 'SCH'])).toMatchObject({ zustand: 'einig', ziel: 'pruefung' });
  });

  it('andere→pruefung gegen andere→entscheidung ist strittig', () => {
    const s = stand(
      { autor: 'MUE', urteil: 'andere', zielWert: 'pruefung' },
      { autor: 'SCH', urteil: 'andere', zielWert: 'entscheidung' },
    );
    expect(konsens(s, ZEILE, ['MUE', 'SCH'])).toMatchObject({ zustand: 'strittig', ziel: null });
  });

  it('passt gegen andere→andere Phase ist strittig', () => {
    const s = stand(
      { autor: 'MUE', urteil: 'passt' },
      { autor: 'SCH', urteil: 'andere', zielWert: 'entscheidung' },
    );
    expect(konsens(s, ZEILE, ['MUE', 'SCH']).zustand).toBe('strittig');
  });

  it('unklar allein macht nicht strittig, sondern offen mit Rückfrage', () => {
    const s = stand({ autor: 'MUE', urteil: 'unklar' });
    const b = konsens(s, ZEILE, ['MUE']);
    expect(b.zustand).toBe('offen');
    expect(b.unklarVon).toEqual(['MUE']);
  });

  it('unklar neben übereinstimmenden Urteilen bleibt einig, meldet aber die Rückfrage', () => {
    const s = stand(
      { autor: 'MUE', urteil: 'passt' },
      { autor: 'SCH', urteil: 'passt' },
      { autor: 'THU', urteil: 'unklar' },
    );
    const b = konsens(s, ZEILE, ['MUE', 'SCH', 'THU']);
    expect(b.zustand).toBe('einig');
    expect(b.unklarVon).toEqual(['THU']);
  });

  it('unklar neben zwei gegensätzlichen Urteilen bleibt strittig', () => {
    const s = stand(
      { autor: 'MUE', urteil: 'passt' },
      { autor: 'SCH', urteil: 'andere', zielWert: 'begleitung' },
      { autor: 'THU', urteil: 'unklar' },
    );
    expect(konsens(s, ZEILE, ['MUE', 'SCH', 'THU']).zustand).toBe('strittig');
  });

  it('zurückgezogene Urteile zählen nicht mit', () => {
    const s = stand(
      { autor: 'MUE', urteil: 'andere', zielWert: 'begleitung' },
      { autor: 'MUE', urteil: 'zurueckgezogen' },
      { autor: 'SCH', urteil: 'passt' },
    );
    expect(konsens(s, ZEILE, ['MUE', 'SCH'])).toMatchObject({ zustand: 'einig', ziel: 'pruefung' });
  });

  it('andere ohne gewählte Zielphase sagt noch nichts', () => {
    const s = stand({ autor: 'MUE', urteil: 'andere' });
    expect(konsens(s, ZEILE, ['MUE']).zustand).toBe('offen');
  });

  it('Freitext-Punkte sind nie strittig', () => {
    const s = falte([
      { ts: 'T1', autor: 'MUE', punktId: FRAGE.id, kommentar: 'so' },
      { ts: 'T2', autor: 'SCH', punktId: FRAGE.id, kommentar: 'anders' },
    ]);
    expect(konsens(s, FRAGE, ['MUE', 'SCH']).zustand).toBe('offen');
  });
});

describe('autorenVon (wer hat sich überhaupt geäußert)', () => {
  it('sammelt Urteilende und Kommentierende, sortiert und ohne Dubletten', () => {
    const s = falte([
      { ts: 'T1', autor: 'SCH', punktId: 'code-38', urteil: 'passt' },
      { ts: 'T2', autor: 'MUE', punktId: 'code-38', kommentar: 'Hinweis' },
      { ts: 'T3', autor: 'SCH', punktId: 'code-38', kommentar: 'noch was' },
    ]);
    expect(autorenVon(s)).toEqual(['MUE', 'SCH']);
  });
});

describe('istAntwortfaehig (ein Kürzel muss eine Person meinen)', () => {
  it('ein leeres oder fehlendes Kürzel darf nicht antworten', () => {
    expect(istAntwortfaehig(undefined)).toBe(false);
    expect(istAntwortfaehig('   ')).toBe(false);
  });

  it('das Sammel-Kürzel „alle" darf nicht antworten', () => {
    expect(istAntwortfaehig('alle')).toBe(false);
    expect(istAntwortfaehig('Alle')).toBe(false);
  });

  it('ein Vertretungs-Kürzel mit Komma darf nicht antworten', () => {
    expect(istAntwortfaehig('MUE,SCH')).toBe(false);
  });

  it('ein normales Kürzel darf antworten', () => {
    expect(istAntwortfaehig('MUE')).toBe(true);
    expect(istAntwortfaehig('THÜ')).toBe(true);
  });
});
