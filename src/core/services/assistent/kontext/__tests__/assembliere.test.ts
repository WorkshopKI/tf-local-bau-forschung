/**
 * Tests des deterministischen Kontext-Assemblers (Assistent-Panel, Phase 1).
 *
 * Deckt die sechs geforderten Invarianten: (1) Determinismus; (2) fixe
 * Blockreihenfolge; (3) Budget-Kürzung in definierter Reihenfolge (Historie vor
 * Retrieval, Faktenblock nie); (4) gültiger Prompt ohne Entität; (5) Score-
 * Schwelle verwirft schwache Treffer; (6) verwendeteTreffer == eingebundene [n].
 */
import { describe, expect, it } from 'vitest';
import {
  assembliereAssistentKontext,
  GESAMT_MAX_CHARS,
  RETRIEVAL_K,
  RETRIEVAL_MIN_SCORE,
} from '../index';
import type { AssistentKontextEingabe, KontextEntitaet } from '../types';
import type { OramaSearchResult } from '@/core/services/search/orama-store';

function treffer(id: string, score: number, text = `Auszug ${id}`): OramaSearchResult {
  return { id, text, title: `Doc ${id}`, source: `${id}.pdf`, tags: [], type: 'dokument', score, method: 'hybrid' };
}

const entitaet: KontextEntitaet = {
  art: 'verbund',
  id: '16EP1234',
  titel: 'Musterbau',
  status: 'VN geprüft',
  phaseLabel: 'FuE-Phase',
  fristHinweis: 'in 45 T (im Zeitplan)',
  fristenAnzahl: 2,
  stammdaten: [{ label: 'Fördersumme', wert: '250.000 €' }],
};

function base(overrides: Partial<AssistentKontextEingabe> = {}): AssistentKontextEingabe {
  return {
    routeBeschreibung: 'Detailseite Verbund',
    entitaet,
    frage: 'Was ist mein nächster Schritt?',
    turns: [],
    treffer: null,
    ...overrides,
  };
}

