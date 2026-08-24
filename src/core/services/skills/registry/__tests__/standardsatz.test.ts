/**
 * Der Standardsatz am Workflow (v6.36) — Auflösung, Abwahl, Rollout.
 *
 * Ausgangslage, gezählt: 37 Regel-Deklarationen über A–G, davon 25 dieselbe Regel
 * mehrfach (Interpunktion 7×, Überschriften 7×, Aufzählungen 6×, Passiv-Stil 5×).
 * Eine Änderung an „keine Aufzählungen" war damit sechs Änderungen — und die
 * Konstante, die das verhindern sollte (`GA_ABSCHNITT_REGEL_IDS`), hielt ihr eigenes
 * Versprechen nicht: E und F benutzten sie nie, G fehlte die Aufzählungs-Vorgabe.
 *
 * Der Satz hängt am WORKFLOW und nicht am Prüfer — sonst nähme ein abgeschalteter
 * fachlicher Prüfer vier Form-Regeln aus allen sieben Abschnitten mit.
 *
 * Diese Datei nagelt drei Dinge fest: dass die AUFGELÖSTE Regelliste je Abschnitt
 * dieselbe bleibt (nur G gewinnt die geschlossene Lücke), dass die Abwahl trägt, und
 * dass die Migration kuratierte Stände in Ruhe lässt.
 */
import { describe, expect, it } from 'vitest';
import { resolveRegeln, standardRegelIdsFuer, getSkillById } from '../selectors';
import { buildPromptVorgaben } from '../check-engine';
import { normalizeRegistryFile } from '../storage';
import { reconcileEinmaligeAktivierungen, GA_STANDARDSATZ_MIGRATION, GA_PRUEFER_AKTIV_MIGRATION } from '../migrations';
import {
  SEED_REGISTRY, ZIM_EP_DEF, GA_STANDARD_REGEL_IDS, PASSIV_REGEL_ID,
  AUFZAEHLUNGEN_REGEL_ID, INTERPUNKTION_REGEL_ID, UEBERSCHRIFTEN_REGEL_ID,
  KURZFASSUNG_SKILL_ID, AUSGANGSLAGE_SKILL_ID, UNTERNEHMEN_SKILL_ID, KOMPETENZ_SKILL_ID,
  QS_BASIS_SKILL_ID, SEED_QS_SKILL,
} from '../seed';
import type { SkillRecord, SkillRegistryFile, WorkflowDef } from '../types';

function skill(id: string, over: Partial<SkillRecord> = {}): SkillRecord {
  return {
    id, name: id, beschreibung: '', version: 1, promptTemplate: 'P',
    modifiers: { neu: '', kuerzer: '', laenger: '' }, regelIds: [], slots: [],
    geaendert_am: 't', ...over,
  };
}
function wf(over: Partial<WorkflowDef> = {}): WorkflowDef {
  return {
    id: ZIM_EP_DEF.id, name: 'GA', version: 3, artefaktTyp: 'ga',
    steps: [{ id: 'A', nr: 'A', kurz: 'A', label: 'A', skillId: 'a', ankerKey: 'A', gateExpr: 'immer' }],
    ...over,
  };
}
function file(skills: SkillRecord[], workflows?: WorkflowDef[]): SkillRegistryFile {
  return { version: 1, updated_at: 't', skills, regeln: [...SEED_REGISTRY.regeln], ...(workflows ? { workflows } : {}) };
}

