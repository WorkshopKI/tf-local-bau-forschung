import { describe, it, expect } from 'vitest';
import {
  emptyRun,
  firstNonFreigegeben,
  fruehereInArbeit,
  leereSchritte,
  applyGeneration,
  applyBearbeitung,
  applyLektorat,
  applyZuruecksetzen,
  applyPruefen,
  applyQsHinweise,
  applyLaufZiel,
  applyLaufFassung,
  freigeben,
  erneutOeffnen,
  weiterschalten,
  verwerfen,
  uebernehmen,
  setVorlageRef,
  type GenerationInput,
} from '../runner';
import { ZIM_EP_DEF } from '@/core/services/skills';
import type { QsBefund, WorkflowRun } from '../types';

const NOW = '2026-06-11T10:00:00.000Z';
const LATER = '2026-06-12T10:00:00.000Z';

function gen(finalerText: string, over: Partial<GenerationInput> = {}): GenerationInput {
  return {
    quellenanalyse: 'qa', entwurf: '', finalerText, checks: [],
    modell: 'llama.cpp', skillId: 's', skillVersion: 1, ...over,
  };
}

/** Run mit A+B+C freigegeben, D entwurf, E–G leer (Mockup-Übersicht-Stand). */
function runMitABCfreigegeben(): WorkflowRun {
  let run = emptyRun('16EP051840', NOW);
  for (const id of ['A', 'B', 'C'] as const) {
    run = applyGeneration(run, id, gen(`Text ${id}`), NOW);
    run = freigeben(run, id, NOW);
  }
  run = applyGeneration(run, 'D', gen('Text D'), NOW);
  return run;
}

describe('setVorlageRef', () => {
  it('stempelt den Vorlagen-Audit-Ref und aktualisiert geaendert_am', () => {
    const run = emptyRun('AZ', NOW);
    const next = setVorlageRef(run, { pfad: 'Gutachten_EP.docx', hash: 'abc123', gelesenAm: LATER }, LATER);
    expect(next.vorlageRef).toEqual({ pfad: 'Gutachten_EP.docx', hash: 'abc123', gelesenAm: LATER });
    expect(next.geaendert_am).toBe(LATER);
    expect(run.vorlageRef).toBeUndefined(); // Original unverändert (immutabel)
  });
});

describe('emptyRun', () => {
  it('startet bei A mit leeren Schritten', () => {
    const run = emptyRun('AZ', NOW);
    expect(run.aktiverSchritt).toBe('A');
    expect(run.schritte).toEqual({});
    expect(run.schemaVersion).toBe(1);
  });
});

describe('applyGeneration', () => {
  it('setzt einen Entwurf ein, ohne aktiverSchritt zu ändern', () => {
    const run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Hallo'), NOW);
    expect(run.schritte.A?.status).toBe('entwurf');
    expect(run.schritte.A?.finalerText).toBe('Hallo');
    expect(run.aktiverSchritt).toBe('A');
    expect(run.schritte.A?.verlauf).toEqual([]);
  });

  it('hängt die bisher aktive Fassung in den Verlauf', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Erst'), NOW);
    run = applyGeneration(run, 'A', gen('Zweit', { modifier: 'laenger' }), LATER);
    expect(run.schritte.A?.finalerText).toBe('Zweit');
    expect(run.schritte.A?.verlauf).toHaveLength(1);
    expect(run.schritte.A?.verlauf?.[0]?.finalerText).toBe('Erst');
  });

  it('persistiert korrekturRegelId, wenn ein Korrektur-Lauf sie mitgibt (sonst absent)', () => {
    const ohne = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Regulär'), NOW);
    expect(ohne.schritte.A?.korrekturRegelId).toBeUndefined();
    const mit = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Korrigiert', { modifier: 'kuerzer', korrekturRegelId: 'seed-zeichen-max' }), NOW);
    expect(mit.schritte.A?.korrekturRegelId).toBe('seed-zeichen-max');
    expect(mit.schritte.A?.modifier).toBe('kuerzer');
  });

  it('persistiert die freie Überarbeitungs-Anweisung (sonst absent)', () => {
    const ohne = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Regulär'), NOW);
    expect(ohne.schritte.A?.anweisung).toBeUndefined();
    const mit = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Überarbeitet', { anweisung: 'Risiken kürzen' }), NOW);
    expect(mit.schritte.A?.anweisung).toBe('Risiken kürzen');
    // Freie Anweisung ist KEIN Modifier — die Modifier-Anzeige bleibt leer.
    expect(mit.schritte.A?.modifier).toBeUndefined();
  });

  it('die Anweisung wandert mit der Fassung in den Verlauf und haftet nicht am nächsten Lauf', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Erst', { anweisung: 'Risiken kürzen' }), NOW);
    run = applyGeneration(run, 'A', gen('Zweit'), LATER);
    expect(run.schritte.A?.verlauf?.[0]?.anweisung).toBe('Risiken kürzen');
    expect(run.schritte.A?.anweisung).toBeUndefined();
  });
});

