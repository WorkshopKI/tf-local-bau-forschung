#!/usr/bin/env node
/**
 * TeamFlow — Build-Time Rollen-Passwort-Tool (v2.16).
 *
 * Berechnet Salt + AES-GCM-Verifier fuer das Rollen-Passwort-Gate und schreibt
 * den `auth`-Block in die angegebene Variant-Config (pl | kurator).
 *
 *   npm run set-password -- pl "Mein-Passwort"
 *   npm run set-password -- kurator "Mein-Passwort"
 *
 * SICHERHEIT: Das Klartext-Passwort wird NIE in die Config geschrieben — nur
 * Salt (16 Random-Bytes) + Verifier (AES-GCM-verschluesselter JSON-Sentinel).
 * Gleiche Krypto-Params wie src/core/services/infrastructure/crypto.ts
 * (PBKDF2-SHA256, 200k Iterationen, AES-GCM-256, Blob = [12B IV][ct+tag]) — der
 * Runtime-Verifier (app-password.ts) entschluesselt mit denselben Params.
 * Der Verifier ist offline brute-forcebar (~PBKDF2-200k pro Versuch) — akzeptiert
 * unter dem Single-Team-Trust-Modell (CLAUDE.md). Starkes Passwort waehlen.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';

const SALT_BYTES = 16;
const IV_BYTES = 12;
const PBKDF2_ITERATIONS = 200_000;
const ALLOWED = ['pl', 'kurator'];

const variant = process.argv[2];
const password = process.argv[3];

if (!variant || !ALLOWED.includes(variant) || !password) {
  console.error('Usage: npm run set-password -- <pl|kurator> <passwort>');
  process.exit(1);
}

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
const verifier = await encrypt(JSON.stringify({ v: 1, role: variant }), key);

config.auth = {
  ...(config.auth && typeof config.auth === 'object' ? config.auth : {}),
  required: true,
  salt: b64(salt),
  verifier: b64(verifier),
};

writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
console.log(`✓ auth-Block in ${configPath} geschrieben (Passwort gesetzt, required=true).`);
console.log('  Es wird nur der Verifier committet — niemals das Klartext-Passwort.');