describe('assembliereAssistentKontext', () => {
  it('(1) ist deterministisch — gleiche Eingabe ⇒ byte-identischer Prompt', () => {
    const eingabe = base({ treffer: [treffer('a', 0.8), treffer('b', 0.6)], turns: [{ rolle: 'nutzer', text: 'Hi' }] });
    expect(assembliereAssistentKontext(eingabe).promptText).toBe(assembliereAssistentKontext(eingabe).promptText);
  });

  it('(2) hält die feste Blockreihenfolge System → Fakten → Retrieval → Historie → Frage ein', () => {
    const { promptText } = assembliereAssistentKontext(base({
      treffer: [treffer('a', 0.8)],
      turns: [{ rolle: 'nutzer', text: 'frühere Frage' }],
    }));
    const iSystem = promptText.indexOf('Du bist der Assistent in TeamFlow Local');
    const iFakten = promptText.indexOf('=== Kontext (deterministisch');
    const iRetrieval = promptText.indexOf('=== Auszüge aus den Dokumenten');
    const iHistorie = promptText.indexOf('=== Bisheriger Gesprächsverlauf');
    const iFrage = promptText.indexOf('=== Frage ===');
    expect(iSystem).toBeGreaterThanOrEqual(0);
    expect(iSystem).toBeLessThan(iFakten);
    expect(iFakten).toBeLessThan(iRetrieval);
    expect(iRetrieval).toBeLessThan(iHistorie);
    expect(iHistorie).toBeLessThan(iFrage);
  });

  // Prompt-Audit 2026-07: hier lag GRUNDSATZ_REGELN — ein Block, der auf die Erstellung
  // von ZIM-Gutachtentext gemünzt ist. Im Assistenten erzeugte er drei Widersprüche:
  // „ausschließlich Inhalte der VB" schließt den tragenden Faktenblock (Status, Fristen)
  // aus; der Token `[Im Antrag nicht genannt]` konkurriert mit zwei anderen Regeln für
  // denselben Fall; und „keine AP-Verweise" verbietet die Antwort auf „Was steckt in
  // AP1?" ohne Alternative. Jetzt die quellen-agnostische Variante.
  it('(2b) bindet die quellen-agnostische Quellentreue ein, nicht die Gutachten-Regeln', () => {
    const { promptText } = assembliereAssistentKontext(base());
    expect(promptText).toContain('Streng quellenbasiert');
    expect(promptText).toContain('die oben bereitgestellten Angaben');
    // Gutachten-spezifische Auflagen gehören hier nicht hin.
    expect(promptText).not.toContain('Keine Arbeitspaket-Verweise');
    expect(promptText).not.toContain('[Im Antrag nicht genannt]');
    expect(promptText).not.toContain('Nutze ausschließlich Inhalte der VB');
  });

  it('(3) kürzt Historie (älteste zuerst), bevor Retrieval angetastet wird; Faktenblock bleibt', () => {
    // Großer Faktenblock (Stammdaten) drückt das Ganze über das Gesamt-Budget.
    const grosseStammdaten = Array.from({ length: 30 }, (_, i) => ({
      label: `Feld ${i}`,
      wert: 'x'.repeat(600),
    }));
    const turns = Array.from({ length: 8 }, (_, i) => ({
      rolle: i % 2 === 0 ? ('nutzer' as const) : ('assistent' as const),
      text: `TURN_${i} ${'y'.repeat(1000)}`,
    }));
    const { promptText, verwendeteTreffer } = assembliereAssistentKontext(base({
      entitaet: { ...entitaet, stammdaten: grosseStammdaten },
      treffer: [treffer('a', 0.9), treffer('b', 0.8), treffer('c', 0.7)],
      turns,
    }));
    // Retrieval bleibt vollständig erhalten, Faktenblock (Stammdaten) auch.
    expect(verwendeteTreffer).toHaveLength(3);
    expect(promptText).toContain('Feld 29:');
    expect(promptText).toContain('=== Auszüge aus den Dokumenten');
    // Der älteste Turn wurde verworfen, der neueste bleibt.
    expect(promptText).not.toContain('TURN_0');
    expect(promptText).toContain('TURN_7');
    expect(promptText.length).toBeLessThanOrEqual(GESAMT_MAX_CHARS);
  });

  it('(4) erzeugt ohne Entität einen gültigen Prompt ohne Faktenblock-Reste', () => {
    const { promptText, kontextBeschreibung } = assembliereAssistentKontext(base({ entitaet: null }));
    expect(promptText).toContain('Keine Entität ausgewählt');
    expect(promptText).toContain('Was ist mein nächster Schritt?');
    expect(promptText).not.toContain('Status:');
    expect(promptText).not.toContain('Nächster Schritt:');
    expect(promptText).not.toContain('Frist:');
    expect(kontextBeschreibung).toBe('Detailseite Verbund');
  });

  it('(5) verwirft Treffer unter der Score-Schwelle → kein Retrieval-Block', () => {
    const schwach = RETRIEVAL_MIN_SCORE - 0.05;
    const { promptText, verwendeteTreffer } = assembliereAssistentKontext(base({
      treffer: [treffer('a', schwach), treffer('b', schwach / 2)],
    }));
    expect(verwendeteTreffer).toHaveLength(0);
    expect(promptText).not.toContain('=== Auszüge aus den Dokumenten');
    expect(promptText).toContain('=== Frage ===');
  });

  it('(6) verwendeteTreffer enthält genau die eingebundenen [n] (top-k, sortiert)', () => {
    const many = Array.from({ length: RETRIEVAL_K + 2 }, (_, i) => treffer(`t${i}`, 0.9 - i * 0.02));
    const { promptText, verwendeteTreffer } = assembliereAssistentKontext(base({ treffer: many }));
    expect(verwendeteTreffer).toHaveLength(RETRIEVAL_K);
    expect(verwendeteTreffer.map(t => t.id)).toEqual(many.slice(0, RETRIEVAL_K).map(t => t.id));
    expect(promptText).toContain(`[${RETRIEVAL_K}]`);
    expect(promptText).not.toContain(`[${RETRIEVAL_K + 1}]`);
  });

  it('baut die Kontext-Beschreibung für die Chips aus den Entitäts-Metadaten', () => {
    expect(assembliereAssistentKontext(base()).kontextBeschreibung).toBe('Verbund Musterbau · FuE-Phase · 2 Fristen');
  });
});

