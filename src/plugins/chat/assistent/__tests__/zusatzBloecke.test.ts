/**
 * Die zuschaltbaren Blöcke. Beide müssen sagen, worauf sie beruhen: der Verlauf
 * „rekonstruiert", das Journal seinen Nullpunkt — sonst liest sich eine Näherung
 * als Beobachtung und eine lückenhafte Chronik als vollständige.
 */
import { describe, expect, it } from 'vitest';
import {
  journalBlock, relevanteSpuren, verlaufBlock, zaehleAbschnitte, JOURNAL_MAX_EINTRAEGE,
} from '../zusatzBloecke';
import type { VorgangsAkte } from '@/core/services/assistent/kontext';
import type { VerlaufsSpur } from '@/core/status/verlauf/typen';
import type { AntragsChronikMitId } from '@/core/status/journal/lesen';
import type { JournalEintrag } from '@/core/status/journal/typen';
import type { MappingVersion, StatusFeldEintrag } from '@/core/status/typen';

function spur(over: Partial<VerlaufsSpur>): VerlaufsSpur {
  return {
    art: 'tv', id: 'AZ-1', zustand: 'verlauf', herkunft: 'abgeleitet',
    segmente: [], uebergaenge: [], journalAb: null,
    ...over,
  } as unknown as VerlaufsSpur;
}

const segment = (lang: string, von: string, bis: string, dauerTage: number) => ({
  statusRef: { roh: lang, code: 1, lang }, vonDatum: von, bisDatum: bis, dauerTage, dauerUnsicher: false,
});

const akte = (termine: number): VorgangsAkte => ({
  fuer: 'VB-1', aufgaben: [], offenePaare: [],
  teilvorhaben: [{ aktenzeichen: 'AZ-1', titel: 'A' }],
  verlauf: {
    von: '01.01.2026', bis: '31.07.2026', schritte: termine, datumsangaben: termine, nichtGesetzt: 0,
    termine: Array.from({ length: termine }, (_, i) => ({ tag: '01.02.2026', label: `T${i}`, rollen: 'AB', traeger: 'AZ-1' })),
  },
});

describe('relevanteSpuren / zaehleAbschnitte', () => {
  it('nimmt die Verbundspur nur beim Verbund und nur die eigenen Teilvorhaben', () => {
    const spuren = [spur({ art: 'verbund', id: 'VB-1' }), spur({ id: 'AZ-1' }), spur({ id: 'AZ-9' })];
    expect(relevanteSpuren(spuren, true, new Set(['AZ-1'])).map(s => s.id)).toEqual(['VB-1', 'AZ-1']);
    expect(relevanteSpuren(spuren, false, new Set(['AZ-1'])).map(s => s.id)).toEqual(['AZ-1']);
  });

  it('zählt nur Abschnitte mit Status aus Spuren mit Verlauf', () => {
    const mit = spur({ segmente: [segment('A', '2026-01-01', '2026-02-01', 31)] as never });
    const ohneStatus = spur({ segmente: [{ ...segment('B', '2026-02-01', '2026-03-01', 28), statusRef: null }] as never });
    const keinVerlauf = spur({ zustand: 'nicht_beobachtet', segmente: [segment('C', '2026-01-01', '2026-02-01', 31)] as never });
    expect(zaehleAbschnitte([mit, ohneStatus, keinVerlauf])).toBe(1);
  });
});