describe('applyPruefen', () => {
  it('ersetzt die Checks eines Schritts', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('x'), NOW);
    run = applyPruefen(run, 'A', [{ id: 'r', level: 'fehler', label: 'L' }], NOW);
    expect(run.schritte.A?.checks).toHaveLength(1);
    expect(run.schritte.A?.checks[0]?.level).toBe('fehler');
  });
  it('no-op bei leerem Schritt', () => {
    const run = applyPruefen(emptyRun('AZ', NOW), 'B', [{ id: 'r', level: 'ok', label: 'L' }], NOW);
    expect(run.schritte.B).toBeUndefined();
  });
});

describe('applyBearbeitung', () => {
  const chk = [{ id: 'r', level: 'ok' as const, label: 'L' }];

  it('setzt den editierten Text + Checks, snapshottet den Originaltext, ohne Status/Verlauf', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Generiert', { checks: [{ id: 'x', level: 'fehler', label: 'L' }] }), NOW);
    run = applyBearbeitung(run, 'A', 'Editiert', chk, LATER);
    expect(run.schritte.A?.finalerText).toBe('Editiert');
    expect(run.schritte.A?.originalText).toBe('Generiert'); // Snapshot des generierten Texts
    expect(run.schritte.A?.checks).toEqual(chk);            // frisch übernommen
    expect(run.schritte.A?.status).toBe('entwurf');         // kein Status-Wechsel
    expect(run.schritte.A?.verlauf).toEqual([]);            // kein Verlaufs-Eintrag
    expect(run.geaendert_am).toBe(LATER);
  });

  it('behält den ersten Snapshot über mehrere Edits', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Generiert'), NOW);
    run = applyBearbeitung(run, 'A', 'Edit 1', chk, LATER);
    run = applyBearbeitung(run, 'A', 'Edit 2', chk, LATER);
    expect(run.schritte.A?.finalerText).toBe('Edit 2');
    expect(run.schritte.A?.originalText).toBe('Generiert'); // unverändert, nicht „Edit 1"
  });

  it('verwirft den Snapshot, wenn der Nutzer auf den Originaltext zurück-editiert', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Generiert'), NOW);
    run = applyBearbeitung(run, 'A', 'Editiert', chk, LATER);
    run = applyBearbeitung(run, 'A', 'Generiert', chk, LATER);
    expect(run.schritte.A?.finalerText).toBe('Generiert');
    expect(run.schritte.A?.originalText).toBeUndefined();   // Badge verschwindet
  });

  it('no-op bei leerem Schritt', () => {
    const run = applyBearbeitung(emptyRun('AZ', NOW), 'B', 'x', chk, NOW);
    expect(run.schritte.B).toBeUndefined();
  });
});

describe('applyLektorat (sprachlicher Feinschliff)', () => {
  const chk = [{ id: 'r', level: 'ok' as const, label: 'L' }];
  const lektorat = { finalerText: 'Redigiert', checks: chk, modell: 'qwen' };

  it('ersetzt Text/Checks/Modell, markiert lektoriert und schiebt die Vorfassung in den Verlauf', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Generiert'), NOW);
    run = applyLektorat(run, 'A', lektorat, LATER);
    const a = run.schritte.A!;
    expect(a.finalerText).toBe('Redigiert');
    expect(a.checks).toEqual(chk);
    expect(a.modell).toBe('qwen');
    expect(a.lektoriert).toBe(true);
    expect(a.erstellt_am).toBe(LATER);
    expect(a.verlauf?.map(v => v.finalerText)).toEqual(['Generiert']); // Rückgriff möglich
    expect(run.geaendert_am).toBe(LATER);
  });

  it('lässt Status, Belege, QS-Hinweise und den Bearbeitet-Snapshot unangetastet', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Generiert', {
      belege: [{ zitat: 'Z', satzIndizes: [0] }],
    }), NOW);
    run = applyBearbeitung(run, 'A', 'Editiert', chk, LATER);
    run = applyQsHinweise(run, 'A', [{ dimension: 'Ton', bewertung: 'hinweis', text: 't' }], LATER);
    run = applyLektorat(run, 'A', lektorat, LATER);
    const a = run.schritte.A!;
    expect(a.status).toBe('entwurf');
    expect(a.belege).toEqual([{ zitat: 'Z', satzIndizes: [0] }]);
    expect(a.qsHinweise).toHaveLength(1);
    expect(a.originalText).toBe('Generiert'); // „Zurücksetzen" bleibt möglich
  });

  it('verwirft strukturierte Teile (der flache Text ist danach maßgeblich)', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('T1\n\nT2', {
      teile: [{ key: 'a', label: 'A', text: 'T1' }, { key: 'b', label: 'B', text: 'T2' }],
    }), NOW);
    run = applyLektorat(run, 'A', lektorat, LATER);
    expect(run.schritte.A?.teile).toBeUndefined();
  });

  it('no-op bei leerem Schritt', () => {
    const run = applyLektorat(emptyRun('AZ', NOW), 'B', lektorat, NOW);
    expect(run.schritte.B).toBeUndefined();
  });
});

