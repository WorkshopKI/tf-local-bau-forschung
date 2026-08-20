import { describe, it, expect } from 'vitest';
import { normalizeRegistryFile } from '../../registry/storage';
import { normalizeKatalog } from '../../textbausteine/storage';
import type { SkillRegistryFile } from '../../registry/types';
import type { TextbausteinKatalog } from '../../textbausteine/types';
import { schnuerePaket, parseKuraturPaket, ALLES } from '../schnueren';
import { vergleichePaket, vorbelegung, kanonisch } from '../vergleich';
import { wendePaketAn, uebernimmSchritte } from '../einspielen';
import { KURATUR_PAKET_KIND, zeilenSchluessel, type Entscheidungen, type KuraturPaket } from '../typen';

const TS = '2026-08-20T10:00:00.000Z';
const CTX = { zeitpunkt: TS, userId: 'THÜ', begruendung: 'Kuratur-Paket vom 20.08.2026', newId: () => 'neu-id' };

/** Beide Seiten laufen in der App durch die Normalisierer — die Fixtures deshalb auch. */
function file(): SkillRegistryFile {
  return normalizeRegistryFile({
    version: 1,
    updated_at: 't',
    skills: [
      {
        id: 's1', name: 'Kurzfassung', beschreibung: 'd', version: 3, promptTemplate: 'Zeile A\nZeile B',
        modifiers: { neu: '', kuerzer: '', laenger: '' }, regelIds: ['r1'], slots: ['vbMarkdown'],
        geaendert_am: '2026-01-01T00:00:00.000Z',
        vorgaben: { satzanzahl: { schweregrad: 'fehler', min: 8, max: 12 } },
        historie: [{
          version: 3, promptTemplate: 'Zeile A\nZeile B', regelIds: ['r1'],
          modifiers: { neu: '', kuerzer: '', laenger: '' }, geaendert_am: '2026-01-01T00:00:00.000Z',
        }],
      },
    ],
    regeln: [
      { id: 'r1', name: 'R1', typ: 'zeichen_max', params: { max: 800 }, schweregrad: 'fehler', aktiv: true, erstellt_am: 'e', geaendert_am: 'g' },
    ],
    workflows: [
      {
        id: 'zim-ep', name: 'ZIM-EP', version: 2,
        steps: [
          { id: 'A', nr: 'A', kurz: 'A', label: 'Kurzfassung', skillId: 's1', ankerKey: 'A', gateExpr: 'immer' },
          { id: 'B', nr: 'B', kurz: 'B', label: 'Hintergrund', skillId: 's1', ankerKey: 'B', gateExpr: 'immer' },
        ],
      },
    ],
  })!;
}

function katalog(): TextbausteinKatalog {
  return normalizeKatalog({
    version: 1,
    updated_at: 't',
    bausteine: [
      {
        id: 'G1.1', artefaktTyp: 'nf', thema: 'Gesamtvorhaben', kategorie: 'Vorhaben',
        aspekte: ['A'], stichworte: ['x'], text: 'Bitte reichen Sie nach.', status: 'freigegeben',
        version: 2, geaendertAm: '2026-02-01T00:00:00.000Z',
      },
    ],
  })!;
}

/** Paket schnüren und durch JSON schicken — wie beim echten Download/Upload. */
function paketVon(f: SkillRegistryFile, k: TextbausteinKatalog | null): KuraturPaket {
  const roh = schnuerePaket(f, k, ALLES, { erstellt_am: TS, quelle: 'ZAH local' });
  return parseKuraturPaket(JSON.parse(JSON.stringify(roh)))!;
}