/**
 * Was zu tun ist: die To-do-Kaskade vor der alten Status-Formel.
 *
 * Gemessen an DynaMaint (10.09.2026, interne KI): die Karte zeigte „Widerspruch
 * gg Abl bearbeiten · liegt bei AB/FB/Jur", der Assistent sagte
 * „Ablehnungsbescheid erstellen" — zwei gegensätzliche Anweisungen auf einem
 * Bildschirm, weil der Faktenblock allein `schrittText` sprach.
 */
describe('assembliereAssistentKontext — was zu tun ist', () => {
  const mitAufgabe = (aufgabe: KontextEntitaet['aufgabe']): AssistentKontextEingabe =>
    base({ entitaet: { ...entitaet, status: 'Abl in QS', aufgabe } });

  it('nimmt die Kaskade und lässt die alte Formel weg', () => {
    const { promptText } = assembliereAssistentKontext(mitAufgabe({
      text: 'Widerspruch gg Abl bearbeiten', ausKaskade: true, neben: 'liegt bei AB/FB/Jur',
    }));
    expect(promptText).toContain('Was zu tun ist: Widerspruch gg Abl bearbeiten — liegt bei AB/FB/Jur');
    // Die beiden Quellen dürfen nicht nebeneinander stehen: zwei „nächste
    // Schritte" im selben Block sind schlimmer als einer.
    expect(promptText).not.toContain('Nächster Schritt:');
  });

  it('macht den Rückfall auf die Status-Formel kenntlich', () => {
    const { promptText } = assembliereAssistentKontext(mitAufgabe({
      text: 'Ablehnungsbescheid erstellen', ausKaskade: false,
    }));
    expect(promptText).toContain(
      'Was zu tun ist (aus dem Status abgeleitet, keine Regel greift): Ablehnungsbescheid erstellen',
    );
  });

  it('fällt ohne Kaskaden-Feld auf die alte Formel zurück (unverändertes Verhalten)', () => {
    const { promptText } = assembliereAssistentKontext(base());
    expect(promptText).toContain('Nächster Schritt:');
    expect(promptText).not.toContain('Was zu tun ist');
  });
});

