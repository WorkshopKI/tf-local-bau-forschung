/**
 * Tests fuer uebernahme-einsammeln.ts (v2.9 — PL sammelt Übernahme-Wünsche ein).
 *
 *  - mergeWuenscheIntoZuweisungen: Upsert als selbst-Zuweisung, Dedup, mehrere
 *    Interessenten, PL-/Matching-Entscheidungen unangetastet, Retraktion nur
 *    fuer im Batch vorkommende anonIds, NFC + Mehrfach-Kuerzel, unbekanntes Kuerzel.
 *  - Zuweisbarkeit: ein Wunsch auf einen Antrag, den die Zuweisungs-Liste nicht
 *    fuehrt, wird NICHT angelegt (sonst unsichtbarer Record + Phantom-Stunden).
 *  - collectUebernahmeWuensche: iteriert User-Ordner gegen Mock-Dir-Handles.
 */
import { describe, it, expect } from 'vitest';
import {
  buildZuweisbarkeitsPruefung,
  collectUebernahmeWuensche,
  mergeWuenscheIntoZuweisungen,
} from '../services/onboarding';
import type { AnonymMap } from '../services/identitaet';
import type { AntragOderSlim } from '@/core/services/csv/types';
import type {
  PersoenlicheUebernahmeWuensche,
  UebernahmeWunsch,
  Zuweisung,
} from '../types';

function anonMap(pairs: Array<[string, string]>): AnonymMap {
  const toAnon = new Map<string, string>();
  const toReal = new Map<string, string>();
  for (const [kuerzel, anon] of pairs) {
    toAnon.set(kuerzel, anon);
    toReal.set(anon, kuerzel);
  }
  return { toAnon, toReal };
}

function wunsch(
  antragId: string,
  anzahlTV = 1,
  quartal = '2026-Q2',
  createdAt = '2026-05-29T00:00:00.000Z',
): UebernahmeWunsch {
  return { antragId, quartal, anzahlTV, createdAt };
}

function batchOf(
  kuerzel: string,
  wuensche: UebernahmeWunsch[],
): PersoenlicheUebernahmeWuensche {
  return { version: 1, kuerzel, wuensche, updatedAt: '2026-05-29T00:00:00.000Z' };
}

const Q = '2026-Q2';
const STUNDEN_PRO_TV = 9;

