/**
 * v2.59.2: Stepper-Kollaps bei konsolidierter Sammel-Box (modernes Chromium).
 * `resolveAfterGrant` entscheidet nach einem Einzel-Grant, welche Slots erledigt
 * sind und ob abgeschlossen werden kann — pure Funktion, ohne React-Rendering.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveAfterGrant,
  darfWeiterketten,
  ketteAbgebrochenOhnePrompt,
  AUTO_CHAIN_MIN_PROMPT_MS,
} from '../guided-grant-progress';

const PENDING = ['daten-share', 'persoenlich'];

describe('resolveAfterGrant', () => {
  it('konsolidiert: Sammel-Box gewährt alles → remaining leer → beide granted, complete', () => {
    const r = resolveAfterGrant(PENDING, {}, 'daten-share', new Set());
    expect(r.resolved).toEqual({ 'daten-share': 'granted', persoenlich: 'granted' });
    expect(r.complete).toBe(true);
  });

  it('inkrementell: nur Datenordner gewährt, persönlich bleibt offen → nicht complete', () => {
    const r = resolveAfterGrant(PENDING, {}, 'daten-share', new Set(['persoenlich']));
    expect(r.resolved).toEqual({ 'daten-share': 'granted' });
    expect(r.complete).toBe(false);
  });

  it('denied: versuchter Slot bleibt ungranted → als denied markiert (kein Endlos-Prompt)', () => {
    const r = resolveAfterGrant(PENDING, {}, 'daten-share', new Set(['daten-share', 'persoenlich']));
    expect(r.resolved).toEqual({ 'daten-share': 'denied' });
    expect(r.complete).toBe(false);
  });

  it('zweiter Schritt schließt ab: persönlich gewährt nachdem Datenordner schon granted war', () => {
    const r = resolveAfterGrant(PENDING, { 'daten-share': 'granted' }, 'persoenlich', new Set());
    expect(r.resolved).toEqual({ 'daten-share': 'granted', persoenlich: 'granted' });
    expect(r.complete).toBe(true);
  });

  it('denied-Slot bleibt denied, restlicher Grant schließt ab → complete (denied zählt als resolved)', () => {
    // daten-share blieb ungranted (im Re-Scan noch enthalten) → bleibt denied;
    // persönlich gewährt → beide Slots resolved → complete.
    const r = resolveAfterGrant(PENDING, { 'daten-share': 'denied' }, 'persoenlich', new Set(['daten-share']));
    expect(r.resolved).toEqual({ 'daten-share': 'denied', persoenlich: 'granted' });
    expect(r.complete).toBe(true);
  });

  it('Re-Scan ist Source-of-Truth: ein zuvor denied-Slot, der jetzt granted ist, wird granted', () => {
    // remaining leer → beide granted; das frühere 'denied' wird überschrieben,
    // weil queryPermission den Slot nun als granted meldet (Realität gewinnt).
    const r = resolveAfterGrant(PENDING, { 'daten-share': 'denied' }, 'persoenlich', new Set());
    expect(r.resolved).toEqual({ 'daten-share': 'granted', persoenlich: 'granted' });
    expect(r.complete).toBe(true);
  });
});

/**
 * v2.275: optimistische Auto-Kette — nach einem erfolgreichen Grant den nächsten
 * Slot ohne zusätzlichen Klick probieren, aber sauber abbrechen, sobald der
 * Browser mangels User-Activation gar nicht mehr prompted.
 */
describe('darfWeiterketten', () => {
  it('kettet nur nach echtem Erfolg weiter', () => {
    expect(darfWeiterketten('granted')).toBe(true);
  });

  it('beendet die Kette bei denied und bei prompt', () => {
    expect(darfWeiterketten('denied')).toBe(false);
    expect(darfWeiterketten('prompt')).toBe(false);
  });
});

describe('ketteAbgebrochenOhnePrompt', () => {
  it('sofortige Rückkehr ohne Grant = Browser hat nicht gefragt (Activation verbraucht)', () => {
    expect(ketteAbgebrochenOhnePrompt('prompt', 50)).toBe(true);
    expect(ketteAbgebrochenOhnePrompt('denied', 12)).toBe(true);
  });

  it('langsame Ablehnung = echte User-Entscheidung, darf als denied gebucht werden', () => {
    expect(ketteAbgebrochenOhnePrompt('denied', 4000)).toBe(false);
  });

  it('schneller Erfolg (Sammel-Box) ist kein Abbruch', () => {
    expect(ketteAbgebrochenOhnePrompt('granted', 20)).toBe(false);
  });

  it('Schwelle ist exklusiv: genau AUTO_CHAIN_MIN_PROMPT_MS zählt als echter Prompt', () => {
    expect(ketteAbgebrochenOhnePrompt('denied', AUTO_CHAIN_MIN_PROMPT_MS - 1)).toBe(true);
    expect(ketteAbgebrochenOhnePrompt('denied', AUTO_CHAIN_MIN_PROMPT_MS)).toBe(false);
  });
});