describe('verlaufBlock', () => {
  it('sagt „rekonstruiert", führt ALLE Termine und die Abschnitte je Spur', () => {
    const b = verlaufBlock({
      istVerbund: true,
      akte: akte(45),
      spuren: [
        spur({ segmente: [segment('In Prüfung', '2026-07-01', '2026-08-01', 31)] as never }),
        spur({ art: 'verbund', id: 'VB-1', zustand: 'nicht_beobachtet', begruendung: 'Kein Übergang erklärt den Verbundstatus.' }),
      ],
      fassung: 7,
    });
    const text = b?.zeilen.join('\n') ?? '';
    expect(b?.titel).toBe('Verlauf seit Eingang');
    expect(text).toContain('Rekonstruiert aus den Datumsspalten');
    expect(text).toContain('Katalogfassung 7');
    expect(text).toContain('Alle Termine (45):'); // nicht auf die 30 der Akte gekappt
    expect(text).toContain('Teilvorhaben AZ-1:');
    expect(text).toContain('- 01.07.2026 bis 01.08.2026: In Prüfung (31 Tage)');
    expect(text).toContain('Kein Übergang erklärt den Verbundstatus.');
  });

  it('ohne Termine und ohne Spuren gibt es keinen Block', () => {
    expect(verlaufBlock({ istVerbund: true, akte: akte(0), spuren: null, fassung: null })).toBeNull();
  });
});

const D_ART: StatusFeldEintrag = {
  feldId: 'D_ART', label: 'Rücknahmeempfehlung techn.', typ: 'datum', ebene: 'tv', code: 'ART',
  prominenzDefault: 'normal', aktiv: true, unkuratiert: false,
};
const fassung = { version: 1, autor: null, zeitstempel: '', kategorien: [], felder: [D_ART], werte: [] } as MappingVersion;

function eintrag(over: Partial<JournalEintrag>): JournalEintrag {
  return { stempel: 's', antragId: 'AZ-1', art: 'gesetzt', feld: 'D_ART', datum: '2026-08-10', ...over } as JournalEintrag;
}

function chronik(antragId: string, eintraege: JournalEintrag[], gefuehrt = true): AntragsChronikMitId {
  return { antragId, journalAb: '2026-08-05', gefuehrt, letzteAenderung: null, felder: [{ feld: 'D_ART', eintraege }] };
}

describe('journalBlock', () => {
  it('ohne Journal: nur der Satz, dass keins geführt wird', () => {
    const b = journalBlock({ chroniken: null, azs: new Set(['AZ-1']), version: fassung, aktuell: [], vbPhase: undefined });
    expect(b.zeilen).toHaveLength(1);
    expect(b.zeilen[0]).toContain('kein Änderungs-Journal');
  });

  it('nennt den Nullpunkt, die eigenen Änderungen neueste zuerst und das Zurückgenommene', () => {
    const b = journalBlock({
      chroniken: [
        chronik('AZ-1', [
          eintrag({ art: 'gesetzt', nach: 20260803, datum: '2026-08-06' }),
          eintrag({ art: 'geleert', von: 20260803, datum: '2026-08-12' }),
        ]),
        chronik('AZ-9', [eintrag({ antragId: 'AZ-9', datum: '2026-08-20' })]),
      ],
      azs: new Set(['AZ-1']), version: fassung, aktuell: [], vbPhase: undefined,
    });
    const text = b.zeilen.join('\n');
    expect(b.zeilen[0]).toContain('ab 05.08.2026 belegt');
    expect(text).not.toContain('AZ-9');
    expect(text.indexOf('zurückgenommen am 12.08.2026')).toBeLessThan(text.indexOf('gesetzt am 06.08.2026'));
    expect(text).toContain('Zurückgenommene oder verschobene Termine');
    expect(text).toContain('03.08.2026 ART Rücknahmeempfehlung techn.: zurückgenommen');
  });

  it(`kappt auf die ${JOURNAL_MAX_EINTRAEGE} neuesten Einträge und sagt es`, () => {
    const viele = Array.from({ length: JOURNAL_MAX_EINTRAEGE + 3 }, (_, i) =>
      eintrag({ datum: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`, nach: 20260801 }));
    const b = journalBlock({
      chroniken: [chronik('AZ-1', viele)], azs: new Set(['AZ-1']), version: null, aktuell: [], vbPhase: undefined,
    });
    expect(b.zeilen.join('\n')).toContain(`die ${JOURNAL_MAX_EINTRAEGE} neuesten von ${JOURNAL_MAX_EINTRAEGE + 3}`);
  });
});
