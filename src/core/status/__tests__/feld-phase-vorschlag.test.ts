/**
 * Die Auswahlregeln des Phasenvorschlags. Fünf Zusagen:
 *
 * 1. **Keine Mehrheitsentscheidung.** Verschiedene Phasen über die Richtlinien
 *    hinweg ergeben KEINEN Vorschlag, sondern einen benannten Fall.
 * 2. **TV vor VB — aber sichtbar.** Der TV-Status gewinnt; ein abweichender
 *    VB-Status verdrängt den Vorschlag nicht, steht aber im Beleg.
 * 3. **Kein Vorschlag ist eine Antwort.** Marker, unbekannter Zielcode und
 *    „setzt gar keinen Status" sind drei verschiedene Gründe, nicht einer.
 * 4. **Trigger schlägt Auslieferung, aber nicht stillschweigend.** Wo sich beide
 *    widersprechen, fällt der Vorschlag aus BEIDEN Quellen weg.
 * 5. **Nichts stillschweigend.** Ein gepflegter Wert steht als `alt` daneben.
 *
 * Die Sätze werden wörtlich geprüft: die Testumgebung ist node-only, ein
 * Screenshot der Vorschau ist nicht möglich — und der Konflikt-Fall tritt am
 * echten Trigger-Stand gar nicht auf (0 von 505). Ohne diesen Test liefe der
 * Code erstmals an dem Tag, an dem er gebraucht wird.
 */
import { describe, it, expect } from 'vitest';
import { berechnePhasenVorschlag, type PhasenSchnitt } from '@/core/status/feld-phase-vorschlag';
import { setzeFeldPhasen } from '@/core/status/katalog-edit';
import { SEED_CODE_ZU_ZAH_PHASE, SEED_MARKER_CODES } from '@/core/status/zah-phasen';
import type {
  MappingVersion, StatusFeldEintrag, TriggerParam, TriggerZeile, ZahPhaseId,
} from '@/core/status/typen';

const SCHNITT: PhasenSchnitt = {
  codeZuPhase: SEED_CODE_ZU_ZAH_PHASE,
  markerCodes: SEED_MARKER_CODES,
};

const feld = (code: string, p: Partial<StatusFeldEintrag> = {}): StatusFeldEintrag => ({
  feldId: `D_${code}`, label: `Datum ${code}`, typ: 'datum', ebene: 'tv',
  code, prominenzDefault: 'normal', aktiv: true, unkuratiert: false, ...p,
});

/** Eine Trigger-Zeile; `satz` spielt hier keine Rolle (wir bauen eigene Sätze). */
const zeile = (
  programm: string, kuerzel: string, geparst: TriggerParam | null, folge = 1,
): TriggerZeile => ({
  programm, kuerzel, folge, prozedur: 'TRG_TVs_Status_TV_VB',
  parameterRoh: '', geparst, satz: '',
});

const tvVb = (statusTv: number | null, statusVb: number | null): TriggerParam => ({
  art: 'statusTvVb', status: null, ohneTvKuerzel: [], ohneVerbundKuerzel: [],
  weitere: [], statusTv, statusVb,
});

const rechne = (
  felder: readonly StatusFeldEintrag[],
  trigger: readonly TriggerZeile[],
  seedFelder: readonly StatusFeldEintrag[] = [],
) => berechnePhasenVorschlag(felder, trigger, seedFelder, SCHNITT);

