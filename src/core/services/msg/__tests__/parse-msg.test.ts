/**
 * Phase 3 — `.msg`-Body-only-Parser.
 *
 * Primär gegen SYNTHETISCHE CFB-Container (über `cfb`s Writer gebaut) — voll
 * deterministisch, PII-frei, committed; deckt alle Pfade ab (Plain/ANSI/HTML/
 * RTF/none, SMTP vs. X.500-DN, Anhang-Zählung).
 *
 * Zusätzlich (optional) gegen ECHTE Outlook-`.msg` aus `fixtures-local/` — falls
 * vorhanden. Dieses Verzeichnis ist gitignored (echte Mails enthalten reale PII;
 * sie gehören NICHT ins Repo — das ist der ganze Sinn dieses Moduls). Auf CI
 * (Verzeichnis fehlt) werden diese Tests übersprungen.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as CFB from 'cfb';
import { parseMsg } from '../parse-msg';
import { beschreibeWenn } from '@/__tests__/fixture-gate';

// ── Encoder + Synthetik-Builder ──────────────────────────────────────────────
function enc16(s: string): Uint8Array {
  const u = new Uint8Array(s.length * 2);
  const dv = new DataView(u.buffer);
  for (let i = 0; i < s.length; i++) dv.setUint16(i * 2, s.charCodeAt(i), true);
  return u;
}
function enc1252(s: string): Uint8Array {
  // Tests nutzen nur Zeichen <= U+00FF; dort ist CP-1252 == Latin-1.
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff;
  return u;
}
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

interface MsgSpec {
  streams?: Record<string, Uint8Array>; // 8-hex-Tag → Bytes
  attachments?: number;
}
function buildMsg(spec: MsgSpec): ArrayBuffer {
  const c = CFB.utils.cfb_new({ root: 'Root Entry' });
  for (const [tag, bytes] of Object.entries(spec.streams ?? {})) {
    CFB.utils.cfb_add(c, `/__substg1.0_${tag}`, bytes);
  }
  for (let i = 0; i < (spec.attachments ?? 0); i++) {
    const hex = i.toString(16).padStart(8, '0');
    CFB.utils.cfb_add(c, `/__attach_version1.0_#${hex}/__substg1.0_3001001F`, enc16(`Anhang ${i}`));
  }
  const out = CFB.write(c, { type: 'buffer' }) as Uint8Array;
  return Uint8Array.from(out).buffer;
}

// ── Synthetische Fixtures ────────────────────────────────────────────────────
describe('parseMsg — synthetische CFB-Container', () => {
  it('Plain-Text-Body (Unicode) + Betreff + SMTP-Absender + 1 Anhang', () => {
    const buf = buildMsg({
      streams: {
        '0037001F': enc16('AW: Anfrage zur Förderung'),
        '5D01001F': enc16('max.mustermann@example.de'),
        '0C1F001F': enc16('/O=ORG/OU=EAG/CN=RECIPIENTS/CN=ABC'),
        '0C1E001F': enc16('EX'),
        '1000001F': enc16('Sehr geehrte Frau Müller,\r\n\r\nDanke für die Anfrage.   \r\n\r\n\r\n\r\nGruß'),
      },
      attachments: 1,
    });
    const p = parseMsg(buf);
    expect(p.betreff).toBe('AW: Anfrage zur Förderung');
    expect(p.absenderEmail).toBe('max.mustermann@example.de');
    expect(p.absenderDN).toBe('/O=ORG/OU=EAG/CN=RECIPIENTS/CN=ABC');
    expect(p.bodyQuelle).toBe('plain');
    expect(p.bodyMarkdown).toBe('Sehr geehrte Frau Müller,\n\nDanke für die Anfrage.\n\nGruß');
    expect(p.hatAnhaenge).toBe(1);
  });

  it('ANSI-Body + ANSI-Betreff (CP-1252) wenn kein Unicode vorliegt', () => {
    const buf = buildMsg({
      streams: {
        '0037001E': enc1252('Anfrage über Förderung'),
        '1000001E': enc1252('Grüße aus Köln, ä ö ü ß'),
      },
    });
    const p = parseMsg(buf);
    expect(p.betreff).toBe('Anfrage über Förderung');
    expect(p.bodyQuelle).toBe('plain');
    expect(p.bodyMarkdown).toBe('Grüße aus Köln, ä ö ü ß');
  });

  it('HTML-only-Body → Markdown (kein Plain-Text vorhanden)', () => {
    const buf = buildMsg({
      streams: {
        '0037001F': enc16('HTML Mail'),
        '10130102': utf8('<h1>Titel</h1><p><b>fett</b> und normal — mit Ümlaut</p>'),
      },
    });
    const p = parseMsg(buf);
    expect(p.bodyQuelle).toBe('html');
    expect(p.bodyMarkdown).toContain('Titel');
    expect(p.bodyMarkdown).toContain('**fett**');
    expect(p.bodyMarkdown).toContain('Ümlaut');
  });

  it('RTF-only-Body → degradiert mit Hinweis (kein LZFu-Decompress)', () => {
    const buf = buildMsg({
      streams: {
        '0037001F': enc16('RTF Mail'),
        '10090102': new Uint8Array([0x4c, 0x5a, 0x46, 0x75, 0x01, 0x02, 0x03]),
      },
    });
    const p = parseMsg(buf);
    expect(p.bodyQuelle).toBe('rtf');
    expect(p.bodyMarkdown).toMatch(/RTF/);
  });

  it('kein Body-Stream → quelle "none", leerer Body', () => {
    const buf = buildMsg({ streams: { '0037001F': enc16('Nur Betreff') } });
    const p = parseMsg(buf);
    expect(p.bodyQuelle).toBe('none');
    expect(p.bodyMarkdown).toBe('');
  });

  it('nur X.500-DN, keine SMTP-Adresse → absenderEmail leer, DN als Fallback', () => {
    const buf = buildMsg({
      streams: {
        '0037001F': enc16('DN only'),
        '0C1F001F': enc16('/O=ORG/OU=EAG/CN=RECIPIENTS/CN=XYZ'),
        '0C1E001F': enc16('EX'),
        '1000001F': enc16('Text'),
      },
    });
    const p = parseMsg(buf);
    expect(p.absenderEmail).toBe('');
    expect(p.absenderDN).toBe('/O=ORG/OU=EAG/CN=RECIPIENTS/CN=XYZ');
  });

  it('zählt mehrere Anhänge, ohne sie zu verarbeiten', () => {
    const buf = buildMsg({ streams: { '1000001F': enc16('Text') }, attachments: 3 });
    expect(parseMsg(buf).hatAnhaenge).toBe(3);
  });

  it('Plain-Text schlägt vorhandenes HTML (Reihenfolge Plain > HTML)', () => {
    const buf = buildMsg({
      streams: {
        '1000001F': enc16('Plain gewinnt'),
        '10130102': utf8('<p>HTML</p>'),
      },
    });
    const p = parseMsg(buf);
    expect(p.bodyQuelle).toBe('plain');
    expect(p.bodyMarkdown).toBe('Plain gewinnt');
  });

  it('wirft bei Nicht-CFB-Daten einen klaren Fehler', () => {
    expect(() => parseMsg(utf8('das ist keine .msg').buffer)).toThrow(/Outlook-\.msg|CFB/);
  });
});

// ── Optionale Validierung gegen echte Outlook-.msg (lokal, gitignored) ────────
const localDir = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures-local');
const realFiles = existsSync(localDir)
  ? readdirSync(localDir).filter(f => f.toLowerCase().endsWith('.msg'))
  : [];

beschreibeWenn(
  'parseMsg — echte Outlook-.msg (lokal, nicht committed)',
  realFiles.length > 0,
  localDir,
  'Echte .msg-Dateien liegen bewusst nur lokal — sie tragen Absender und Inhalt echter Anfragen.',
  () => {
  for (const f of realFiles) {
    it(`extrahiert Betreff/Absender/Body aus ${f}`, () => {
      const bytes = Uint8Array.from(readFileSync(join(localDir, f)));
      const p = parseMsg(bytes.buffer);
      expect(p.betreff.length).toBeGreaterThan(0);
      expect(p.bodyQuelle).toBe('plain');
      expect(p.bodyMarkdown.length).toBeGreaterThan(50);
      expect(p.absenderEmail).toMatch(/@/);
      // Umlaute müssen korrekt dekodiert sein (kein Mojibake).
      expect(p.bodyMarkdown).not.toContain('�');
    });
  }
});