describe('paket/schnueren', () => {
  it('nimmt alle vier Gruppen mit, ohne Historie und ohne Antragsdaten', () => {
    const p = schnuerePaket(file(), katalog(), ALLES, { erstellt_am: TS, quelle: 'ZAH local' });
    expect(p.kind).toBe(KURATUR_PAKET_KIND);
    expect(Object.keys(p).sort()).toEqual(
      ['bausteine', 'erstellt_am', 'kind', 'quelle', 'regeln', 'skills', 'version', 'workflows'],
    );
    expect('historie' in p.skills[0]!).toBe(false);
    expect(p.bausteine[0]!.historie).toEqual([]);
    // Keine Antragsdaten: geprüft wird auf FELDER (`"name":`), nicht auf Vorkommen —
    // ein Slot-Name `"vbMarkdown"` im `slots`-Array ist eine Deklaration, kein Inhalt.
    const roh = JSON.stringify(p);
    for (const feld of ['aktenzeichen', 'fkz', 'vbMarkdown', 'antrag', 'finalerText', 'verbund']) {
      expect(roh.includes(`"${feld}":`)).toBe(false);
    }
  });

  it('leere Auswahl liefert ein leeres Paket', () => {
    const p = schnuerePaket(file(), katalog(), { skills: false, regeln: false, workflows: false, bausteine: false }, { erstellt_am: TS });
    expect([p.skills, p.regeln, p.workflows, p.bausteine].every(a => a.length === 0)).toBe(true);
    expect(p.quelle).toBeUndefined();
  });

  it('ohne Katalog bleiben die Bausteine leer', () => {
    expect(schnuerePaket(file(), null, ALLES, { erstellt_am: TS }).bausteine).toEqual([]);
  });

  it('verwirft fremde oder kaputte Strukturen', () => {
    expect(parseKuraturPaket({ kind: 'teamflow-skill-bundle' })).toBeNull();
    expect(parseKuraturPaket(null)).toBeNull();
    expect(parseKuraturPaket('text')).toBeNull();
  });

  it('überlebt eine von Hand verstümmelte Datei (tolerant statt Wurf)', () => {
    const p = parseKuraturPaket({
      kind: KURATUR_PAKET_KIND, version: 1, erstellt_am: TS,
      skills: [{ name: 'ohne id' }], regeln: 'kaputt', workflows: [null], bausteine: [{ id: 'X', text: '' }],
    })!;
    expect(p).not.toBeNull();
    expect([p.skills, p.regeln, p.workflows, p.bausteine].every(a => a.length === 0)).toBe(true);
  });
});