describe('berechnePhasenVorschlag — Trigger-Zweig', () => {
  it('fasst gleiche Phasen über zwei Richtlinien zu EINEM Vorschlag zusammen', () => {
    const a = rechne([feld('AAE')], [
      zeile('76', 'AAE', tvVb(31, 31)),
      zeile('131', 'AAE', tvVb(11, null)),
    ]);
    expect(a.vorschlaege).toHaveLength(1);
    expect(a.vorschlaege[0]).toMatchObject({
      feldId: 'D_AAE', code: 'AAE', phase: 'eingang', herkunft: 'trigger', alt: undefined,
    });
    // Zwei verschiedene Zielstatus = zwei Regeln = zwei Belege.
    expect(a.vorschlaege[0]!.belege.map(b => b.satz)).toEqual([
      'setzt in Richtlinie 76 den TV-Status 31 (beantragt) → Eingang',
      'setzt in Richtlinie 131 den TV-Status 11 (Skizze eingegangen) → Eingang',
    ]);
    expect(a.uneinheitlich).toEqual([]);
  });

  it('faltet dieselbe Regel über viele Richtlinien zu EINEM Beleg', () => {
    // Am echten Stand steht AAE mit demselben Zielstatus in neun Richtlinien,
    // teils zweimal je Richtlinie — Zeile für Zeile wären das 17 gleichlautende
    // Sätze in der Vorschau.
    const a = rechne([feld('AAE')], [
      zeile('76', 'AAE', tvVb(31, 31)),
      zeile('76', 'AAE', tvVb(31, null), 2),
      zeile('131', 'AAE', tvVb(31, null)),
      zeile('77', 'AAE', tvVb(31, null)),
    ]);
    expect(a.vorschlaege[0]!.belege).toHaveLength(1);
    expect(a.vorschlaege[0]!.belege[0]!.programme).toEqual(['76', '77', '131']);
    expect(a.vorschlaege[0]!.belege[0]!.satz).toBe(
      'setzt in Richtlinie 76, 77, 131 den TV-Status 31 (beantragt) → Eingang',
    );
  });

  it('gibt bei zwei Phasen KEINEN Vorschlag und benennt den Fall mit den Richtlinien', () => {
    const a = rechne([feld('AAE')], [
      zeile('76', 'AAE', tvVb(31, null)),
      zeile('77', 'AAE', tvVb(31, null)),
      zeile('131', 'AAE', tvVb(40, null)),
    ]);
    expect(a.vorschlaege).toEqual([]);
    expect(a.uneinheitlich).toHaveLength(1);
    expect(a.uneinheitlich[0]!.phasen).toEqual([
      { phase: 'eingang', programme: ['76', '77'] },
      { phase: 'pruefung', programme: ['131'] },
    ]);
    expect(a.uneinheitlich[0]!.satz).toBe(
      'AAE setzt Eingang (Richtlinie 76, 77) und Prüfung (Richtlinie 131)'
      + ' — kein Vorschlag, solange das offen ist.',
    );
  });

  it('gibt dem TV-Status den Vorrang, wenn beide gesetzt sind', () => {
    const a = rechne([feld('AB')], [zeile('76', 'AB', tvVb(51, 51))]);
    expect(a.vorschlaege[0]).toMatchObject({ phase: 'entscheidung' });
    expect(a.vorschlaege[0]!.belege[0]).toMatchObject({ quelle: 'tv', status: 51 });
    expect(a.vorschlaege[0]!.belege[0]!.abweichenderVbStatus).toBeUndefined();
  });

  it('behält den Vorschlag bei abweichendem VB-Status, nennt ihn aber im Beleg', () => {
    const a = rechne([feld('AB')], [zeile('131', 'AB', tvVb(40, 59))]);
    expect(a.vorschlaege[0]).toMatchObject({ phase: 'pruefung' });
    expect(a.vorschlaege[0]!.belege[0]!.abweichenderVbStatus).toBe(59);
    expect(a.vorschlaege[0]!.belege[0]!.satz).toBe(
      'setzt in Richtlinie 131 den TV-Status 40 (Gutachten fertig) → Prüfung,'
      + ' VB-Status abweichend 59 (bewilligt)',
    );
  });

  it('zieht den VB-Status heran, wenn die Zeile nur ihn setzt', () => {
    const a = rechne([feld('XVE')], [zeile('78', 'XVE', tvVb(null, 99))]);
    expect(a.vorschlaege[0]).toMatchObject({ phase: 'abgeschlossen' });
    expect(a.vorschlaege[0]!.belege[0]).toMatchObject({ quelle: 'vb', status: 99 });
    expect(a.vorschlaege[0]!.belege[0]!.satz).toBe(
      'setzt in Richtlinie 78 den VB-Status 99 (Schlussvermerk) → Abgeschlossen',
    );
  });

  it('liest auch die zweite statussetzende Prozedur (TRG.Status.TV.VB)', () => {
    const a = rechne([feld('ABA')], [
      zeile('78', 'ABA', { art: 'statusSetzen', ebene: '211', status: 73 }),
    ]);
    expect(a.vorschlaege[0]).toMatchObject({ phase: 'abgeschlossen' });
    expect(a.vorschlaege[0]!.belege[0]!.satz).toBe(
      'setzt in Richtlinie 78 den TV-Status 73 (abgelehnt/zurückgezogen) → Abgeschlossen',
    );
  });
});

