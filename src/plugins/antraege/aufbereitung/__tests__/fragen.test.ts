import { describe, it, expect } from 'vitest';
import { sammleFragen, formatFragenMarkdown, type SammleFragenInput } from '../fragen';
import { PRUEF_ASPEKTE, type AspektMapping } from '../aspekte';
import type { VbSektion } from '../gliederung';
import type { AufbereitungRun } from '../types';
import type { Befund } from '../tabellen';
import type { ZahlenDaten } from '../zahlen';

const NOW = '2026-07-10T00:00:00.000Z';

function sektion(id: string, nummer: string, titel: string, ebene: 1 | 2): VbSektion {
  return { id, nummer, titel, ebene, start: 0, end: 10, quelle: 'heading' };
}
const GLIEDERUNG: VbSektion[] = [
  sektion('k-1', '1', 'Ausgangssituation', 1),
  sektion('k-3', '3', 'Lösungsweg', 1),
  sektion('k-3.1', '3.1', 'Kernentwicklung', 2),
  sektion('k-7', '7', 'Realisierbarkeit', 1),
];

function baseRun(over?: Partial<AufbereitungRun>): AufbereitungRun {
  return {
    version: 1, antragKey: 'A', erzeugtAm: NOW,
    quellen: [], gliederung: GLIEDERUNG, tabellen: [],
    zeitplan: { zeilen: [], herkunft: 'anlage5', achseMax: 24 },
    befunde: [], offenePunkte: [],
    ...over,
  };
}

const KAPAZITAET: Befund = { typ: 'kapazitaet', schwere: 'warnung', text: 'MA 1 überplant', quellen: [{ rolle: 'anlage5' }] };

/** Mapping, das JEDEN Aspekt A–J abdeckt (kein `aspekt-leer`). */
function vollAbgedeckt(): AspektMapping {
  return { zuordnung: Object.fromEntries(PRUEF_ASPEKTE.map(a => [a.id, ['k-1']])), fehlend: {} };
}