describe('paket/vergleich', () => {
  it('Roundtrip gegen denselben Stand: alles identisch, nichts zu tun', () => {
    const f = file();
    const k = katalog();
    const zeilen = vergleichePaket(paketVon(f, k), f, k);
    expect(zeilen).toHaveLength(4); // 1 Regel, 1 Skill, 1 Workflow, 1 Baustein
    expect(zeilen.every(z => z.zustand === 'identisch')).toBe(true);
    expect(zeilen.every(z => z.vorschlag === 'ueberspringen')).toBe(true);
  });

  it('leeres Ziel: alles neu, Vorschlag übernehmen', () => {
    const leer: SkillRegistryFile = { version: 1, updated_at: 't', skills: [], regeln: [], workflows: [] };
    const zeilen = vergleichePaket(paketVon(file(), katalog()), leer, { version: 1, updated_at: 't', bausteine: [] });
    expect(zeilen.every(z => z.zustand === 'neu')).toBe(true);
    expect(zeilen.every(z => z.vorschlag === 'uebernehmen')).toBe(true);
  });

  it('erkennt eine Änderung, die NUR in `vorgaben` steckt', () => {
    const f = file();
    const p = paketVon(f, null);
    p.skills[0]!.vorgaben = { satzanzahl: { schweregrad: 'fehler', min: 5, max: 9 } };
    const zeile = vergleichePaket(p, f, null).find(z => z.art === 'skill')!;
    expect(zeile.zustand).toBe('geaendert');
    expect(zeile.moeglich).toEqual(['aktualisieren', 'kopie', 'ueberspringen']);
    expect(zeile.zielVersion).toBe(3);
  });

  it('erkennt Änderungen in `aktiv` und `teilStruktur` (feldweise gebaute Records)', () => {
    const f = file();
    const pAktiv = paketVon(f, null);
    pAktiv.skills[0]!.aktiv = false;
    expect(vergleichePaket(pAktiv, f, null).find(z => z.art === 'skill')!.zustand).toBe('geaendert');

    const pTeil = paketVon(f, null);
    pTeil.skills[0]!.teilStruktur = [{ key: 'a', label: 'A' }];
    expect(vergleichePaket(pTeil, f, null).find(z => z.art === 'skill')!.zustand).toBe('geaendert');
  });

  it('unterschiedliche Schritt-IDs allein machen einen Workflow nicht „geändert"', () => {
    const f = file();
    const p = paketVon(f, null);
    p.workflows[0]!.steps[0]!.id = 'voellig-andere-id';
    expect(vergleichePaket(p, f, null).find(z => z.art === 'workflow')!.zustand).toBe('identisch');
  });

  it('Regeln und Bausteine bieten keine Kopie an', () => {
    const f = file();
    const k = katalog();
    const p = paketVon(f, k);
    p.regeln[0]!.name = 'anders';
    p.bausteine[0]!.text = 'anderer Text';
    const zeilen = vergleichePaket(p, f, k);
    expect(zeilen.find(z => z.art === 'regel')!.moeglich).toEqual(['aktualisieren', 'ueberspringen']);
    expect(zeilen.find(z => z.art === 'baustein')!.moeglich).toEqual(['aktualisieren', 'ueberspringen']);
  });

  it('kanonisch: Schlüssel-Reihenfolge egal, Array-Reihenfolge nicht', () => {
    const aus = new Set<string>();
    expect(kanonisch({ a: 1, b: 2 }, aus)).toBe(kanonisch({ b: 2, a: 1 }, aus));
    expect(kanonisch([1, 2], aus)).not.toBe(kanonisch([2, 1], aus));
    expect(kanonisch({ a: 1, weg: 9 }, new Set(['weg']))).toBe(kanonisch({ a: 1 }, new Set(['weg'])));
  });
});

