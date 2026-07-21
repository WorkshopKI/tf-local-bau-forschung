/**
 * v2.59.2: Stepper-Kollaps bei konsolidierter Sammel-Box (modernes Chromium).
 * `resolveAfterGrant` entscheidet nach einem Einzel-Grant, welche Slots erledigt
 * sind und ob abgeschlossen werden kann — pure Funktion, ohne React-Rendering.
 */
import { describe, it, expect } from 'vitest';
import { resolveAfterGrant, darfWeiterketten } from '../guided-grant-progress';

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

/**
 * v2.276.0 — die Auto-Kette laeuft ohne eigene User-Geste. Ob der Browser
 * ueberhaupt einen Dialog gezeigt hat, ist von aussen nicht feststellbar
 * (die frühere 300ms-Heuristik kippte unter Citrix-Last). Deshalb bucht sie
 * ausschliesslich Erfolge: attemptedSlot = null.
 */
describe('resolveAfterGrant ohne Geste (Auto-Kette, attemptedSlot = null)', () => {
  it('bucht NIE eine Ablehnung — ungewährter Slot bleibt offen statt denied', () => {
    const r = resolveAfterGrant(PENDING, {}, null, new Set(['daten-share', 'persoenlich']));
    expect(r.resolved).toEqual({});
    expect(r.complete).toBe(false);
  });

  it('übernimmt Erfolge aus dem Re-Scan trotzdem (Sammel-Box gewährte mehrere)', () => {
    const r = resolveAfterGrant(PENDING, {}, null, new Set(['persoenlich']));
    expect(r.resolved).toEqual({ 'daten-share': 'granted' });
    expect(r.complete).toBe(false);
  });

  it('kann abschliessen, wenn der Re-Scan alles als gewährt meldet', () => {
    const r = resolveAfterGrant(PENDING, {}, null, new Set());
    expect(r.resolved).toEqual({ 'daten-share': 'granted', persoenlich: 'granted' });
    expect(r.complete).toBe(true);
  });

  it('Regression: der stille Fehlschlag der Kette darf den Persönlichen Ordner nicht verbrennen', () => {
    // Datenordner in echter Geste gewährt, danach kettet die App auf
    // 'persoenlich' — der Browser zeigt mangels Activation keinen Dialog.
    // Vor v2.276.0 wurde 'persoenlich' hier faelschlich denied und
    // uebersprungen; jetzt bleibt er offen und wird der naechste Klick-Schritt.
    const r = resolveAfterGrant(PENDING, { 'daten-share': 'granted' }, null, new Set(['persoenlich']));
    expect(r.resolved.persoenlich).toBeUndefined();
    expect(r.complete).toBe(false);
  });
});
