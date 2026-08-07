/**
 * Der geteilte Bedingungs-Auswerter. Festgehalten wird vor allem, was er NICHT
 * tun darf:
 *
 * - eine nicht auswertbare Bedingung als `verletzt` oder `erfuellt` ausgeben
 * - eine Komma-Liste als ein Kürzel behandeln
 * - ein ungedeutetes Argument der Positionen 3–5 verschweigen
 * - TV- und Verbund-Menge in einen Topf werfen (das braucht der Verlauf getrennt,
 *   der Navigator reicht dieselbe Menge zweimal ein)
 * - in der Rückschau in der Gegenwartsform sprechen
 */
import { describe, it, expect } from 'vitest';
import { parseTriggerZeile } from '@/core/status/trigger-parser';
import { kuerzelIndex } from '@/core/status/feld-zugriff';
import { normKey } from '@/core/status/normalisierung';
import {
  pruefeTriggerBedingungen, schlechtestes, type TriggerKontext,
} from '@/core/status/trigger-bedingung';
import type { StatusFeldEintrag, TriggerParam } from '@/core/status/typen';

const feld = (code: string): StatusFeldEintrag => ({
  feldId: `D_${code}`,
  label: `Bezeichnung ${code}`,
  typ: 'datum',
  ebene: code.startsWith('X') ? 'verbund' : 'tv',
  herkunft: 'tv-record',
  code,
  kategorieId: 'tv.antragsbearbeitung',
  rollen: [],
  prominenzDefault: 'normal',
  aktiv: true,
  unkuratiert: false,
});

const KATALOG = kuerzelIndex(['AAE', 'ABB', 'AB', 'AK4', 'YIRR', 'XKS'].map(feld));

const param = (parameter: string): TriggerParam => {
  const g = parseTriggerZeile({
    programm: '76', kuerzel: 'AAE', folge: 1, prozedur: 'TRG_TVs_Status_TV_VB', parameter,
  }).geparst;
  if (!g) throw new Error(`Fixture nicht geparst: ${parameter}`);
  return g;
};

const ktx = (over: Partial<TriggerKontext> = {}): TriggerKontext => ({
  felderNachCode: KATALOG,
  gesetztTv: new Set(),
  gesetztVerbund: new Set(),
  statusCode: 31,
  ...over,
});

const menge = (...codes: string[]): ReadonlySet<string> => new Set(codes.map(normKey));

describe('pruefeTriggerBedingungen — Status-Vergleich', () => {
  it('erfüllt, wenn der Status vor der Grenze liegt', () => {
    expect(pruefeTriggerBedingungen(param('<59|||||||31'), ktx({ statusCode: 31 })))
      .toEqual({ urteil: 'erfuellt', gruende: [] });
  });

  it('verletzt, wenn er es nicht tut — mit Grund', () => {
    const b = pruefeTriggerBedingungen(param('<59|||||||31'), ktx({ statusCode: 73 }));
    expect(b.urteil).toBe('verletzt');
    expect(b.gruende).toEqual(['Status 73 ist nicht vor 59.']);
  });

  it('unprüfbar statt verletzt, wenn der Status unbekannt ist', () => {
    // Der Fall am Anfang einer Verlaufskette: vor dem ersten Beleg weiss niemand,
    // worauf der Vorgang stand. `false` wäre hier eine Behauptung.
    const b = pruefeTriggerBedingungen(param('<59|||||||31'), ktx({ statusCode: null }));
    expect(b.urteil).toBe('unpruefbar');
    expect(b.gruende[0]).toContain('nicht prüfbar');
  });

  it('nennt in der Rückschau den RICHTIGEN Grund für den fehlenden Status', () => {
    // Vorwärts heisst „kein Status" = der Katalog kennt den aktuellen Wert nicht;
    // rückwärts heisst es „vor dem ersten Beleg gibt es noch keinen". Wer den
    // Katalog-Satz am Kettenanfang liest, sucht an der falschen Stelle.
    const vorwaerts = pruefeTriggerBedingungen(param('<59|||||||31'), ktx({ statusCode: null }));
    const rueckwaerts = pruefeTriggerBedingungen(
      param('<59|||||||31'), ktx({ statusCode: null, zeitpunkt: '2024-03-12' }),
    );
    expect(vorwaerts.gruende[0]).toContain('steht nicht im Katalog');
    expect(rueckwaerts.gruende[0]).toContain('Vor diesem Termin ist kein Statuswechsel belegt');
  });

  it('kennt auch > und =', () => {
    expect(pruefeTriggerBedingungen(param('>59|||||||31'), ktx({ statusCode: 73 })).urteil).toBe('erfuellt');
    expect(pruefeTriggerBedingungen(param('=59|||||||31'), ktx({ statusCode: 59 })).urteil).toBe('erfuellt');
    expect(pruefeTriggerBedingungen(param('=59|||||||31'), ktx({ statusCode: 60 })).urteil).toBe('verletzt');
  });
});