describe('mergeWuenscheIntoZuweisungen', () => {
  it('legt neue selbst-Zuweisung an (stunden = anzahlTV × stundenProTV)', () => {
    const { next, neu, entfernt } = mergeWuenscheIntoZuweisungen(
      [],
      [batchOf('mue', [wunsch('16EP260112', 4)])],
      anonMap([['MUE', 'MA01']]),
      Q,
      STUNDEN_PRO_TV,
    );
    expect(neu).toBe(1);
    expect(entfernt).toBe(0);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      antragId: '16EP260112',
      anonId: 'MA01',
      status: 'selbst',
      selbstEingetragen: true,
      anzahlTV: 4,
      stunden: 36,
      selbstEingetragenAm: '2026-05-29T00:00:00.000Z',
    });
  });

  it('uebernimmt den Klick-Zeitpunkt (createdAt) je Interessent — für „wer zuerst"', () => {
    const { next } = mergeWuenscheIntoZuweisungen(
      [],
      [
        batchOf('mue', [wunsch('A', 1, '2026-Q2', '2026-05-28T08:00:00.000Z')]),
        batchOf('sch', [wunsch('A', 1, '2026-Q2', '2026-05-29T09:30:00.000Z')]),
      ],
      anonMap([['MUE', 'MA01'], ['SCH', 'MA02']]),
      Q,
      STUNDEN_PRO_TV,
    );
    const ts = new Map(next.map(z => [z.anonId, z.selbstEingetragenAm]));
    expect(ts.get('MA01')).toBe('2026-05-28T08:00:00.000Z');
    expect(ts.get('MA02')).toBe('2026-05-29T09:30:00.000Z');
  });

  it('dedupt pro (antragId, anonId) — kein Doppel-Eintrag', () => {
    const existing: Zuweisung[] = [
      { antragId: 'A', anonId: 'MA01', quartal: Q, stunden: 9, anzahlTV: 1, status: 'selbst', selbstEingetragen: true },
    ];
    const { next, neu } = mergeWuenscheIntoZuweisungen(
      existing,
      [batchOf('mue', [wunsch('A', 2)])],
      anonMap([['MUE', 'MA01']]),
      Q,
      STUNDEN_PRO_TV,
    );
    expect(neu).toBe(0);
    expect(next.filter(z => z.antragId === 'A' && z.anonId === 'MA01')).toHaveLength(1);
    // aktualisierte anzahlTV/stunden uebernommen
    expect(next[0]).toMatchObject({ anzahlTV: 2, stunden: 18 });
  });

  it('mehrere Interessenten auf denselben Antrag bleiben erhalten', () => {
    const { next, neu } = mergeWuenscheIntoZuweisungen(
      [],
      [batchOf('mue', [wunsch('A')]), batchOf('sch', [wunsch('A')])],
      anonMap([['MUE', 'MA01'], ['SCH', 'MA02']]),
      Q,
      STUNDEN_PRO_TV,
    );
    expect(neu).toBe(2);
    const fuerA = next.filter(z => z.antragId === 'A');
    expect(new Set(fuerA.map(z => z.anonId))).toEqual(new Set(['MA01', 'MA02']));
  });

  it('laesst freigegeben/abgelehnt unangetastet und erzeugt keinen konkurrierenden selbst-Eintrag', () => {
    const existing: Zuweisung[] = [
      { antragId: 'A', anonId: 'MA01', quartal: Q, stunden: 18, anzahlTV: 2, status: 'freigegeben', freigegebenAm: '2026-05-01T00:00:00.000Z' },
      { antragId: 'B', anonId: 'MA02', quartal: Q, stunden: 0, status: 'abgelehnt' },
    ];
    const { next, neu, entfernt } = mergeWuenscheIntoZuweisungen(
      existing,
      [batchOf('mue', [wunsch('A')]), batchOf('sch', [wunsch('B')])],
      anonMap([['MUE', 'MA01'], ['SCH', 'MA02']]),
      Q,
      STUNDEN_PRO_TV,
    );
    expect(neu).toBe(0);
    expect(entfernt).toBe(0);
    // beide bestehenden Eintraege unveraendert, keine selbst-Duplikate
    expect(next).toHaveLength(2);
    expect(next.find(z => z.antragId === 'A')!.status).toBe('freigegeben');
    expect(next.find(z => z.antragId === 'B')!.status).toBe('abgelehnt');
  });

  it('Retraktion: zurueckgezogener Wunsch eines im Batch gelesenen MA wird entfernt', () => {
    const existing: Zuweisung[] = [
      { antragId: 'A', anonId: 'MA01', quartal: Q, stunden: 9, anzahlTV: 1, status: 'selbst', selbstEingetragen: true },
      { antragId: 'B', anonId: 'MA01', quartal: Q, stunden: 9, anzahlTV: 1, status: 'selbst', selbstEingetragen: true },
    ];
    // MA01 will jetzt nur noch A (B zurueckgezogen).
    const { next, neu, entfernt } = mergeWuenscheIntoZuweisungen(
      existing,
      [batchOf('mue', [wunsch('A')])],
      anonMap([['MUE', 'MA01']]),
      Q,
      STUNDEN_PRO_TV,
    );
    expect(neu).toBe(0);
    expect(entfernt).toBe(1);
    expect(next.map(z => z.antragId)).toEqual(['A']);
  });

  it('entfernt selbst-Eintraege NICHT fuer anonIds ohne Datei im Batch', () => {
    const existing: Zuweisung[] = [
      { antragId: 'A', anonId: 'MA02', quartal: Q, stunden: 9, anzahlTV: 1, status: 'selbst', selbstEingetragen: true },
    ];
    // Batch enthaelt nur MA01 → MA02 bleibt unangetastet.
    const { next, neu, entfernt } = mergeWuenscheIntoZuweisungen(
      existing,
      [batchOf('mue', [wunsch('C')])],
      anonMap([['MUE', 'MA01'], ['SCH', 'MA02']]),
      Q,
      STUNDEN_PRO_TV,
    );
    expect(entfernt).toBe(0);
    expect(neu).toBe(1);
    expect(next.find(z => z.anonId === 'MA02' && z.antragId === 'A')).toBeDefined();
  });

  it('matcht Umlaut- + Mehrfach-Kuerzel (NFC + Split, Pitfall #22)', () => {
    const nfcKey = 'THÜ'.normalize('NFC');
    const nfdKuerzel = 'TH' + 'Ü'; // NFD-Variante
    const { next, neu } = mergeWuenscheIntoZuweisungen(
      [],
      [batchOf(`${nfdKuerzel},SCH`, [wunsch('A')])],
      anonMap([[nfcKey, 'MA05']]),
      Q,
      STUNDEN_PRO_TV,
    );
    expect(neu).toBe(1);
    expect(next[0]!.anonId).toBe('MA05');
  });

  it('ignoriert unbekanntes Kuerzel (nicht in der Map)', () => {
    const { next, neu } = mergeWuenscheIntoZuweisungen(
      [],
      [batchOf('UNBEKANNT', [wunsch('A')])],
      anonMap([['MUE', 'MA01']]),
      Q,
      STUNDEN_PRO_TV,
    );
    expect(neu).toBe(0);
    expect(next).toHaveLength(0);
  });

  // ── Verbund-Sperre (eine Einheit, ein Bearbeiter) ────────────────────────
  // A1 + A2 gehoeren zum selben Verbund V1.
  const inV1 = (id: string): string => (id === 'A1' || id === 'A2' ? 'V1' : id);

  it('legt KEINEN selbst-Wunsch fuer einen bereits freigegebenen Verbund an (Fremd-TV)', () => {
    const existing: Zuweisung[] = [
      { antragId: 'A1', anonId: 'MA09', quartal: Q, stunden: 9, anzahlTV: 1, status: 'freigegeben', freigegebenAm: '2026-05-01T00:00:00.000Z' },
    ];
    // SCH (MA05) wuenscht A2 — anderes TV desselben Verbundes V1 → gesperrt.
    const { next, neu, entfernt } = mergeWuenscheIntoZuweisungen(
      existing,
      [batchOf('sch', [wunsch('A2')])],
      anonMap([['SCH', 'MA05']]),
      Q,
      STUNDEN_PRO_TV,
      inV1,
    );
    expect(neu).toBe(0);
    expect(entfernt).toBe(0);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ anonId: 'MA09', status: 'freigegeben' });
  });

  it('raeumt einen veralteten selbst-Eintrag fuer einen inzwischen freigegebenen Verbund auf (MA im Batch)', () => {
    const existing: Zuweisung[] = [
      { antragId: 'A1', anonId: 'MA09', quartal: Q, stunden: 9, anzahlTV: 1, status: 'freigegeben', freigegebenAm: '2026-05-01T00:00:00.000Z' },
      { antragId: 'A1', anonId: 'MA05', quartal: Q, stunden: 9, anzahlTV: 1, status: 'selbst', selbstEingetragen: true },
    ];
    // SCH (MA05) will A1 weiterhin, aber V1 ist an MA09 vergeben → Wunsch
    // gesperrt + alter selbst entfernt (Retraktion, da MA05 im Batch).
    const { next, neu, entfernt } = mergeWuenscheIntoZuweisungen(
      existing,
      [batchOf('sch', [wunsch('A1')])],
      anonMap([['SCH', 'MA05']]),
      Q,
      STUNDEN_PRO_TV,
      inV1,
    );
    expect(neu).toBe(0);
    expect(entfernt).toBe(1);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ anonId: 'MA09', status: 'freigegeben' });
  });

  it('zaehlt Wünsche fuer bereits vergebene Verbuende als „bereits vergeben" (erklaert die gelesene Zahl)', () => {
    const existing: Zuweisung[] = [
      { antragId: 'A1', anonId: 'MA09', quartal: Q, stunden: 9, anzahlTV: 1, status: 'freigegeben', freigegebenAm: '2026-05-01T00:00:00.000Z' },
    ];
    const res = mergeWuenscheIntoZuweisungen(
      existing,
      [batchOf('sch', [wunsch('A2'), wunsch('C')])], // A2 im vergebenen V1, C offen
      anonMap([['SCH', 'MA05']]),
      Q,
      STUNDEN_PRO_TV,
      inV1,
    );
    expect(res.bereitsVergeben).toBe(1);
    expect(res.neu).toBe(1);
    expect(res.neueEintraege).toEqual([{ antragId: 'C', anonId: 'MA05' }]);
  });

  it('laesst eine Freigabe mit selbstEingetragen stehen, wenn der MA seine Datei aufraeumt', () => {
    // Der MA hat den erfuellten Wunsch aus seiner Datei entfernt (v2.290
    // Selbst-Aufraeumen). Die Freigabe darf dadurch NICHT verschwinden —
    // `selbstEingetragen` ueberlebt die Freigabe und ist kein Wunsch-Signal.
    const existing: Zuweisung[] = [
      { antragId: 'A', anonId: 'MA01', quartal: Q, stunden: 9, anzahlTV: 1, status: 'freigegeben', selbstEingetragen: true, freigegebenAm: '2026-05-01T00:00:00.000Z' },
    ];
    const { next, entfernt } = mergeWuenscheIntoZuweisungen(
      existing,
      [batchOf('mue', [])], // Datei gelesen, aber leer
      anonMap([['MUE', 'MA01']]),
      Q,
      STUNDEN_PRO_TV,
    );
    expect(entfernt).toBe(0);
    expect(next).toHaveLength(1);
    expect(next[0]!.status).toBe('freigegeben');
  });

  it('liefert Details zu entfernten Wünschen (PL-Tooltip „wer hat was zurueckgezogen")', () => {
    const existing: Zuweisung[] = [
      { antragId: 'B', anonId: 'MA01', quartal: Q, stunden: 9, anzahlTV: 1, status: 'selbst', selbstEingetragen: true },
    ];
    const res = mergeWuenscheIntoZuweisungen(
      existing,
      [batchOf('mue', [])],
      anonMap([['MUE', 'MA01']]),
      Q,
      STUNDEN_PRO_TV,
    );
    expect(res.entfernteEintraege).toEqual([{ antragId: 'B', anonId: 'MA01' }]);
  });

  it('mehrere Interessenten VOR der Freigabe bleiben erhalten (Sperre greift erst nach Freigabe, Pitfall #26)', () => {
    const { next, neu } = mergeWuenscheIntoZuweisungen(
      [],
      [batchOf('mue', [wunsch('A1')]), batchOf('sch', [wunsch('A2')])],
      anonMap([['MUE', 'MA01'], ['SCH', 'MA02']]),
      Q,
      STUNDEN_PRO_TV,
      inV1, // beide Wünsche im selben Verbund, aber KEINE Freigabe vorhanden
    );
    expect(neu).toBe(2);
    expect(new Set(next.map(z => z.anonId))).toEqual(new Set(['MA01', 'MA02']));
  });

  // ── Zuweisbarkeit: kein Record fuer Antraege ausserhalb der Liste ────────
  // Regression: ohne diese Pruefung meldete das Einsammeln „14 neu", waehrend
  // die Pille „Übernahme-Wunsch" auf 0 stand — die Records lagen auf Antraegen,
  // die der Zuweisungs-Pool gar nicht fuehrt.

  it('legt KEINEN Record fuer einen nicht zuweisbaren Antrag an und weist ihn aus', () => {
    const res = mergeWuenscheIntoZuweisungen(
      [],
      [batchOf('mue', [wunsch('WEG'), wunsch('OK')])],
      anonMap([['MUE', 'MA01']]),
      Q,
      STUNDEN_PRO_TV,
      undefined,
      (id) => (id === 'WEG' ? 'gekuerzelt' : null),
    );
    expect(res.neu).toBe(1);
    expect(res.nichtZuweisbar).toBe(1);
    expect(res.nichtZuweisbareEintraege).toEqual([
      { antragId: 'WEG', anonId: 'MA01', grund: 'gekuerzelt' },
    ]);
    expect(res.next.map(z => z.antragId)).toEqual(['OK']);
  });

  it('raeumt einen bestehenden selbst-Record fuer einen nicht mehr zuweisbaren Antrag auf', () => {
    const existing: Zuweisung[] = [
      { antragId: 'WEG', anonId: 'MA01', quartal: Q, stunden: 9, anzahlTV: 1, status: 'selbst', selbstEingetragen: true },
    ];
    const res = mergeWuenscheIntoZuweisungen(
      existing,
      [batchOf('mue', [wunsch('WEG')])],
      anonMap([['MUE', 'MA01']]),
      Q,
      STUNDEN_PRO_TV,
      undefined,
      () => 'ausserhalb-pool',
    );
    expect(res.neu).toBe(0);
    expect(res.nichtZuweisbar).toBe(1);
    expect(res.next).toHaveLength(0);
  });

  it('ohne Prüfung (Default) bleibt das Verhalten unverändert', () => {
    const res = mergeWuenscheIntoZuweisungen(
      [],
      [batchOf('mue', [wunsch('A')])],
      anonMap([['MUE', 'MA01']]),
      Q,
      STUNDEN_PRO_TV,
    );
    expect(res.neu).toBe(1);
    expect(res.nichtZuweisbar).toBe(0);
    expect(res.nichtZuweisbareEintraege).toEqual([]);
  });
});

