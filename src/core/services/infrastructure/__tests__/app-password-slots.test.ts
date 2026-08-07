/**
 * Modul-Schloss-Verifikation (v3.0) — gegen die REINE `verifyGegenEintrag`.
 *
 * Der Kern ist die Rollenpruefung: der Sentinel traegt seit jeher ein `role`-Feld,
 * das der Runtime bis v2.x gelesen und weggeworfen hat. Ab v3.0 diskriminiert es
 * die Slots — ein Kurator-Passwort darf das Auslastungs-Modul nicht oeffnen.
 *
 * Gegenprobe im selben Test: an der App-Wall wird die Rolle bewusst NICHT geprueft,
 * weil `dev` und `pl` sich einen Verifier mit `role: "pl"` teilen.
 *
 * Die Verifier werden hier mit denselben Krypto-Params erzeugt wie in
 * scripts/set-app-password.mjs — der Test ist damit auch der Gleichstands-Check
 * zwischen Build-Tool und Laufzeit (Pitfall #28).
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { deriveKey, encrypt, randomBytes } from '../crypto';
import { verifyGegenEbenen, verifyGegenEintrag } from '../app-password';

const SALT_BYTES = 16;

/**
 * Baut einen Eintrag exakt so, wie scripts/set-app-password.mjs ihn schreibt —
 * ueber DIESELBEN Primitive, die auch die Laufzeit nutzt. Damit ist der Test
 * zugleich der Gleichstands-Check zwischen Build-Tool und App (Pitfall #28):
 * driftet einer der Krypto-Parameter, faellt er hier auf.
 */
async function baueEintrag(password: string, role: string): Promise<{ salt: string; verifier: string }> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt);
  const blob = await encrypt(JSON.stringify({ v: 1, role }), key);
  return { salt: Buffer.from(salt).toString('base64'), verifier: Buffer.from(blob).toString('base64') };
}

describe('verifyGegenEintrag', () => {
  it('akzeptiert das richtige Passwort mit passender Rolle', async () => {
    const eintrag = await baueEintrag('geheim-auslastung', 'auslastung');
    const r = await verifyGegenEintrag(eintrag, 'geheim-auslastung', 'auslastung');
    expect(r.ok).toBe(true);
    expect(r.role).toBe('auslastung');
  }, 30_000);

  it('ein Auslastungs-Verifier oeffnet NICHT den Kurator-Slot', async () => {
    const eintrag = await baueEintrag('geheim-auslastung', 'auslastung');
    // Richtiges Passwort, falsch erwartete Rolle → abgelehnt.
    const r = await verifyGegenEintrag(eintrag, 'geheim-auslastung', 'kurator');
    expect(r.ok).toBe(false);
  }, 30_000);

  it('ein Basis-Verifier (role "pl") oeffnet kein Modul-Schloss', async () => {
    const eintrag = await baueEintrag('team-passwort', 'pl');
    expect((await verifyGegenEintrag(eintrag, 'team-passwort', 'auslastung')).ok).toBe(false);
    expect((await verifyGegenEintrag(eintrag, 'team-passwort', 'kurator')).ok).toBe(false);
  }, 30_000);

  it('ohne erwartete Rolle wird sie ignoriert — so nimmt zah-dev das pl-Passwort an', async () => {
    const eintrag = await baueEintrag('team-passwort', 'pl');
    const r = await verifyGegenEintrag(eintrag, 'team-passwort');
    expect(r.ok).toBe(true);
    expect(r.role).toBe('pl');
  }, 30_000);

  it('falsches Passwort, fehlender und korrupter Eintrag liefern alle {ok:false} statt zu werfen', async () => {
    const eintrag = await baueEintrag('richtig', 'auslastung');
    expect((await verifyGegenEintrag(eintrag, 'falsch', 'auslastung')).ok).toBe(false);
    expect((await verifyGegenEintrag(undefined, 'egal', 'auslastung')).ok).toBe(false);
    expect((await verifyGegenEintrag(null, 'egal', 'auslastung')).ok).toBe(false);
    expect((await verifyGegenEintrag({ salt: '', verifier: '' }, 'egal', 'auslastung')).ok).toBe(false);
    expect((await verifyGegenEintrag({ salt: eintrag.salt, verifier: 'kaputt!!' }, 'richtig', 'auslastung')).ok).toBe(false);
  }, 30_000);
});

/**
 * Die Anmelde-Wall nimmt DREI Passwoerter an und muss sie unterscheiden — daran
 * haengt, welches Modul die Anmeldung oeffnet. Geprueft wird die reine Ebenen-
 * Orchestrierung, weil Vitest `__TEAMFLOW_CONFIG__` fest auf eine Config OHNE
 * `moduleAuth` verdrahtet; `verifyAnyPassword` ist nur ihr duenner Wrapper.
 */
describe('verifyGegenEbenen — welches Passwort oeffnet welche Ebene', () => {
  let basis: { salt: string; verifier: string };
  let auslastung: { salt: string; verifier: string };
  let kurator: { salt: string; verifier: string };

  // Einmal bauen: jede Ableitung kostet 200k PBKDF2-Runden.
  beforeAll(async () => {
    basis = await baueEintrag('team-passwort', 'pl');
    auslastung = await baueEintrag('pw-auslastung', 'auslastung');
    kurator = await baueEintrag('pw-kurator', 'kurator');
  }, 30_000);

  it('Basis-Passwort trifft die App-Wall', async () => {
    const r = await verifyGegenEbenen(basis, { auslastung, kurator }, 'team-passwort');
    expect(r).toMatchObject({ ok: true, slot: 'base' });
  }, 30_000);

  it('Auslastungs-Passwort trifft NUR den Auslastungs-Slot', async () => {
    const r = await verifyGegenEbenen(basis, { auslastung, kurator }, 'pw-auslastung');
    expect(r).toMatchObject({ ok: true, slot: 'auslastung' });
  }, 30_000);

  it('Kurator-Passwort trifft NUR den Kurator-Slot', async () => {
    const r = await verifyGegenEbenen(basis, { auslastung, kurator }, 'pw-kurator');
    expect(r).toMatchObject({ ok: true, slot: 'kurator' });
  }, 30_000);

  it('nicht konfigurierte Slots werden uebersprungen', async () => {
    // dev/local tragen kein moduleAuth — die Wall darf trotzdem oeffnen.
    expect(await verifyGegenEbenen(basis, null, 'team-passwort')).toMatchObject({ ok: true, slot: 'base' });
    // Und ein Modul-Passwort oeffnet dort nichts, weil es die Ebene nicht gibt.
    expect((await verifyGegenEbenen(basis, {}, 'pw-auslastung')).ok).toBe(false);
  }, 30_000);

  it('die Basis gewinnt vor den Slots — ein doppelt vergebenes Passwort oeffnet still nur die erste Ebene', async () => {
    // Warnung fuer die Passwortvergabe: wer denselben String zweimal einsetzt,
    // bekommt das Modul NICHT, ohne dass irgendetwas meldet, warum.
    const doppelt = await baueEintrag('team-passwort', 'auslastung');
    const r = await verifyGegenEbenen(basis, { auslastung: doppelt }, 'team-passwort');
    expect(r.slot).toBe('base');
  }, 30_000);

  it('unbekanntes Passwort oeffnet gar nichts', async () => {
    expect((await verifyGegenEbenen(basis, { auslastung, kurator }, 'raten')).ok).toBe(false);
  }, 30_000);
});