describe('applyZuruecksetzen', () => {
  const chk = [{ id: 'r', level: 'ok' as const, label: 'L' }];

  it('stellt den Originaltext wieder her und löscht den Snapshot', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Generiert'), NOW);
    run = applyBearbeitung(run, 'A', 'Editiert', chk, LATER);
    run = applyZuruecksetzen(run, 'A', chk, LATER);
    expect(run.schritte.A?.finalerText).toBe('Generiert');
    expect(run.schritte.A?.originalText).toBeUndefined();
  });

  it('no-op ohne Snapshot (nie bearbeitet)', () => {
    const run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Generiert'), NOW);
    const same = applyZuruecksetzen(run, 'A', chk, LATER);
    expect(same).toBe(run); // unverändert
  });
});

describe('applyQsHinweise', () => {
  const befund = (dimension: string, bewertung: QsBefund['bewertung']): QsBefund => ({ dimension, bewertung, text: 't' });

  it('setzt beratende Befunde am Schritt, ohne Status/Text zu ändern', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Text A', { checks: [{ id: 'r', level: 'ok', label: 'L' }] }), NOW);
    run = applyQsHinweise(run, 'A', [befund('Erdung in der VB', 'hinweis')], LATER);
    expect(run.schritte.A?.qsHinweise).toHaveLength(1);
    expect(run.schritte.A?.qsHinweise?.[0]?.bewertung).toBe('hinweis');
    expect(run.schritte.A?.status).toBe('entwurf');   // kein Status-Wechsel
    expect(run.schritte.A?.finalerText).toBe('Text A'); // kein Overwrite
    expect(run.schritte.A?.checks).toHaveLength(1);      // checks unberührt
  });

  it('überschreibt vorhandene Befunde', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Text A'), NOW);
    run = applyQsHinweise(run, 'A', [befund('Ton', 'hinweis')], NOW);
    run = applyQsHinweise(run, 'A', [befund('Ton', 'ok'), befund('Kohärenz', 'ok')], LATER);
    expect(run.schritte.A?.qsHinweise).toHaveLength(2);
    expect(run.schritte.A?.qsHinweise?.[0]?.bewertung).toBe('ok');
  });

  it('no-op bei leerem Schritt (man bewertet nur Generiertes)', () => {
    const run0 = emptyRun('AZ', NOW);
    expect(applyQsHinweise(run0, 'B', [befund('Ton', 'ok')], NOW)).toBe(run0);
  });

  it('lässt das Eingabe-Objekt unangetastet (Immutabilität)', () => {
    const run0 = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Text A'), NOW);
    const run1 = applyQsHinweise(run0, 'A', [befund('Ton', 'ok')], LATER);
    expect(run1).not.toBe(run0);
    expect(run0.schritte.A?.qsHinweise).toBeUndefined();
  });
});

describe('leereSchritte (Bulk „Alle Abschnitte erstellen" — nur fehlende)', () => {
  it('liefert die noch fehlenden Abschnitte in Order-Reihenfolge', () => {
    // A+B+C freigegeben, D entwurf → fehlend: E, F, G.
    expect(leereSchritte(runMitABCfreigegeben())).toEqual(['E', 'F', 'G']);
  });

  it('alle leer → alle Abschnitte', () => {
    expect(leereSchritte(emptyRun('AZ', NOW))).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });

  it('nichts fehlend → leere Liste (Button bleibt aus)', () => {
    let run = emptyRun('AZ', NOW);
    for (const id of ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const) run = applyGeneration(run, id, gen(`T${id}`), NOW);
    expect(leereSchritte(run)).toEqual([]);
  });

  it('Entwürfe + Freigaben gelten als vorhanden (werden NICHT erneut erzeugt)', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Text A'), NOW); // A entwurf
    run = applyGeneration(run, 'B', gen('Text B'), NOW);
    run = freigeben(run, 'B', NOW); // B freigegeben
    expect(leereSchritte(run)).toEqual(['C', 'D', 'E', 'F', 'G']);
  });

  it('folgt einer abweichenden Order (autoritativ)', () => {
    const run = applyGeneration(emptyRun('AZ', NOW), 'B', gen('Text B'), NOW); // nur B vorhanden
    expect(leereSchritte(run, ['B', 'A', 'C'])).toEqual(['A', 'C']);
  });
});