// ─── buildZuweisbarkeitsPruefung ──────────────────────────────────────────

describe('buildZuweisbarkeitsPruefung', () => {
  const antrag = (aktenzeichen: string, felder: Record<string, unknown> = {}): AntragOderSlim =>
    ({ aktenzeichen, antragsdatum: '2026-05-01', status: 'in bearbeitung', ...felder }) as unknown as AntragOderSlim;

  const CUTOFF = '2026-04-01';

  it('zuweisbar: im Fenster, ohne Kürzel', () => {
    const pruefe = buildZuweisbarkeitsPruefung([antrag('A')], CUTOFF);
    expect(pruefe('A')).toBeNull();
  });

  it('unbekannter Antrag → „unbekannt" (kein Record ins Blaue)', () => {
    const pruefe = buildZuweisbarkeitsPruefung([antrag('A')], CUTOFF);
    expect(pruefe('FREMD')).toBe('unbekannt');
  });

  it('CSV-Kürzel schlägt alles — der Antrag ist extern vergeben', () => {
    const pruefe = buildZuweisbarkeitsPruefung([antrag('A', { tib_kuerz: 'MUE' })], CUTOFF);
    expect(pruefe('A')).toBe('gekuerzelt');
  });

  it('Antragsdatum vor dem Cutoff → „ausserhalb-pool"', () => {
    const pruefe = buildZuweisbarkeitsPruefung([antrag('A', { antragsdatum: '2025-11-30' })], CUTOFF);
    expect(pruefe('A')).toBe('ausserhalb-pool');
  });

  it('ausgeschlossener Status → „ausserhalb-pool"', () => {
    const pruefe = buildZuweisbarkeitsPruefung([antrag('A', { status: 'Irrläufer' })], CUTOFF);
    expect(pruefe('A')).toBe('ausserhalb-pool');
  });

  it('ohne Cutoff (ungültiges Quartal) greift nur der Kürzel-Check — wie die Liste', () => {
    const pruefe = buildZuweisbarkeitsPruefung([antrag('A', { antragsdatum: '2020-01-01' })], null);
    expect(pruefe('A')).toBeNull();
  });
});

