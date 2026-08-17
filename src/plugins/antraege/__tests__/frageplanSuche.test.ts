/**
 * Die Wortlaut-Stufe mit einem Frageplan.
 *
 * Zwei Zusagen werden hier festgehalten:
 *
 *  1. **Ohne Plan bewegt sich nichts.** `planTeile` ist optional; fehlt es, läuft
 *     die Stufe wie zuvor. Die bestehenden Suchtests (`substring-verknuepfung`,
 *     `korpusFelder`) sind der eigentliche Beleg dafür — hier steht nur der
 *     direkte Vergleich Anfrage ⇄ gleichwertiger Plan.
 *  2. **Die Abdeckung zählt SACHEN, nicht Schreibweisen.** Das ist der Grund für
 *     die Gruppierung: `abdeckung` geht in `berechneRelevanz` ein, und ein
 *     Vorhaben, das eine von zwei gefragten Sachen behandelt, muss 0,5 bekommen —
 *     unabhängig davon, ob die KI für die eine Sache zwei oder zwölf
 *     Schreibweisen genannt hat.
 */
import { describe, it, expect } from 'vitest';
import { searchAntraegeWortlaut } from '../services/antraege-search-service';
import {
  domainSuchform, standortSuchform, type AntragTextEntry,
} from '../services/search-corpus';
import type { PlanBegriff } from '@/core/services/search/frageplan';

function eintrag(felder: Partial<AntragTextEntry>): AntragTextEntry {
  const basis: AntragTextEntry = {
    vb: '', tv: '', abstract: '', descriptors: '', akronym: '',
    vbLower: '', tvLower: '', absLower: '', descriptorsLower: '', akronymLower: '',
    akzLower: '', organisation: '', organisationLower: '',
    standort: '', standortSuchform: '', bundesland: '', bundeslandSuchform: '',
    domain: '', domainSuchform: '',
    netzwerk: '', netzwerkLower: '', notiz: '', notizLower: '',
    wahlkreis: '', wahlkreisSuchform: '', verbundNr: '', verbundNrLower: '',
    ...felder,
  };
  // Suchformen IMMER aus den Werten ableiten — ein Test darf keine Suchform
  // setzen können, die zu ihrem Wert nicht passt.
  return {
    ...basis,
    vbLower: basis.vb.toLowerCase(),
    tvLower: basis.tv.toLowerCase(),
    absLower: basis.abstract.toLowerCase(),
    descriptorsLower: basis.descriptors.toLowerCase(),
    akronymLower: basis.akronym.toLowerCase(),
    organisationLower: basis.organisation.toLowerCase(),
    netzwerkLower: basis.netzwerk.toLowerCase(),
    notizLower: basis.notiz.toLowerCase(),
    verbundNrLower: basis.verbundNr.toLowerCase(),
    standortSuchform: standortSuchform(basis.standort),
    bundeslandSuchform: standortSuchform(basis.bundesland),
    wahlkreisSuchform: standortSuchform(basis.wahlkreis),
    domainSuchform: domainSuchform(basis.domain),
  };
}

/** Nur Normung — eine der beiden gefragten Sachen. */
const NUR_NORMUNG = eintrag({ vb: 'Normung und Normen im Maschinenbau' });
/** Beide Sachen — das Vorhaben, das die Frage wirklich beantwortet. */
const BEIDES = eintrag({ vb: 'Normung', abstract: 'Standardisierung von Schnittstellen' });
/** Weder noch, aber in Bayern. */
const NUR_BAYERN = eintrag({ vb: 'Leichtbau für Fahrzeuge', standort: 'München Bayern' });
/** Thema und Ort. */
const NORMUNG_BAYERN = eintrag({ vb: 'Normung im Leichtbau', standort: 'Augsburg Bayern' });
/** Thema, aber anderswo. */
const NORMUNG_SACHSEN = eintrag({ vb: 'Normung im Leichtbau', standort: 'Dresden Sachsen' });

const KORPUS = new Map<string, AntragTextEntry>([
  ['A', NUR_NORMUNG], ['B', BEIDES], ['C', NUR_BAYERN],
  ['D', NORMUNG_BAYERN], ['E', NORMUNG_SACHSEN],
]);

function begriff(
  b: string, nadeln: string[], extra: Partial<PlanBegriff> = {},
): PlanBegriff {
  return { begriff: b, nadeln, pflicht: false, ...extra };
}

function lauf(plan: PlanBegriff[], query = 'Welche Vorhaben gibt es dazu?'): Map<string, number> {
  const { treffer } = searchAntraegeWortlaut(query, KORPUS, {
    verknuepfung: 'oder', planTeile: plan,
  });
  return new Map([...treffer].map(([akz, t]) => [akz, t.abdeckung]));
}

describe('Frageplan — die Frage im Feld wird NICHT mitgesucht', () => {
  it('ignoriert den Anfragetext vollständig', () => {
    // „Welche", „Vorhaben", „Fahrzeuge" stehen im Korpus bzw. in der Frage —
    // gesucht wird trotzdem ausschliesslich nach den Leitbegriffen.
    const treffer = lauf([begriff('Normung', ['normung'])], 'Welche Vorhaben zu Fahrzeugen?');
    expect([...treffer.keys()].sort()).toEqual(['A', 'B', 'D', 'E']);
  });

  it('liefert ohne Plan dasselbe wie die gleichwertige getippte Anfrage', () => {
    const ohnePlan = searchAntraegeWortlaut('normung', KORPUS, { verknuepfung: 'oder' });
    const mitPlan = searchAntraegeWortlaut('unsinniger fragetext', KORPUS, {
      verknuepfung: 'oder', planTeile: [begriff('normung', ['normung'])],
    });
    expect([...mitPlan.treffer.keys()].sort()).toEqual([...ohnePlan.treffer.keys()].sort());
  });
});