describe('paket/einspielen', () => {
  it('Roundtrip mit Vorbelegung schreibt nichts', () => {
    const f = file();
    const k = katalog();
    const p = paketVon(f, k);
    const res = wendePaketAn(f, k, p, vorbelegung(vergleichePaket(p, f, k)), CTX);
    expect(res.bericht.registryGeaendert).toBe(false);
    expect(res.bericht.katalogGeaendert).toBe(false);
    expect(res.file).toBe(f);
    expect(res.katalog).toBe(k);
    expect(res.bericht.gesamt.uebersprungen).toBe(4);
  });

  it('legt in ein leeres Ziel alles an', () => {
    const leer: SkillRegistryFile = { version: 1, updated_at: 't', skills: [], regeln: [], workflows: [] };
    const leerK: TextbausteinKatalog = { version: 1, updated_at: 't', bausteine: [] };
    const p = paketVon(file(), katalog());
    const res = wendePaketAn(leer, leerK, p, vorbelegung(vergleichePaket(p, leer, leerK)), CTX);
    expect(res.file.skills.map(s => s.id)).toEqual(['s1']);
    expect(res.file.regeln.map(r => r.id)).toEqual(['r1']);
    expect(res.file.workflows!.map(w => w.id)).toEqual(['zim-ep']);
    expect(res.katalog!.bausteine.map(b => b.id)).toEqual(['G1.1']);
    expect(res.bericht.gesamt.neu).toBe(4);
  });

  it('Aktualisieren schiebt den Ziel-Stand in die Historie statt ihn zu verlieren', () => {
    const f = file();
    const p = paketVon(f, null);
    p.skills[0]!.promptTemplate = 'Zeile A\nZeile B NEU';
    const e: Entscheidungen = { [zeilenSchluessel('skill', 's1')]: 'aktualisieren' };
    const skill = wendePaketAn(f, null, p, e, CTX).file.skills[0]!;

    expect(skill.version).toBe(4);
    expect(skill.promptTemplate).toBe('Zeile A\nZeile B NEU');
    expect(skill.geaendert_am).toBe(TS);
    // historie[0] ≙ Record (Invariante), der abgelöste Stand steht darunter.
    expect(skill.historie![0]!.version).toBe(4);
    expect(skill.historie![0]!.begruendung).toBe(CTX.begruendung);
    expect(skill.historie![0]!.userId).toBe('THÜ');
    expect(skill.historie![1]!.version).toBe(3);
    expect(skill.historie![1]!.promptTemplate).toBe('Zeile A\nZeile B');
  });

  it('„übernehmen" auf einem vorhandenen Eintrag fasst nichts an (konservativer Rückfall)', () => {
    const f = file();
    const p = paketVon(f, null);
    p.skills[0]!.promptTemplate = 'ANDERS';
    const e: Entscheidungen = { [zeilenSchluessel('skill', 's1')]: 'uebernehmen' };
    const res = wendePaketAn(f, null, p, e, CTX);
    expect(res.bericht.registryGeaendert).toBe(false);
    expect(res.file.skills[0]!.promptTemplate).toBe('Zeile A\nZeile B');
  });

  it('Kopie legt einen zweiten Skill an und lässt den vorhandenen unberührt', () => {
    const f = file();
    const p = paketVon(f, null);
    p.skills[0]!.promptTemplate = 'ANDERS';
    const e: Entscheidungen = { [zeilenSchluessel('skill', 's1')]: 'kopie' };
    const res = wendePaketAn(f, null, p, e, CTX);
    expect(res.file.skills.map(s => s.id)).toEqual(['s1', 'neu-id']);
    expect(res.file.skills[0]!.promptTemplate).toBe('Zeile A\nZeile B');
    expect(res.file.skills[1]!.name).toContain('(importiert)');
    expect(res.bericht.gesamt.kopiert).toBe(1);
  });

  it('Workflow aktualisieren behält die Schritt-IDs des Ziels (WorkflowRun hängt daran)', () => {
    const f = file();
    const p = paketVon(f, null);
    const wf = p.workflows[0]!;
    wf.steps[0]!.id = 'fremde-id';           // Quelle hatte andere IDs …
    wf.steps[0]!.label = 'Kurzfassung NEU';  // … und einen geänderten Text
    wf.steps.push({ id: 'C', nr: 'C', kurz: 'C', label: 'Markt', skillId: 's1', ankerKey: 'C', gateExpr: 'immer' });
    const e: Entscheidungen = { [zeilenSchluessel('workflow', 'zim-ep')]: 'aktualisieren' };
    const res = wendePaketAn(f, null, p, e, CTX);

    const steps = res.file.workflows![0]!.steps;
    // A/B behalten die IDs des Ziels; C ist neu und darf seine sprechende ID
    // behalten, weil sie in keinem Workflow des Ziels belegt ist.
    expect(steps.map(s => s.id)).toEqual(['A', 'B', 'C']);
    expect(steps[0]!.label).toBe('Kurzfassung NEU');
    expect(res.file.workflows![0]!.version).toBe(3);
    expect(res.bericht.entfalleneSchritte).toBe(0);
  });

  it('zählt Schritte, die beim Aktualisieren entfallen', () => {
    const f = file();
    const p = paketVon(f, null);
    p.workflows[0]!.steps = p.workflows[0]!.steps.slice(0, 1); // B fällt weg
    p.workflows[0]!.name = 'ZIM-EP kurz';
    const e: Entscheidungen = { [zeilenSchluessel('workflow', 'zim-ep')]: 'aktualisieren' };
    const res = wendePaketAn(f, null, p, e, CTX);
    expect(res.file.workflows![0]!.steps.map(s => s.id)).toEqual(['A']);
    expect(res.bericht.entfalleneSchritte).toBe(1);
  });

  it('neuer Workflow: kollidierende Schritt-IDs weichen aus, Verweise wandern mit', () => {
    const f = file(); // hat bereits Schritte 'A' und 'B' in zim-ep
    const p = paketVon(f, null);
    p.workflows = [{
      id: 'zim-nf', name: 'NF', version: 1,
      steps: [
        { id: 'A', nr: '1', kurz: '1', label: 'Auswahl', skillId: 's1', gateExpr: 'immer' },
        { id: 'A2', nr: '1a', kurz: '1a', label: 'Unter', skillId: 's1', parentStepId: 'A', gateExpr: 'immer' },
      ],
    }];
    const e: Entscheidungen = { [zeilenSchluessel('workflow', 'zim-nf')]: 'uebernehmen' };
    const steps = wendePaketAn(f, null, p, e, { ...CTX, newId: () => 'frisch' }).file.workflows![1]!.steps;
    expect(steps[0]!.id).toBe('frisch');        // 'A' war belegt
    expect(steps[1]!.id).toBe('A2');            // frei → bleibt
    expect(steps[1]!.parentStepId).toBe('frisch'); // Verweis umgehängt
  });

  it('Baustein aktualisieren: neue Fassung, alte Fassung bleibt, Statuswechsel gezählt', () => {
    const f = file();
    const k = katalog();
    const p = paketVon(f, k);
    p.bausteine[0]!.text = 'Bitte reichen Sie den Kostenplan nach.';
    p.bausteine[0]!.status = 'entwurf';
    const e: Entscheidungen = { [zeilenSchluessel('baustein', 'G1.1')]: 'aktualisieren' };
    const res = wendePaketAn(f, k, p, e, CTX);

    const b = res.katalog!.bausteine[0]!;
    expect(b.version).toBe(3);
    expect(b.status).toBe('entwurf');
    expect(b.historie[0]!.version).toBe(3);
    expect(b.historie[1]!.text).toBe('Bitte reichen Sie nach.');
    expect(res.bericht.statuswechsel).toBe(1);
    expect(res.bericht.katalogGeaendert).toBe(true);
    expect(res.bericht.registryGeaendert).toBe(false);
  });

  it('ohne Katalog werden Baustein-Zeilen übersprungen statt geschrieben', () => {
    const f = file();
    const p = paketVon(f, katalog());
    const e: Entscheidungen = { [zeilenSchluessel('baustein', 'G1.1')]: 'aktualisieren' };
    const res = wendePaketAn(f, null, p, e, CTX);
    expect(res.katalog).toBeNull();
    expect(res.bericht.katalogGeaendert).toBe(false);
    expect(res.bericht.proArt.baustein.uebersprungen).toBe(1);
  });

  it('fehlende Entscheidung = nichts tun', () => {
    const f = file();
    const p = paketVon(f, null);
    p.skills[0]!.promptTemplate = 'ANDERS';
    expect(wendePaketAn(f, null, p, {}, CTX).bericht.registryGeaendert).toBe(false);
  });
});

describe('uebernimmSchritte', () => {
  const s = (id: string, extra: Record<string, unknown> = {}): never => ({
    id, nr: id, kurz: id, label: id, skillId: 'x', gateExpr: 'immer', ...extra,
  } as never);

  it('Kopie-Pfad vergibt ALLE IDs neu (Bestands-Semantik der Einzel-Bündel)', () => {
    let n = 0;
    const res = uebernimmSchritte([s('A'), s('B')], [s('A'), s('B')], new Set(), () => `n${++n}`, true);
    expect(res.steps.map(x => x.id)).toEqual(['n1', 'n2']);
  });

  it('ordnet über `nr` zu, wenn kein ankerKey vorhanden ist', () => {
    const ziel = [s('ziel-1', { nr: '1', ankerKey: undefined })];
    const paket = [s('paket-1', { nr: '1', ankerKey: undefined, label: 'neu' })];
    const res = uebernimmSchritte(paket, ziel, new Set(), () => 'frisch', false);
    expect(res.steps[0]!.id).toBe('ziel-1');
    expect(res.entfallen).toBe(0);
  });
});