// ─── collectUebernahmeWuensche gegen Mock-Handles ──────────────────────────

function fileHandle(text: string): unknown {
  return { kind: 'file', getFile: async () => ({ text: async () => text }) };
}

/** User-Home-Ordner-Mock: getDirectoryHandle('ZAH') → 'auslastung-uebernahme.json'. */
function userDir(json: string | null): unknown {
  const zah = {
    kind: 'directory',
    getDirectoryHandle: async () => { throw new Error('no nested dirs'); },
    getFileHandle: async (name: string) => {
      if (json == null || name !== 'auslastung-uebernahme.json') throw new Error('not found');
      return fileHandle(json);
    },
  };
  return {
    kind: 'directory',
    getDirectoryHandle: async (name: string) => {
      if (name === 'ZAH') return zah;
      throw new Error('no');
    },
    getFileHandle: async () => { throw new Error('no'); },
  };
}

function rootHandle(entries: Array<{ name: string; kind: 'directory' | 'file'; dir?: unknown }>): unknown {
  return {
    kind: 'directory',
    values: async function* () {
      for (const e of entries) yield { kind: e.kind, name: e.name };
    },
    getDirectoryHandle: async (name: string) => {
      const e = entries.find(x => x.name === name && x.kind === 'directory');
      if (!e || !e.dir) throw new Error('no');
      return e.dir;
    },
  };
}

