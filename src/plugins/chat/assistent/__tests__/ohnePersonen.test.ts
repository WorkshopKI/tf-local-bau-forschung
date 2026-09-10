/**
 * Guard `assistent-ohne-personen` (vorgangssystem.md §12.6, Spec
 * Assistent-Fragevorschläge 3.4) — modul-lokal, weil er nur die Pfade des
 * Assistenten betrifft.
 *
 * Der Assistent bekommt seit v6.54 einen datierten Verlauf des Vorgangs. Stünde
 * ein Bearbeiter-Kürzel daneben, würde „wie lange hat X gebraucht?" beantwortbar
 * — ein Aktivitätsprotokoll, mitbestimmungspflichtig. Die Kürzel-Spalten tauchen
 * deshalb in keiner Datei des Assistenten auf. Wer „ist AB/FB besetzt?" braucht,
 * fragt `besetzteRollen` (bearbeiterFilter.ts): heraus kommen nur Rollen.
 */
import { describe, expect, it } from 'vitest';
import { sep } from 'node:path';
import { ALL_TS_FILES, findInFile, fmt, type Finding } from '@/__tests__/conventions-lib';

const SCOPE_FRAGMENTS = [
  `${sep}plugins${sep}chat${sep}assistent${sep}`,
  `${sep}core${sep}services${sep}assistent${sep}kontext${sep}`,
];
const KUERZEL_SPALTE = /\b(?:tib|bib|bfm|ztp|pfm)_kuerz\b/i;

describe('assistent-ohne-personen', () => {
  it('keine Bearbeiter-Kürzel-Spalte in den Dateien des Assistenten', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (!SCOPE_FRAGMENTS.some(frag => file.includes(frag))) continue;
      if (file.includes(`${sep}__tests__${sep}`)) continue;
      findings.push(...findInFile(file, l => KUERZEL_SPALTE.test(l), 'allow-assistent-person'));
    }
    if (findings.length > 0) {
      expect.fail(
        `Bearbeiter-Kürzel-Spalte im Assistenten (vorgangssystem.md §12.6): mit dem\n` +
        `datierten Verlauf im selben Prompt entstünde ein Aktivitätsprotokoll. Besetzung\n` +
        `über besetzteRollen() zählen, nie den Wert lesen. Ausnahme:\n` +
        `'// allow-assistent-person: <grund>'.\n\nTreffer:\n${fmt(findings)}`,
      );
    }
  });
});