describe('Frageplan — die Abdeckung zählt Sachen, nicht Schreibweisen', () => {
  const ZWEI_SACHEN_KNAPP = [
    begriff('Normung', ['normung', 'normen']),
    begriff('Standards', ['standardisierung']),
  ];
  const ZWEI_SACHEN_REICH = [
    begriff('Normung', ['normung', 'normen', 'normier', 'normvorgabe', 'normenwerk']),
    begriff('Standards', ['standardisierung', 'standardvorgabe']),
  ];

  it('gibt einem Vorhaben mit BEIDEN Sachen die volle Abdeckung', () => {
    expect(lauf(ZWEI_SACHEN_KNAPP).get('B')).toBe(1);
  });

  it('gibt einem Vorhaben mit EINER von zwei Sachen genau die Hälfte', () => {
    expect(lauf(ZWEI_SACHEN_KNAPP).get('A')).toBe(0.5);
  });

  it('ist unabhängig von der Zahl der Schreibweisen je Sache', () => {
    // Der eigentliche Beleg für die Gruppierung: derselbe Antrag, dieselben zwei
    // Sachen, einmal mit 3 und einmal mit 7 Nadeln — dieselbe Zahl. Lägen die
    // Schreibweisen als eigene Teile daneben, stünde hier 0,4 gegen 0,29.
    expect(lauf(ZWEI_SACHEN_REICH).get('A')).toBe(lauf(ZWEI_SACHEN_KNAPP).get('A'));
    expect(lauf(ZWEI_SACHEN_REICH).get('B')).toBe(lauf(ZWEI_SACHEN_KNAPP).get('B'));
  });

  it('zählt eine Sache nur EINMAL, auch wenn mehrere ihrer Nadeln treffen', () => {
    // „Normung" UND „Normen" stehen beide in A — trotzdem ist es eine Sache.
    expect(lauf([begriff('Normung', ['normung', 'normen'])]).get('A')).toBe(1);
  });
});

describe('Frageplan — Einschränkungen gelten, Themen bleiben Alternativen', () => {
  const NORMUNG_IN_BAYERN = [
    begriff('Normung', ['normung']),
    begriff('Bayern', ['bayern'], { pflicht: true, feld: 'standort' }),
  ];

  it('nimmt nur Vorhaben, die die Einschränkung erfüllen', () => {
    expect([...lauf(NORMUNG_IN_BAYERN).keys()]).toEqual(['D']);
  });

  it('lässt ein Vorhaben ohne Thema draußen, auch wenn der Ort passt', () => {
    // Wäre „Bayern" ein gleichrangiger ODER-Begriff, käme C hier mit — genau der
    // Fehler, gegen den das Pflicht-Kennzeichen geschrieben ist.
    expect(lauf(NORMUNG_IN_BAYERN).has('C')).toBe(false);
  });

  it('zählt die erfüllte Einschränkung NICHT in die Abdeckung', () => {
    // 1 von 1 Thema — nicht 2 von 2. Sonst hübe jede Einschränkung die Relevanz
    // aller überlebenden Treffer gleichmäßig an.
    expect(lauf(NORMUNG_IN_BAYERN).get('D')).toBe(1);
  });

  it('verlangt ALLE Einschränkungen, auch bei ODER-Themen', () => {
    const zwei = [
      begriff('Normung', ['normung']),
      begriff('Leichtbau', ['leichtbau']),
      begriff('Sachsen', ['sachsen'], { pflicht: true, feld: 'standort' }),
    ];
    expect([...lauf(zwei).keys()]).toEqual(['E']);
  });
});

describe('Frageplan — Feldbindung und verankerte Ortsnadeln', () => {
  it('bindet einen Begriff an sein Feld', () => {
    // „Leichtbau" steht im Titel von C und D, nicht im Standort — mit Feldbindung
    // auf `standort` darf es dort nichts finden.
    const treffer = lauf([begriff('Leichtbau', ['leichtbau'], { feld: 'standort' })]);
    expect(treffer.size).toBe(0);
  });

  it('verankert JEDE Nadel am Wortanfang, nicht nur die erste', () => {
    // Beide Schreibweisen müssen den Ort finden; die zweite darf nicht
    // durchfallen, weil nur die erste verankert wurde.
    expect([...lauf([begriff('Bayern', ['freistaat', 'bayern'])]).keys()]).toEqual(['C', 'D']);
  });

  it('trifft mit einer Ortsnadel nicht mitten im Wort', () => {
    // „ugsburg" steckt in „Augsburg" — die Verankerung verhindert den Treffer.
    expect(lauf([begriff('Ort', ['ugsburg'])]).size).toBe(0);
  });
});

describe('Frageplan — was herausfällt', () => {
  it('verwirft einen Begriff ohne Nadeln, statt alles zu treffen', () => {
    const treffer = lauf([
      begriff('Leer', []),
      begriff('Normung', ['normung']),
    ]);
    // Ein leerer Teil würde über `''.includes('')` jeden Eintrag treffen und die
    // Abdeckung verwässern. Übrig bleibt genau die eine echte Sache.
    expect([...treffer.keys()].sort()).toEqual(['A', 'B', 'D', 'E']);
    expect(treffer.get('A')).toBe(1);
  });

  it('liefert nichts, wenn der Plan nur leere Begriffe trägt', () => {
    expect(lauf([begriff('Leer', [])]).size).toBe(0);
  });
});