describe('collectUebernahmeWuensche', () => {
  it('liest valide Wunsch-Dateien, ueberspringt fehlende/ungueltige + Datei-Eintraege', async () => {
    const valid1 = JSON.stringify(batchOf('AAA', [wunsch('16EP1')]));
    const valid2 = JSON.stringify(batchOf('BBB', [wunsch('16KN2'), wunsch('16KN3')]));
    const root = rootHandle([
      { name: 'alice', kind: 'directory', dir: userDir(valid1) },
      { name: 'bob', kind: 'directory', dir: userDir(valid2) },
      { name: 'carol', kind: 'directory', dir: userDir(null) },       // keine Datei
      { name: 'dave', kind: 'directory', dir: userDir('{ kaputt') },  // invalides JSON
      { name: 'readme.txt', kind: 'file' },                           // Datei → skip
    ]);
    const out = await collectUebernahmeWuensche(root as unknown as FileSystemDirectoryHandle);
    expect(out.map(p => p.kuerzel).sort()).toEqual(['AAA', 'BBB']);
    expect(out.find(p => p.kuerzel === 'BBB')!.wuensche).toHaveLength(2);
  });

  it('ueberspringt Dateien mit falscher version', async () => {
    const wrong = JSON.stringify({ ...batchOf('AAA', [wunsch('A')]), version: 2 });
    const root = rootHandle([{ name: 'alice', kind: 'directory', dir: userDir(wrong) }]);
    const out = await collectUebernahmeWuensche(root as unknown as FileSystemDirectoryHandle);
    expect(out).toEqual([]);
  });
});