describe('assembliereAssistentKontext — Gedächtnis-Block (Phase 2)', () => {
  it('ohne Gedächtnis: kein Block, gedaechtnisAnzahl 0', () => {
    const { promptText, gedaechtnisAnzahl } = assembliereAssistentKontext(base());
    // Auf den Block-Delimiter prüfen, nicht auf das blosse Wort: der Systemblock
    // erwähnt „Hintergrundwissen" bewusst konditional („Steht unten ein Block …"),
    // um den Widerspruch zu „du kennst keine früheren Sitzungen" aufzulösen.
    expect(promptText).not.toContain('=== Hintergrundwissen');
    expect(gedaechtnisAnzahl).toBe(0);
  });

  it('fügt den Gedächtnis-Block NACH System und VOR Fakten ein; gedaechtnisAnzahl = Anzahl', () => {
    const { promptText, gedaechtnisAnzahl } = assembliereAssistentKontext(base({
      gedaechtnis: [{ text: 'Arbeitet an Verbund V1.' }, { text: 'Nutzt den Skill Kurzfassung.' }],
    }));
    const iSystem = promptText.indexOf('Du bist der Assistent in TeamFlow Local');
    const iGed = promptText.indexOf('=== Hintergrundwissen');
    const iFakten = promptText.indexOf('=== Kontext (deterministisch');
    expect(iSystem).toBeLessThan(iGed);
    expect(iGed).toBeLessThan(iFakten);
    expect(promptText).toContain('kann veraltet sein');
    expect(promptText).toContain('Arbeitet an Verbund V1.');
    expect(gedaechtnisAnzahl).toBe(2);
  });

  it('kürzt das Gedächtnis ZUERST (vor Historie/Retrieval), Fakten bleiben', () => {
    const grosseStammdaten = Array.from({ length: 31 }, (_, i) => ({ label: `Feld ${i}`, wert: 'x'.repeat(600) }));
    const gedaechtnis = Array.from({ length: 12 }, (_, i) => ({ text: `MEM_${i} ${'g'.repeat(300)}` }));
    const turns = [
      { rolle: 'nutzer' as const, text: `TURN_0 ${'y'.repeat(800)}` },
      { rolle: 'assistent' as const, text: `TURN_1 ${'z'.repeat(800)}` },
    ];
    const { promptText, gedaechtnisAnzahl, verwendeteTreffer } = assembliereAssistentKontext(base({
      entitaet: { ...entitaet, stammdaten: grosseStammdaten },
      gedaechtnis,
      turns,
      treffer: [treffer('a', 0.9)],
    }));
    // Gedächtnis wird TEILWEISE gekürzt (von hinten). Dass noch Einträge übrig
    // sind (>0) BEWEIST, dass die Kaskade in der Gedächtnis-Phase gestoppt hat —
    // Historie + Retrieval + Fakten wurden also nie angetastet.
    expect(gedaechtnisAnzahl).toBeGreaterThan(0);
    expect(gedaechtnisAnzahl).toBeLessThan(12);
    expect(promptText).not.toContain('MEM_11'); // letzter Eintrag zuerst gekürzt
    expect(promptText).toContain('MEM_0');       // erster Eintrag bleibt
    expect(promptText).toContain('TURN_0');      // Historie unangetastet
    expect(promptText).toContain('TURN_1');
    expect(verwendeteTreffer).toHaveLength(1);   // Retrieval unangetastet
    expect(promptText).toContain('Feld 30:');    // Fakten unangetastet
    expect(promptText.length).toBeLessThanOrEqual(GESAMT_MAX_CHARS);
  });
});

describe('assembliereAssistentKontext — Arbeitsvorrat-Übersicht (Kein-Entität-Fall)', () => {
  const uebersicht = {
    gesamtInArbeit: 12,
    ueberfaellig: 2,
    dringend: 3,
    naechsteFristen: [
      { titel: 'ROT', hinweis: 'seit 4 T (überfällig)', aktion: 'Gutachten beginnen' },
      { titel: 'ORANGE', hinweis: 'in 6 T (dringend)' },
    ],
  };

  it('rendert den Block NACH den Fakten und VOR dem Retrieval', () => {
    const { promptText } = assembliereAssistentKontext(base({
      entitaet: null,
      treffer: [treffer('a', 0.8)],
      arbeitsvorratUebersicht: uebersicht,
    }));
    const iFakten = promptText.indexOf('=== Kontext (deterministisch');
    const iAv = promptText.indexOf('=== Arbeitsvorrat (Übersicht');
    const iRetrieval = promptText.indexOf('=== Auszüge aus den Dokumenten');
    expect(iFakten).toBeLessThan(iAv);
    expect(iAv).toBeLessThan(iRetrieval);
    expect(promptText).toContain('In Arbeit: 12 Anträge (2 überfällig, 3 dringend).');
    expect(promptText).toContain('- ROT: seit 4 T (überfällig) — nächster Schritt: Gutachten beginnen');
    expect(promptText).toContain('- ORANGE: in 6 T (dringend)');
  });

  it('kein/leerer Arbeitsvorrat → kein Block (self-omittet)', () => {
    expect(assembliereAssistentKontext(base({ entitaet: null })).promptText)
      .not.toContain('=== Arbeitsvorrat');
    expect(assembliereAssistentKontext(base({
      entitaet: null,
      arbeitsvorratUebersicht: { gesamtInArbeit: 0, ueberfaellig: 0, dringend: 0, naechsteFristen: [] },
    })).promptText).not.toContain('=== Arbeitsvorrat');
  });

  it('bleibt bei Budget-Überschreitung erhalten (deterministisch, nie gekürzt)', () => {
    const turns = Array.from({ length: 12 }, (_, i) => ({ rolle: 'nutzer' as const, text: `TURN_${i} ${'y'.repeat(1500)}` }));
    const { promptText } = assembliereAssistentKontext(base({
      entitaet: null,
      turns,
      treffer: Array.from({ length: RETRIEVAL_K }, (_, i) => treffer(`t${i}`, 0.9, 'z'.repeat(600))),
      arbeitsvorratUebersicht: uebersicht,
    }));
    expect(promptText).toContain('=== Arbeitsvorrat (Übersicht');
    expect(promptText).toContain('In Arbeit: 12 Anträge');
    expect(promptText.length).toBeLessThanOrEqual(GESAMT_MAX_CHARS);
  });
});

