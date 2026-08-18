/**
 * Der wirksame Suchtext (v4.107).
 *
 * Der Fehler, gegen den diese Tests stehen: die Liste durchsuchte den Wortlaut
 * mit dem Fragesatz. „alle Netzwerke die für Phase 2 abgelehnt wurden" trifft
 * über Titel und Antragsteller **nichts** — die Liste war leer, alle Filter
 * standen auf „Alle", und es sah aus, als hätte die KI etwas getan.
 */
import { describe, it, expect } from 'vitest';
import { frageOffen, wirksamerSuchtext, type SuchtextLage } from '../frage/suchtext';

const FRAGE = 'alle Netzwerke die für Phase 2 abgelehnt wurden';

function lage(teil: Partial<SuchtextLage> = {}): SuchtextLage {
  return {
    search: '', frageModus: false, frageGestellt: null, hatPlanTeile: false, ...teil,
  };
}

describe('wirksamerSuchtext', () => {
  it('reicht den Text im Stichwort-Modus unverändert durch', () => {
    expect(wirksamerSuchtext(lage({ search: 'laser' }))).toBe('laser');
  });

  it('sucht NICHT mit einer getippten, aber ungestellten Frage', () => {
    expect(wirksamerSuchtext(lage({ search: FRAGE, frageModus: true }))).toBe('');
  });

  it('sucht auch nach einer gestellten Frage OHNE Themen nicht im Wortlaut', () => {
    // Der Normalfall: eine Frage nach Status, Jahr und PreCheck nennt kein
    // Thema. Sie setzt Filter — die Wortlaut-Stufe hat nichts zu tun. Liefe der
    // Satz mit, käme die Liste nach einem ERFOLGREICHEN Lauf leer zurück.
    expect(wirksamerSuchtext(lage({
      search: FRAGE, frageModus: true, frageGestellt: FRAGE, hatPlanTeile: false,
    }))).toBe('');
  });

  it('lässt den Satz nur durch, wenn die Frage Leitbegriffe ergeben hat', () => {
    expect(wirksamerSuchtext(lage({
      search: FRAGE, frageModus: true, frageGestellt: FRAGE, hatPlanTeile: true,
    }))).toBe(FRAGE);
  });

  it('nimmt den Satz zurück, sobald weitergetippt wird', () => {
    expect(wirksamerSuchtext(lage({
      search: `${FRAGE} und zwar`, frageModus: true, frageGestellt: FRAGE, hatPlanTeile: true,
    }))).toBe('');
  });
});

describe('frageOffen', () => {
  it('ist im Stichwort-Modus nie offen', () => {
    expect(frageOffen(lage({ search: FRAGE }))).toBe(false);
  });

  it('ist bei leerem Feld nicht offen — es gibt nichts zu fragen', () => {
    expect(frageOffen(lage({ search: '   ', frageModus: true }))).toBe(false);
  });

  it('ist offen, solange die Frage nicht übersetzt wurde', () => {
    expect(frageOffen(lage({ search: FRAGE, frageModus: true }))).toBe(true);
  });

  it('schließt, sobald genau diese Frage übersetzt ist — auch mit Rand-Leerraum', () => {
    expect(frageOffen(lage({
      search: `  ${FRAGE}  `, frageModus: true, frageGestellt: FRAGE,
    }))).toBe(false);
  });

  it('öffnet wieder, wenn eine ANDERE Frage im Feld steht', () => {
    expect(frageOffen(lage({
      search: 'alle Anträge von THÜ', frageModus: true, frageGestellt: FRAGE,
    }))).toBe(true);
  });
});