describe('berechnePhasenVorschlag — wann es keinen Vorschlag gibt', () => {
  it('nennt Marker-Codes als eigenen Grund, nicht als Mangel', () => {
    for (const marker of [29, 88, 93, 94]) {
      const a = rechne([feld('YM')], [zeile('76', 'YM', tvVb(marker, null))]);
      expect(a.vorschlaege, String(marker)).toEqual([]);
      expect(a.ohneVorschlag, String(marker)).toEqual([
        { code: 'YM', bezeichnung: 'Datum YM', grund: 'nurMarker' },
      ]);
    }
  });

  it('unterscheidet einen unbekannten Zielcode von „setzt keinen Status"', () => {
    // 74 kommt am echten Stand vor, steht aber weder im Phasen-Schnitt noch
    // unter den Markern — das ist eine Lücke im Katalog, kein fehlender Trigger.
    const a = rechne([feld('ABA')], [zeile('78', 'ABA', { art: 'statusSetzen', ebene: '211', status: 74 })]);
    expect(a.ohneVorschlag).toEqual([
      { code: 'ABA', bezeichnung: 'Datum ABA', grund: 'unbekannterZielcode' },
    ]);
  });

  it('führt Mail-/Eintrags-Prozeduren und nicht interpretierte Zeilen als „kein Status-Trigger"', () => {
    const a = rechne([feld('ID'), feld('XY')], [
      zeile('78', 'ID', { art: 'vorgEintragMail', empfaenger: 'BIB', textbaustein: '!.055.VorgInfo.01', cc: null }),
      zeile('78', 'ID', { art: 'vorgEintragNeu', code: 'XID', ebene: '210', tage: 0 }, 2),
      zeile('78', 'XY', null),
    ]);
    expect(a.vorschlaege).toEqual([]);
    expect(a.ohneVorschlag.map(o => o.grund)).toEqual(['keinStatusTrigger', 'keinStatusTrigger']);
  });

  it('meldet ein Kürzel ohne jede Trigger-Zeile getrennt', () => {
    const a = rechne([feld('ZZZ')], []);
    expect(a.ohneVorschlag).toEqual([
      { code: 'ZZZ', bezeichnung: 'Datum ZZZ', grund: 'keinTrigger' },
    ]);
  });

  it('lässt Zeilen ohne Richtlinie außen vor', () => {
    const a = rechne([feld('AAE')], [zeile('', 'AAE', tvVb(31, null))]);
    expect(a.vorschlaege).toEqual([]);
    expect(a.ohneVorschlag[0]!.grund).toBe('keinTrigger');
  });

  it('schweigt, wenn die Fassung die Phase schon so führt', () => {
    const a = rechne([feld('AAE', { zahPhaseId: 'eingang' })], [zeile('76', 'AAE', tvVb(31, null))]);
    expect(a.vorschlaege).toEqual([]);
    expect(a.ohneVorschlag).toEqual([]);
  });

  it('führt einen abweichenden gepflegten Wert als alt mit, statt ihn zu verschlucken', () => {
    const a = rechne([feld('AAE', { zahPhaseId: 'begleitung' })], [zeile('76', 'AAE', tvVb(31, null))]);
    expect(a.vorschlaege[0]).toMatchObject({ alt: 'begleitung', phase: 'eingang' });
    // `null` (bewusst ohne Phase) bleibt von `undefined` (nie entschieden) unterscheidbar.
    const b = rechne([feld('AAE', { zahPhaseId: null })], [zeile('76', 'AAE', tvVb(31, null))]);
    expect(b.vorschlaege[0]!.alt).toBeNull();
  });
});

