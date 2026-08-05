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

import { describe, expect, it } from 'vitest';
import { deriveKey, encrypt, randomBytes } from '../crypto';
import { verifyGegenEintrag } from '../app-password';

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