describe('Standardsatz — Auflösung', () => {
  it('ein Schritt-Skill erbt den Satz seines Workflows', () => {
    const f = file([skill('a')], [wf({ standardRegelIds: [PASSIV_REGEL_ID] })]);
    expect(standardRegelIdsFuer(f, f.skills[0]!)).toEqual([PASSIV_REGEL_ID]);
    expect(resolveRegeln(f, f.skills[0]!).map(r => r.id)).toEqual([PASSIV_REGEL_ID]);
  });

  it('ein Skill AUSSERHALB der Schritte erbt nichts — auch der Prüfer nicht', () => {
    // Der springende Punkt: `pruefer` steht neben `steps`, nicht darin. Ein Prüfer
    // erzeugt keinen Abschnittstext, also gelten Form-Regeln für ihn nicht.
    const f = file(
      [skill('p')],
      [wf({ pruefer: ['p'], standardRegelIds: [PASSIV_REGEL_ID] })],
    );
    expect(standardRegelIdsFuer(f, f.skills[0]!)).toEqual([]);
    expect(resolveRegeln(f, f.skills[0]!)).toEqual([]);
  });

  it('ohne Satz am Workflow ändert sich nichts (Verhalten vor v6.36)', () => {
    const f = file([skill('a', { regelIds: [PASSIV_REGEL_ID] })], [wf()]);
    expect(standardRegelIdsFuer(f, f.skills[0]!)).toEqual([]);
    expect(resolveRegeln(f, f.skills[0]!).map(r => r.id)).toEqual([PASSIV_REGEL_ID]);
  });

  it('eine doppelt geführte Regel erscheint EINMAL, an ihrer eigenen Stelle', () => {
    // Wer eine Standard-Regel zusätzlich zuordnet, soll keine doppelte Prompt-Zeile
    // und keinen doppelten Check bekommen — und ihre Position nicht verlieren.
    const f = file(
      [skill('a', { regelIds: [UEBERSCHRIFTEN_REGEL_ID] })],
      [wf({ standardRegelIds: [PASSIV_REGEL_ID, UEBERSCHRIFTEN_REGEL_ID] })],
    );
    expect(resolveRegeln(f, f.skills[0]!).map(r => r.id))
      .toEqual([UEBERSCHRIFTEN_REGEL_ID, PASSIV_REGEL_ID]);
  });

  it('`ohneStandard` nimmt genau eine Regel heraus, die übrigen bleiben', () => {
    const f = file(
      [skill('a', { ohneStandard: [PASSIV_REGEL_ID] })],
      [wf({ standardRegelIds: [PASSIV_REGEL_ID, INTERPUNKTION_REGEL_ID] })],
    );
    expect(resolveRegeln(f, f.skills[0]!).map(r => r.id)).toEqual([INTERPUNKTION_REGEL_ID]);
  });
});

describe('Standardsatz — überlebt das Laden', () => {
  // Gleiche Klasse wie `vorgaben`/`qsKriterien`/`pruefart`: `normalize*` baut die
  // Objekte FELDWEISE neu. Ohne die beiden Zeilen verlöre der Workflow seinen Satz
  // (jeder Abschnitt liefe still ohne Form-Regeln) und der Abschnitt seine Abwahl
  // (er bekäme eine Regel zurück, die jemand bewusst abbestellt hat).
  it('der Satz am Workflow kommt unverändert an', () => {
    const roh = file([], [wf({ standardRegelIds: [PASSIV_REGEL_ID, ' ', INTERPUNKTION_REGEL_ID] })]);
    const out = normalizeRegistryFile(roh)!;
    expect(out.workflows![0]!.standardRegelIds).toEqual([PASSIV_REGEL_ID, INTERPUNKTION_REGEL_ID]);
  });

  it('die Abwahl am Skill kommt unverändert an', () => {
    const roh = file([skill('a', { ohneStandard: [PASSIV_REGEL_ID] })]);
    expect(normalizeRegistryFile(roh)!.skills[0]!.ohneStandard).toEqual([PASSIV_REGEL_ID]);
  });
});