describe('freigeben', () => {
  it('setzt freigegeben + Hash und rückt aktiverSchritt vor', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Text A'), NOW);
    run = freigeben(run, 'A', NOW);
    expect(run.schritte.A?.status).toBe('freigegeben');
    expect(run.schritte.A?.freigegeben_am).toBe(NOW);
    expect(run.schritte.A?.freigabeHash).toBeTruthy();
    expect(run.aktiverSchritt).toBe('B'); // nächster nicht-freigegebener
  });

  it('bei allen freigegeben bleibt aktiverSchritt am letzten', () => {
    let run = emptyRun('AZ', NOW);
    for (const id of ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const) {
      run = applyGeneration(run, id, gen(`T${id}`), NOW);
      run = freigeben(run, id, NOW);
    }
    expect(run.aktiverSchritt).toBe('G');
    expect(firstNonFreigegeben(run)).toBe('G');
  });

  it('no-op bei leerem Schritt', () => {
    const run = freigeben(emptyRun('AZ', NOW), 'A', NOW);
    expect(run.schritte.A).toBeUndefined();
  });
});

describe('erneutOeffnen', () => {
  it('setzt NUR diesen Schritt zurück, spätere bleiben freigegeben', () => {
    const run0 = runMitABCfreigegeben();
    const run = erneutOeffnen(run0, 'B', LATER);
    expect(run.schritte.B?.status).toBe('entwurf');
    expect(run.schritte.B?.freigegeben_am).toBeUndefined();
    expect(run.schritte.B?.freigabeHash).toBeUndefined();
    expect(run.schritte.A?.status).toBe('freigegeben'); // früher bleibt
    expect(run.schritte.C?.status).toBe('freigegeben'); // später bleibt!
    expect(run.aktiverSchritt).toBe('B');
  });

  it('macht den Konsistenz-Hinweis auf späteren freigegebenen Schritten sichtbar', () => {
    const run = erneutOeffnen(runMitABCfreigegeben(), 'B', LATER);
    expect(fruehereInArbeit(run, 'C')).toBe(true); // C ist freigegeben, B (früher) in Arbeit
    expect(fruehereInArbeit(run, 'A')).toBe(false);
  });

  it('no-op bei nicht-freigegebenem Schritt', () => {
    const run0 = runMitABCfreigegeben(); // D ist entwurf
    expect(erneutOeffnen(run0, 'D', LATER)).toBe(run0);
  });
});

describe('weiterschalten / verwerfen / uebernehmen', () => {
  it('weiterschalten ändert nur den Fokus', () => {
    const run0 = runMitABCfreigegeben();
    const run = weiterschalten(run0, 'D', LATER);
    expect(run.aktiverSchritt).toBe('D');
    expect(run.schritte).toEqual(run0.schritte);
  });

  it('verwerfen entfernt den Schritt und fokussiert ihn', () => {
    const run = verwerfen(runMitABCfreigegeben(), 'D', LATER);
    expect(run.schritte.D).toBeUndefined();
    expect(run.aktiverSchritt).toBe('D');
  });

  it('uebernehmen holt eine Vorfassung zurück (Status entwurf)', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Erst'), NOW);
    run = applyGeneration(run, 'A', gen('Zweit', { modifier: 'laenger' }), LATER);
    run = freigeben(run, 'A', LATER);
    run = uebernehmen(run, 'A', 0, LATER); // Index 0 = „Erst"
    expect(run.schritte.A?.finalerText).toBe('Erst');
    expect(run.schritte.A?.status).toBe('entwurf');
    expect(run.schritte.A?.freigegeben_am).toBeUndefined();
    expect(run.aktiverSchritt).toBe('A');
  });
});