describe('berechnePhasenVorschlag — Auslieferung als zweite Quelle', () => {
  const felder = [feld('XTEC'), feld('AAE')];

  it('bietet eine Seed-Phase nur an, wo die Trigger-Tabelle nichts sagt', () => {
    const a = rechne(felder, [zeile('76', 'AAE', tvVb(31, null))], [
      feld('XTEC', { zahPhaseId: 'vollstaendigkeit' }),
    ]);
    expect(a.vorschlaege.map(v => [v.code, v.herkunft, v.phase])).toEqual([
      ['AAE', 'trigger', 'eingang'],
      ['XTEC', 'seed', 'vollstaendigkeit'],
    ]);
    expect(a.vorschlaege[1]!.belege[0]!.satz).toBe('steht in der Auslieferung als Vollständigkeit');
    expect(a.quellenAbweichungen).toEqual([]);
  });

  it('erzeugt keinen zweiten Eintrag, wenn beide Quellen dasselbe sagen', () => {
    const a = rechne(felder, [zeile('76', 'AAE', tvVb(31, null))], [
      feld('AAE', { zahPhaseId: 'eingang' }),
    ]);
    expect(a.vorschlaege).toHaveLength(1);
    expect(a.vorschlaege[0]!.herkunft).toBe('trigger');
  });

  it('nimmt bei Widerspruch den Trigger-Vorschlag ZURÜCK und benennt die Abweichung', () => {
    const a = rechne(felder, [zeile('76', 'AAE', tvVb(31, null))], [
      feld('AAE', { zahPhaseId: 'entscheidung' }),
    ]);
    expect(a.vorschlaege, 'kein Vorschlag aus beiden Quellen').toEqual([]);
    expect(a.quellenAbweichungen).toHaveLength(1);
    expect(a.quellenAbweichungen[0]).toMatchObject({
      code: 'AAE', seedPhase: 'entscheidung', triggerPhase: 'eingang',
    });
    expect(a.quellenAbweichungen[0]!.satz).toBe(
      'AAE: Auslieferung sagt Entscheidung, Trigger-Tabelle sagt Eingang'
      + ' — kein Vorschlag aus beiden Quellen.',
    );
  });

  it('rührt Felder nicht an, die die Fassung schon entschieden hat', () => {
    const a = rechne([feld('XTEC', { zahPhaseId: 'pruefung' })], [], [
      feld('XTEC', { zahPhaseId: 'vollstaendigkeit' }),
    ]);
    expect(a.vorschlaege).toEqual([]);
    expect(a.quellenAbweichungen).toEqual([]);
  });

  it('überspringt Seed-Felder, die die Fassung gar nicht führt — das ist Sache des Nachziehens', () => {
    const a = rechne([], [], [feld('NEU', { zahPhaseId: 'eingang' })]);
    expect(a.vorschlaege).toEqual([]);
  });
});

describe('berechnePhasenVorschlag — Kennzahlen für die Kopfzeile', () => {
  it('zählt Kürzel, statussetzende Kürzel und kuratierte Seed-Phasen getrennt', () => {
    const a = rechne(
      [feld('AAE'), feld('ID'), feld('ZZZ'), { ...feld('X'), code: undefined }],
      [
        zeile('76', 'AAE', tvVb(31, null)),
        zeile('78', 'ID', { art: 'vorgEintragMail', empfaenger: 'BIB', textbaustein: 'x', cc: null }),
      ],
      [feld('AAE', { zahPhaseId: 'eingang' }), feld('XTEC', { zahPhaseId: 'vollstaendigkeit' })],
    );
    expect(a.kennzahlen).toEqual({ mitCode: 3, mitStatusTrigger: 1, seedPhasen: 2 });
  });
});

describe('setzeFeldPhasen', () => {
  const version = {
    version: 1, autor: null, zeitstempel: 'x',
    felder: [feld('AAE'), feld('AB', { zahPhaseId: 'begleitung' }), feld('XKS')],
    werte: [],
  } as unknown as MappingVersion;

  it('setzt alle genannten Felder in EINEM Durchlauf', () => {
    const nachher = setzeFeldPhasen(version, new Map<string, ZahPhaseId>([
      ['D_AAE', 'eingang'], ['D_AB', 'entscheidung'],
    ]));
    expect(nachher.felder.find(f => f.feldId === 'D_AAE')?.zahPhaseId).toBe('eingang');
    expect(nachher.felder.find(f => f.feldId === 'D_AB')?.zahPhaseId).toBe('entscheidung');
  });

  it('rührt nicht an, was die Map nicht nennt', () => {
    const nachher = setzeFeldPhasen(version, new Map<string, ZahPhaseId>([['D_AAE', 'eingang']]));
    expect(nachher.felder.find(f => f.feldId === 'D_AB')?.zahPhaseId).toBe('begleitung');
    expect(nachher.felder.find(f => f.feldId === 'D_XKS')?.zahPhaseId).toBeUndefined();
  });

  it('gibt bei leerer Map dieselbe Referenz zurück', () => {
    expect(setzeFeldPhasen(version, new Map())).toBe(version);
  });
});