describe('sammleFragen', () => {
  it('Zeitplan-/Kapazitäts-Befunde landen in Aspekt H, Meta listet nicht-ok-Bausteine', () => {
    const run = baseRun({ befunde: [KAPAZITAET] });
    const m = sammleFragen({ run, mapping: null, zahlen: null, status: { aspekte: 'fehlt', zahlen: 'fehlt' } });
    const h = m.gruppen.find(g => g.aspektId === 'H');
    expect(h?.eintraege[0]!.key).toBe('kapazitaet::MA 1 überplant');
    expect(h?.eintraege[0]!.frage).toContain('leistbar');
    expect(m.gesamt).toBe(1);
    // Meta ist unabhängig von den Befunden (nur Baustein-Status).
    expect(m.meta.map(x => x.baustein)).toEqual(['Aspekt-Mapping', 'Zahlen-Inventar']);
  });

  it('Mapping erzeugt aspekt-fehlt (I), risiko-fehlt (D), aspekt-leer für unabgedeckte Aspekte', () => {
    const mapping: AspektMapping = { zuordnung: { A: ['k-1'], C: ['k-3.1'] }, fehlend: { I: ['Preisvorstellungen'] } };
    const run = baseRun(); // keine risiken → Lösungsweg k-3.1 ohne Risiko
    const m = sammleFragen({ run, mapping, zahlen: null, status: { aspekte: 'ok', zahlen: 'fehlt' } });

    const i = m.gruppen.find(g => g.aspektId === 'I');
    expect(i?.eintraege.some(e => e.key === 'aspekt-fehlt:I:preisvorstellungen')).toBe(true);

    const d = m.gruppen.find(g => g.aspektId === 'D');
    const rf = d?.eintraege.find(e => e.key === 'risiko-fehlt:k-3.1');
    expect(rf).toBeDefined();
    expect(rf!.sektionIds).toEqual(['k-3.1']); // Fundstelle vorhanden

    // H hat keine Zuordnung → aspekt-leer:H
    expect(m.gruppen.find(g => g.aspektId === 'H')?.eintraege.some(e => e.key === 'aspekt-leer:H')).toBe(true);
    // A + C sind abgedeckt → kein aspekt-leer
    expect(m.gruppen.find(g => g.aspektId === 'A')).toBeUndefined();
    expect(m.meta.map(x => x.baustein)).toEqual(['Zahlen-Inventar']);
  });

  it('unzuordenbares Risiko → eigener Key risiko-unzugeordnet:<slug> (Aspekt D)', () => {
    const mapping: AspektMapping = { zuordnung: { C: ['k-3.1'] }, fehlend: {} };
    // Risiko mit Titel, der NICHT zum Lösungsweg-Titel „Kernentwicklung" passt → unzugeordnet.
    const run = baseRun({ risiken: [{ titel: 'Lieferengpass Halbleiter', beschreibung: 'x', sektionId: 'k-7' }] });
    const m = sammleFragen({ run, mapping, zahlen: null, status: { aspekte: 'ok', zahlen: 'ok' } });
    const d = m.gruppen.find(g => g.aspektId === 'D');
    expect(d?.eintraege.some(e => e.key === 'risiko-unzugeordnet:lieferengpass-halbleiter')).toBe(true);
  });

  it('alles abgedeckt + nichts gefunden → gesamt 0, keine Meta-Hinweise', () => {
    // Voll abgedeckt (C→k-1); k-1 trägt ein passendes Risiko → kein risiko-fehlt.
    const run = baseRun({ risiken: [{ titel: 'Ausgangssituation', beschreibung: 'x', sektionId: 'k-1' }] });
    const m = sammleFragen({ run, mapping: vollAbgedeckt(), zahlen: { schemaVersion: 1, claims: [] }, status: { aspekte: 'ok', zahlen: 'ok' } });
    expect(m.gesamt).toBe(0);
    expect(m.meta).toEqual([]);
    expect(m.gruppen).toEqual([]);
  });

  it('nimmt Zahlen-Widersprüche gegen den Zeitplan-Horizont auf', () => {
    // „18 Monate" widerspricht dem Zeitplan-Horizont (achseMax 24) → ein Aspekt-H-Eintrag.
    const zahlen: ZahlenDaten = {
      schemaVersion: 1,
      claims: [{ wert: '18 Monate', einheit: 'Monate', kategorie: 'zeit', relevanz: 'kern', kontext: 'Laufzeit von 18 Monaten', sektionIds: ['k-7'] }],
    };
    const m = sammleFragen({ run: baseRun(), mapping: null, zahlen, status: { aspekte: 'ok', zahlen: 'ok' } });
    const keys = m.gruppen.flatMap(g => g.eintraege.map(e => e.key));
    expect(keys).toContain('zahl-widerspruch:laufzeit:18-monate');
  });

  it('ist deterministisch (gleiche Eingabe → gleiche Keys)', () => {
    // Quelle unabhängig vom Zeitplan (aspekt-fehlt), damit der Test nicht an einer Ecke hängt.
    const mapping: AspektMapping = { zuordnung: {}, fehlend: { I: ['Preisvorstellungen'] } };
    const input: SammleFragenInput = { run: baseRun({ befunde: [KAPAZITAET] }), mapping, zahlen: null, status: { aspekte: 'ok', zahlen: 'ok' } };
    const a = sammleFragen(input).gruppen.flatMap(g => g.eintraege.map(e => e.key));
    const b = sammleFragen(input).gruppen.flatMap(g => g.eintraege.map(e => e.key));
    expect(a).toEqual(b);
  });
});

describe('formatFragenMarkdown', () => {
  it('gruppiert nach Aspekt mit [ ]/[x] und Sektions-Referenz', () => {
    const mapping: AspektMapping = { zuordnung: { A: ['k-1'], C: ['k-3.1'] }, fehlend: {} };
    const m = sammleFragen({ run: baseRun(), mapping, zahlen: null, status: { aspekte: 'ok', zahlen: 'ok' } });
    const md = formatFragenMarkdown(m, new Set());
    expect(md).toContain('# Offene Punkte / Prüffragen');
    expect(md).toContain('[ ]');
    expect(md).toContain('k-3.1'); // Sektions-Referenz im Markdown
    const mdErledigt = formatFragenMarkdown(m, new Set(['risiko-fehlt:k-3.1']));
    expect(mdErledigt).toContain('[x]');
  });

  it('listet Meta-Hinweise als eigenen Abschnitt', () => {
    const m = sammleFragen({ run: baseRun(), mapping: null, zahlen: null, status: { aspekte: 'degradiert', zahlen: 'fehler' } });
    const md = formatFragenMarkdown(m, new Set());
    expect(md).toContain('## Hinweis');
    expect(md).toContain('Aspekt-Mapping');
  });
});