describe('Standardsatz — der Seed', () => {
  it('zim-ep trägt vier Regeln, kein Abschnitt dekliniert sie erneut', () => {
    expect(ZIM_EP_DEF.standardRegelIds).toEqual([
      PASSIV_REGEL_ID, INTERPUNKTION_REGEL_ID, UEBERSCHRIFTEN_REGEL_ID, AUFZAEHLUNGEN_REGEL_ID,
    ]);
    for (const step of ZIM_EP_DEF.steps) {
      const s = getSkillById(SEED_REGISTRY, step.skillId)!;
      expect(s.regelIds, step.id).toEqual([]);
      expect(s.vorgaben?.keineAufzaehlungen, step.id).toBeUndefined();
    }
  });

  it('jede Standard-ID löst sich in der Bibliothek auf', () => {
    for (const id of GA_STANDARD_REGEL_IDS) {
      expect(SEED_REGISTRY.regeln.find(r => r.id === id), id).toBeDefined();
    }
  });

  it('jede Abwahl zeigt auf eine Regel, die im Satz steht', () => {
    // Ein `ohneStandard`-Eintrag, der auf nichts zeigt, wäre ein stiller No-op —
    // der Kurator sähe eine Ausnahme, die nie wirkt.
    const satz = new Set(GA_STANDARD_REGEL_IDS);
    for (const s of SEED_REGISTRY.skills) {
      for (const id of s.ohneStandard ?? []) {
        expect(satz.has(id), `${s.id} wählt „${id}" ab — steht aber in keinem Satz`).toBe(true);
      }
    }
  });

  it('die aufgelöste Regelliste bleibt je Abschnitt dieselbe — nur G gewinnt eine', () => {
    // Gemessen vor und nach dem Umzug. A–F sind identisch (bei E und F wandert die
    // Aufzählungs-Regel nur von der Vorgabe in die Bibliothek), G bekommt die
    // Aufzählungs-Regel erstmals — an 224 gespeicherten Abschnitts-Texten hat KEIN
    // G-Text eine Aufzählung getragen, die Lücke schließt sich also folgenlos.
    const anzahl = Object.fromEntries(ZIM_EP_DEF.steps.map(st => [
      st.id, resolveRegeln(SEED_REGISTRY, getSkillById(SEED_REGISTRY, st.skillId)!).length,
    ]));
    expect(anzahl).toEqual({ A: 7, B: 6, C: 5, D: 5, E: 5, F: 5, G: 5 });
  });

  it('der Prompt-Block nennt die Aufzählungs-Regel weiterhin — als letzte Zeile', () => {
    // Die einzige unvermeidliche Prompt-Änderung des Umzugs: die Zeile wandert von
    // den Vorgaben ans Ende der Regeln. Gleicher Wortlaut, andere Position.
    const b = getSkillById(SEED_REGISTRY, AUSGANGSLAGE_SKILL_ID)!;
    const zeilen = buildPromptVorgaben(resolveRegeln(SEED_REGISTRY, b)).trim().split('\n');
    expect(zeilen[zeilen.length - 1]).toContain('Fließtext ohne Aufzählungen');
  });
});