describe('pruefeTriggerBedingungen — Negativ-Listen', () => {
  it('eine Komma-Liste ist eine UND-Liste aus EIGENEN Bedingungen', () => {
    // ABB gesetzt, AK4 nicht: verletzt — aber nur wegen ABB, und das steht da.
    const b = pruefeTriggerBedingungen(
      param('<59|ABB,AB,AK4|||||31|31'), ktx({ gesetztTv: menge('ABB') }),
    );
    expect(b.urteil).toBe('verletzt');
    expect(b.gruende).toEqual(['ABB ist bereits gesetzt.']);
  });

  it('ein katalogfremdes Kürzel macht nur SEINEN Teil unprüfbar', () => {
    const b = pruefeTriggerBedingungen(param('<59|ABB,WEGWEG|||||31|31'), ktx());
    expect(b.urteil).toBe('unpruefbar');
    expect(b.gruende).toHaveLength(1);
    expect(b.gruende[0]).toContain('WEGWEG');
  });

  it('verletzt schlägt unprüfbar — auch wenn das Unprüfbare zuerst kommt', () => {
    const b = pruefeTriggerBedingungen(
      param('<59|WEGWEG,ABB|||||31|31'), ktx({ gesetztTv: menge('ABB') }),
    );
    expect(b.urteil).toBe('verletzt');
    expect(b.gruende).toHaveLength(2);
  });
});

describe('pruefeTriggerBedingungen — TV und Verbund sind zwei Mengen', () => {
  const p = param('<59|ABB|YIRR||||31|31');

  it('„ohne TV-Kürzel" liest die TV-Menge, „ohne Verbund-Kürzel" die Verbund-Menge', () => {
    // ABB nur im Verbund gesetzt ⇒ die TV-Bedingung ist erfüllt.
    expect(pruefeTriggerBedingungen(p, ktx({ gesetztVerbund: menge('ABB') })).urteil).toBe('erfuellt');
    // YIRR nur am TV gesetzt ⇒ die Verbund-Bedingung ist erfüllt.
    expect(pruefeTriggerBedingungen(p, ktx({ gesetztTv: menge('YIRR') })).urteil).toBe('erfuellt');
  });

  it('greift, wenn das Kürzel in der jeweils richtigen Menge steht', () => {
    const b = pruefeTriggerBedingungen(p, ktx({ gesetztVerbund: menge('YIRR') }));
    expect(b.urteil).toBe('verletzt');
    expect(b.gruende).toEqual(['YIRR ist im Verbund bereits gesetzt.']);
  });
});

describe('pruefeTriggerBedingungen — ungedeutete Argumente', () => {
  it('Positionen 3–5 sind immer unprüfbar und nennen sich beim Namen', () => {
    const b = pruefeTriggerBedingungen(param('<59|||WASAUCHIMMER|||31|31'), ktx());
    expect(b.urteil).toBe('unpruefbar');
    expect(b.gruende).toEqual(['Weiteres Argument „WASAUCHIMMER" ist nicht gedeutet.']);
  });

  it('unbedingte Prozeduren tragen keine Bedingung', () => {
    const g = parseTriggerZeile({
      programm: '76', kuerzel: 'ABA', folge: 1, prozedur: 'TRG.Status.TV.VB', parameter: '211|74',
    }).geparst;
    expect(g).not.toBeNull();
    expect(pruefeTriggerBedingungen(g!, ktx())).toEqual({ urteil: 'erfuellt', gruende: [] });
  });
});

describe('pruefeTriggerBedingungen — Zeitform', () => {
  it('spricht in der Rückschau von damals, nicht von heute', () => {
    const b = pruefeTriggerBedingungen(
      param('<59|ABB|||||31|31'), ktx({ gesetztTv: menge('ABB'), zeitpunkt: '2024-03-12' }),
    );
    expect(b.gruende).toEqual(['ABB war am 2024-03-12 bereits gesetzt.']);
  });
});

describe('schlechtestes', () => {
  it('verletzt > unprüfbar > erfüllt, leer heisst erfüllt', () => {
    expect(schlechtestes(['erfuellt', 'unpruefbar', 'verletzt'])).toBe('verletzt');
    expect(schlechtestes(['erfuellt', 'unpruefbar'])).toBe('unpruefbar');
    expect(schlechtestes(['erfuellt'])).toBe('erfuellt');
    expect(schlechtestes([])).toBe('erfuellt');
  });
});
