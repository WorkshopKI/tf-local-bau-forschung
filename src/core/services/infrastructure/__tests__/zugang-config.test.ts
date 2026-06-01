/**
 * Unit-Tests fuer die MA-Login-Entschluesselung (v2.11).
 *
 * Testet `verifyPasswortAgainstAll` ueber den Main-Thread-Fallback: unter
 * Vitest scheitert der `?worker&inline`-Import, der try/catch in zugang-config
 * faellt auf den Main-Thread zurueck — genau der Pfad, der hier gedeckt wird.
 */
import { describe, it, expect } from 'vitest';
import { deriveKey, encrypt, randomBytes, SALT_BYTES } from '../crypto';
import { verifyPasswortAgainstAll } from '../zugang-config';
import type { ZugangsEintrag } from '../types';

function b64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]!);
  return btoa(s);
}

/** Spiegelt die Verschluesselung aus `addOrReplaceEintrag`. */
async function makeEntry(anonId: string, kuerzel: string, passwort: string): Promise<ZugangsEintrag> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(passwort, salt);
  const ivAndCt = await encrypt(kuerzel.normalize('NFC'), key);
  return { salt: b64(salt), verschluesseltesKuerzel: b64(ivAndCt), anonId };
}

describe('verifyPasswortAgainstAll', () => {
  it('richtiges Passwort -> Kuerzel + anonId', async () => {
    const eintraege = [await makeEntry('MA01', 'MUE', 'anker-wolke')];
    expect(await verifyPasswortAgainstAll('anker-wolke', eintraege)).toEqual({ kuerzel: 'MUE', anonId: 'MA01' });
  });

  it('falsches Passwort -> null', async () => {
    const eintraege = [await makeEntry('MA01', 'MUE', 'anker-wolke')];
    expect(await verifyPasswortAgainstAll('falsch-wort', eintraege)).toBeNull();
  });

  it('leere Liste -> null', async () => {
    expect(await verifyPasswortAgainstAll('x', [])).toBeNull();
  });

  it('probiert alle Eintraege durch und matcht genau den richtigen', async () => {
    const eintraege = [
      await makeEntry('MA01', 'AAA', 'pw-eins'),
      await makeEntry('MA02', 'BBB', 'pw-zwei'),
      await makeEntry('MA03', 'CCC', 'pw-drei'),
    ];
    expect(await verifyPasswortAgainstAll('pw-zwei', eintraege)).toEqual({ kuerzel: 'BBB', anonId: 'MA02' });
    expect(await verifyPasswortAgainstAll('pw-drei', eintraege)).toEqual({ kuerzel: 'CCC', anonId: 'MA03' });
    expect(await verifyPasswortAgainstAll('pw-vier', eintraege)).toBeNull();
  });

  it('NFC-Roundtrip: decrypt normalisiert NFD -> NFC (Pitfall #22)', async () => {
    // Keine Umlaut-Literale im Quelltext (Normalisierungs-Ambiguitaet) — wir
    // bauen NFD/NFC explizit aus Codepoints:
    //   NFD = 'TH' + 'U' (U+0055) + Combining-Diaeresis (U+0308)
    //   NFC = 'TH' + 'Ü'  (U+00DC)
    const nfd = 'TH' + String.fromCharCode(0x55, 0x0308);
    const nfc = 'TH' + String.fromCharCode(0x00dc);
    expect(nfd).not.toBe(nfc); // Sanity: NFD != NFC
    expect(nfd.normalize('NFC')).toBe(nfc);

    // Bewusst die NFD-Form OHNE Vor-Normalisierung verschluesseln und pruefen,
    // dass die Entschluesselung NFC zurueckliefert (sonst findet
    // resolveAnonIdForUser den MA nicht).
    const salt = randomBytes(SALT_BYTES);
    const key = await deriveKey('pw-thue', salt);
    const ivAndCt = await encrypt(nfd, key);
    const entry: ZugangsEintrag = { salt: b64(salt), verschluesseltesKuerzel: b64(ivAndCt), anonId: 'MA05' };
    const treffer = await verifyPasswortAgainstAll('pw-thue', [entry]);
    expect(treffer?.kuerzel).toBe(nfc);
  });
});