describe('assembliereAssistentKontext — Vorhaben-Dokumente (entitäts-scoped)', () => {
  it('fügt einen „Dokumente zum Vorhaben"-Block NACH den Fakten und VOR dem Retrieval ein', () => {
    const { promptText } = assembliereAssistentKontext(base({
      treffer: [treffer('a', 0.8)],
      vorhabenDokumente: [
        { typLabel: 'Vorhabensbeschreibung', name: 'vb.pdf', auszug: 'VB-Text' },
        { typLabel: 'Arbeitsplan (Anlage 5)', name: 'anlage5.pdf', auszug: 'AP-Tabelle' },
      ],
    }));
    const iFakten = promptText.indexOf('=== Kontext (deterministisch');
    const iDoks = promptText.indexOf('=== Dokumente zum Vorhaben');
    const iRetrieval = promptText.indexOf('=== Auszüge aus den Dokumenten');
    expect(iFakten).toBeLessThan(iDoks);
    expect(iDoks).toBeLessThan(iRetrieval);
    expect(promptText).toContain('Vorhabensbeschreibung: vb.pdf');
    expect(promptText).toContain('Arbeitsplan (Anlage 5): anlage5.pdf');
  });

  it('kein Dokument → kein Block (self-omittet)', () => {
    const { promptText } = assembliereAssistentKontext(base({ vorhabenDokumente: [] }));
    expect(promptText).not.toContain('=== Dokumente zum Vorhaben');
  });

  it('wird im Budget ZULETZT gekürzt (nach Historie + Retrieval) — entitäts-scoped = am wertvollsten', () => {
    // Großer Faktenblock drückt über das Budget → Historie + Retrieval werden geopfert,
    // der Vorhaben-Dokumente-Block überlebt (wird als Letztes gekürzt).
    const grosseStammdaten = Array.from({ length: 35 }, (_, i) => ({ label: `Feld ${i}`, wert: 'x'.repeat(600) }));
    const turns = Array.from({ length: 10 }, (_, i) => ({ rolle: 'nutzer' as const, text: `TURN_${i} ${'y'.repeat(1200)}` }));
    const { promptText, verwendeteTreffer } = assembliereAssistentKontext(base({
      entitaet: { ...entitaet, stammdaten: grosseStammdaten },
      treffer: Array.from({ length: RETRIEVAL_K }, (_, i) => treffer(`t${i}`, 0.9, 'z'.repeat(600))),
      turns,
      vorhabenDokumente: [{ typLabel: 'Vorhabensbeschreibung', name: 'vb.pdf', auszug: 'wichtiger VB-Auszug' }],
    }));
    expect(promptText).toContain('vb.pdf');                      // Dokument-Block überlebt
    expect(verwendeteTreffer.length).toBeLessThan(RETRIEVAL_K);   // Retrieval wurde (teils) geopfert
    expect(promptText).not.toContain('TURN_0');                  // älteste Historie geopfert
    expect(promptText.length).toBeLessThanOrEqual(GESAMT_MAX_CHARS);
  });
});