describe('Migration — der Satz zieht um', () => {
  const ALLE_MARKER = reconcileEinmaligeAktivierungen(
    { version: 1, updated_at: 't', skills: [], regeln: [] },
  ).file.angewandteMigrationen ?? [];
  const nurDiese = (marker: string, skills: SkillRecord[], workflows?: WorkflowDef[]): SkillRegistryFile => ({
    ...file(skills, workflows),
    angewandteMigrationen: ALLE_MARKER.filter(m => m !== marker),
  });
  const gaWf = (over: Partial<WorkflowDef> = {}): WorkflowDef =>
    ({ ...ZIM_EP_DEF, standardRegelIds: undefined, version: 3, ...over });

  it('setzt den Satz am Workflow und räumt die Deklarationen am Abschnitt weg', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(nurDiese(
      GA_STANDARDSATZ_MIGRATION,
      [skill(AUSGANGSLAGE_SKILL_ID, {
        regelIds: [PASSIV_REGEL_ID, INTERPUNKTION_REGEL_ID, UEBERSCHRIFTEN_REGEL_ID],
        vorgaben: { wortanzahl: { schweregrad: 'fehler', min: 400, max: 500 }, keineAufzaehlungen: { schweregrad: 'fehler' } },
      })],
      [gaWf()],
    ));
    expect(geaendert).toBe(true);
    expect(out.workflows![0]!.standardRegelIds).toEqual([...GA_STANDARD_REGEL_IDS]);
    expect(out.workflows![0]!.version).toBe(4);
    expect(out.skills[0]!.regelIds).toEqual([]);
    expect(out.skills[0]!.vorgaben?.keineAufzaehlungen).toBeUndefined();
    expect(out.skills[0]!.vorgaben?.wortanzahl?.min).toBe(400);
    expect(out.skills[0]!.version).toBe(2);
  });

  it('E und F bekommen ihre Abwahl geschrieben — sonst erbten sie die Passiv-Regel', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(nurDiese(
      GA_STANDARDSATZ_MIGRATION,
      [skill(UNTERNEHMEN_SKILL_ID, { regelIds: [INTERPUNKTION_REGEL_ID, UEBERSCHRIFTEN_REGEL_ID] })],
      [gaWf()],
    ));
    expect(out.skills[0]!.ohneStandard).toEqual([PASSIV_REGEL_ID]);
    expect(resolveRegeln(out, out.skills[0]!).map(r => r.id)).not.toContain(PASSIV_REGEL_ID);
  });

  it('ein KURATIERTER Schweregrad bleibt stehen — er wird nicht stillschweigend verschärft', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(nurDiese(
      GA_STANDARDSATZ_MIGRATION,
      [skill(KOMPETENZ_SKILL_ID, { vorgaben: { keineAufzaehlungen: { schweregrad: 'hinweis' } } })],
      [gaWf()],
    ));
    expect(out.skills[0]!.vorgaben?.keineAufzaehlungen?.schweregrad).toBe('hinweis');
  });

  it('ein bereits gesetzter Satz am Workflow wird nicht überschrieben', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(nurDiese(
      GA_STANDARDSATZ_MIGRATION, [], [gaWf({ standardRegelIds: ['eigene-regel'] })],
    ));
    expect(out.workflows![0]!.standardRegelIds).toEqual(['eigene-regel']);
  });

  it('ein Share ohne workflows bricht nicht — mergeMissingSeeds bringt sie mit Satz', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(nurDiese(
      GA_STANDARDSATZ_MIGRATION, [skill(KURZFASSUNG_SKILL_ID, { regelIds: [PASSIV_REGEL_ID] })],
    ));
    expect(out.workflows).toBeUndefined();
    expect(out.skills[0]!.regelIds).toEqual([]);
  });

  it('läuft nur einmal: gesetzter Marker lässt die Deklarationen stehen', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen({
      ...file([skill(AUSGANGSLAGE_SKILL_ID, { regelIds: [PASSIV_REGEL_ID] })], [gaWf()]),
      angewandteMigrationen: ALLE_MARKER,
    });
    expect(geaendert).toBe(false);
    expect(out.skills[0]!.regelIds).toEqual([PASSIV_REGEL_ID]);
    expect(out.workflows![0]!.standardRegelIds).toBeUndefined();
  });
});

describe('Migration — der fachliche Prüfer geht an', () => {
  const ALLE_MARKER = reconcileEinmaligeAktivierungen(
    { version: 1, updated_at: 't', skills: [], regeln: [] },
  ).file.angewandteMigrationen ?? [];
  const ohnePrueferAktiv = (skills: SkillRecord[]): SkillRegistryFile => ({
    ...file(skills),
    angewandteMigrationen: ALLE_MARKER.filter(m => m !== GA_PRUEFER_AKTIV_MIGRATION),
  });

  it('der stillgelegte Prüfer wird freigeschaltet', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      ohnePrueferAktiv([skill(QS_BASIS_SKILL_ID, { aktiv: false, version: 2 })]),
    );
    expect(geaendert).toBe(true);
    expect(out.skills[0]!.aktiv).toBe(true);
    expect(out.skills[0]!.version).toBe(3);
  });

  it('der Seed startet ihn an', () => {
    expect(SEED_QS_SKILL.aktiv).toBe(true);
  });

  it('läuft nur einmal: gesetzter Marker lässt ein späteres Abschalten stehen', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen({
      ...file([skill(QS_BASIS_SKILL_ID, { aktiv: false })]),
      angewandteMigrationen: ALLE_MARKER,
    });
    expect(geaendert).toBe(false);
    expect(out.skills[0]!.aktiv).toBe(false);
  });
});