describe('Reihenfolge als Datenparameter (Seed-Def == STEP_ORDER, aber Order steuert)', () => {
  const epOrder = ZIM_EP_DEF.steps.map(s => s.id); // ['A'..'G']

  it('explizite zim-ep-Seed-Order ist verhaltensgleich zum STEP_ORDER-Default', () => {
    const run = runMitABCfreigegeben(); // A,B,C freigegeben; D entwurf
    expect(firstNonFreigegeben(run, epOrder)).toBe(firstNonFreigegeben(run));
    expect(firstNonFreigegeben(run, epOrder)).toBe('D');
    expect(fruehereInArbeit(erneutOeffnen(run, 'B', LATER), 'C', epOrder))
      .toBe(fruehereInArbeit(erneutOeffnen(run, 'B', LATER), 'C'));
  });

  it('freigeben rückt mit expliziter Seed-Order identisch vor', () => {
    const run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Text A'), NOW);
    expect(freigeben(run, 'A', NOW, epOrder).aktiverSchritt)
      .toBe(freigeben(run, 'A', NOW).aktiverSchritt);
    expect(freigeben(run, 'A', NOW, epOrder).aktiverSchritt).toBe('B');
  });

  it('eine ABWEICHENDE Reihenfolge ändert das Vorrücken (Order ist autoritativ)', () => {
    // Custom-Order B→A→C: nach Freigabe von B ist der erste offene Schritt A.
    const run = applyGeneration(emptyRun('AZ', NOW), 'B', gen('Text B'), NOW);
    expect(freigeben(run, 'B', NOW, ['B', 'A', 'C']).aktiverSchritt).toBe('A');
    // Und fruehereInArbeit folgt der Custom-Order: in [B,A] ist B (entwurf) VOR A.
    const r2 = applyGeneration(emptyRun('AZ', NOW), 'B', gen('Entwurf B'), NOW);
    expect(fruehereInArbeit(r2, 'A', ['B', 'A', 'C'])).toBe(true);
    expect(fruehereInArbeit(r2, 'A', ['A', 'B', 'C'])).toBe(false); // Default-Order: B liegt nach A
  });
});

/**
 * Am lokalen llama.cpp beobachtet: die Fußzeile schrieb „· Standard-KI" unter einen
 * Text, der nie über die Bridge lief. Ursache war nicht der Stempel selbst, sondern
 * der ALTE Stempel — der Schritt wird fortgeschrieben, nicht ersetzt.
 */
describe('applyLaufZiel', () => {
  const mitZiel = applyLaufZiel(applyGeneration(emptyRun('AZ', NOW), 'A', gen('Text'), NOW), 'A', 'agentisch', NOW);

  it('hält fest, welche interne KI den Text erzeugt hat', () => {
    expect(mitZiel.schritte.A?.ziel).toBe('agentisch');
  });

  it('entfernt den Stempel, wenn das Ziel auf diesem Transport nicht wirkt', () => {
    const ohne = applyLaufZiel(mitZiel, 'A', null, LATER);
    expect(ohne.schritte.A?.ziel).toBeUndefined();
    expect('ziel' in (ohne.schritte.A ?? {})).toBe(false);
    expect(ohne.schritte.A?.finalerText).toBe('Text'); // sonst unverändert
  });

  it('ist ein No-op ohne Schritt', () => {
    const leer = emptyRun('AZ', NOW);
    expect(applyLaufZiel(leer, 'A', null, LATER)).toBe(leer);
  });
});

describe('applyLaufFassung', () => {
  const basis = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Text'), NOW);

  it('markiert die mutigere Einstellung', () => {
    expect(applyLaufFassung(basis, 'A', true, NOW).schritte.A?.fassung).toBe('mutig');
  });

  it('entfernt den Marker beim nächsten Standard-Lauf', () => {
    const mutig = applyLaufFassung(basis, 'A', true, NOW);
    const zurueck = applyLaufFassung(mutig, 'A', false, LATER);
    expect('fassung' in (zurueck.schritte.A ?? {})).toBe(false);
    expect(zurueck.schritte.A?.finalerText).toBe('Text');
  });

  it('fasst den Normalfall gar nicht an (kein Marker, kein Zeitstempel-Wechsel)', () => {
    expect(applyLaufFassung(basis, 'A', false, LATER)).toBe(basis);
  });
});

describe('Wiederaufnahme aus persistiertem Stand', () => {
  it('aktiverSchritt + Schritt-Status überleben eine Round-Trip-Serialisierung', () => {
    const run0 = runMitABCfreigegeben();
    const wieder = JSON.parse(JSON.stringify(run0)) as WorkflowRun;
    expect(wieder.aktiverSchritt).toBe('D');
    expect(wieder.schritte.A?.status).toBe('freigegeben');
    expect(wieder.schritte.D?.status).toBe('entwurf');
    // Reducer arbeiten unverändert auf dem rehydrierten Stand weiter:
    const fort = freigeben(wieder, 'D', LATER);
    expect(fort.aktiverSchritt).toBe('E');
  });
});
