#!/usr/bin/env node
/**
 * TeamFlow — Build-Time Passwort-Tool (v2.16, Modul-Schloesser seit v3.0).
 *
 * Berechnet Salt + AES-GCM-Verifier und schreibt ihn in die Variant-Config —
 * entweder als App-Wall (`auth`) oder als Modul-Schloss (`moduleAuth.<slot>`).
 *
 *   npm run set-password -- pl  "Mein-Passwort"                      → auth (App-Wall)
 *   npm run set-password -- dev "Mein-Passwort"                      → auth (App-Wall)
 *   npm run set-password -- pl  --modul auslastung "Mein-Passwort"   → moduleAuth.auslastung
 *   npm run set-password -- pl  --modul kurator    "Mein-Passwort"   → moduleAuth.kurator
 *
 * HINWEIS dev: Die dev-Config spiegelt aktuell Salt+Verifier der pl-Config
 * (gleiches Hauptpasswort, v2.64). Bei pl-Passwort-Rotation entweder den
 * auth-Block erneut nach dev kopieren oder hier ein eigenes dev-Passwort setzen.
 * Deshalb prueft der Runtime-Verifier die Sentinel-Rolle NUR bei Modul-Schloessern,
 * nicht an der App-Wall (siehe app-password.ts).
 *
 * SICHERHEIT: Das Klartext-Passwort wird NIE in die Config geschrieben — nur
 * Salt (16 Random-Bytes) + Verifier (AES-GCM-verschluesselter JSON-Sentinel).
 * Gleiche Krypto-Params wie src/core/services/infrastructure/crypto.ts
 * (PBKDF2-SHA256, 200k Iterationen, AES-GCM-256, Blob = [12B IV][ct+tag]) — der
 * Runtime-Verifier (app-password.ts) entschluesselt mit denselben Params.
 * Der Verifier ist offline brute-forcebar (~PBKDF2-200k pro Versuch) — akzeptiert
 * unter dem Single-Team-Trust-Modell (CLAUDE.md). Starkes Passwort waehlen.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import { MODUL_SLOTS } from './config-schema.mjs';

const SALT_BYTES = 16;
const IV_BYTES = 12;
const PBKDF2_ITERATIONS = 200_000;

/**
 * Erlaubte Varianten = die real vorhandenen Configs (ohne die Sonderfaelle).
 * Bewusst abgeleitet statt gepflegt: eine harte Liste hielt nach der
 * Varianten-Zusammenlegung noch monatelang `kurator`/`as` fest.
 */
const ALLOWED = readdirSync(resolve('configs'))
  .filter(f => f.endsWith('.config.json'))
  .map(f => f.replace('.config.json', ''))
  .filter(v => v !== 'local' && v !== 'prod')
  .sort();

const argv = process.argv.slice(2);
const modulIdx = argv.indexOf('--modul');
const modul = modulIdx >= 0 ? argv[modulIdx + 1] : null;
const rest = modulIdx >= 0 ? [...argv.slice(0, modulIdx), ...argv.slice(modulIdx + 2)] : argv;
const variant = rest[0];
const password = rest[1];

function usage(msg) {
  console.error(`❌ ${msg}\n`);
  console.error(`Usage: npm run set-password -- <${ALLOWED.join('|')}> [--modul <${MODUL_SLOTS.join('|')}>] <passwort>`);
  process.exit(1);
}

if (!variant || !ALLOWED.includes(variant)) usage(`Unbekannte Variante: ${variant ?? '(fehlt)'}`);
if (!password) usage('Passwort fehlt.');
if (modulIdx >= 0 && !MODUL_SLOTS.includes(modul)) usage(`Unbekanntes Modul: ${modul ?? '(fehlt)'}`);

const configPath = resolve(`configs/${variant}.config.json`);
if (!existsSync(configPath)) {
  console.error(`❌ Config nicht gefunden: ${configPath}`);
  process.exit(1);
}

async function deriveKey(pw, salt) {
  const material = await webcrypto.subtle.importKey(
    'raw', new TextEncoder().encode(pw), { name: 'PBKDF2' }, false, ['deriveKey'],
  );
  return webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

async function encrypt(plaintext, key) {
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(
    await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)),
  );
  const out = new Uint8Array(IV_BYTES + ct.byteLength);
  out.set(iv, 0);
  out.set(ct, IV_BYTES);
  return out;
}

const b64 = (buf) => Buffer.from(buf).toString('base64');

const config = JSON.parse(readFileSync(configPath, 'utf-8'));
const salt = webcrypto.getRandomValues(new Uint8Array(SALT_BYTES));
const key = await deriveKey(password, salt);
// Die Rolle im Sentinel ist bei Modul-Schloessern der Slot-Name — der Runtime-
// Verifier prueft ihn, damit ein Kurator-Passwort nicht das Auslastungs-Modul
// oeffnet, falls die Eintraege je verwechselt werden.
const rolle = modul ?? variant;
const verifier = await encrypt(JSON.stringify({ v: 1, role: rolle }), key);

if (modul) {
  const vorher = config.moduleAuth && typeof config.moduleAuth === 'object' ? config.moduleAuth : {};
  const bestehend = vorher[modul] && typeof vorher[modul] === 'object' ? vorher[modul] : {};
  config.moduleAuth = {
    ...vorher,
    [modul]: { ...bestehend, salt: b64(salt), verifier: b64(verifier) },
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  console.log(`✓ moduleAuth.${modul} in ${configPath} geschrieben — das Modul ist ab dem naechsten Build gesperrt.`);
} else {
  config.auth = {
    ...(config.auth && typeof config.auth === 'object' ? config.auth : {}),
    required: true,
    salt: b64(salt),
    verifier: b64(verifier),
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  console.log(`✓ auth-Block in ${configPath} geschrieben (Passwort gesetzt, required=true).`);
}
console.log('  Es wird nur der Verifier committet — niemals das Klartext-Passwort.');
