/**
 * Was ein Export dieser Seite mitnimmt — und wie die Datei dann heißt.
 *
 * Der Anlass ist ein echter Datenvorfall: „Phasen exportieren" nahm die
 * GESPEICHERTE Fassung, die Seite zeigte aber den Entwurf. Die Datei trug damit
 * den alten Verfahrensschnitt, der Import am Zielort meldete korrekt Erfolg —
 * und die Kuratierung war trotzdem nicht angekommen. Beide Hälften der
 * Korrektur werden hier festgehalten: **welcher Stand** mitgeht (Textprüfung am
 * Hook, weil der Griff dort sitzt) und **wie er heißt**.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportDateiname } from '../katalogExport';

describe('exportDateiname', () => {
  it('nennt Art und Fassung', () => {
    expect(exportDateiname('katalog', 22, false)).toBe('status-katalog-v22.json');
    expect(exportDateiname('phasen', 22, false)).toBe('status-phasen-v22.json');
  });

  it('macht einen ungespeicherten Stand am Namen kenntlich', () => {
    expect(exportDateiname('phasen', 22, true)).toBe('status-phasen-v22-entwurf.json');
    expect(exportDateiname('katalog', 7, true)).toBe('status-katalog-v7-entwurf.json');
  });
});

describe('Der Export nimmt den Stand vom Bildschirm', () => {
  const quelle = readFileSync(join(__dirname, '..', 'useStatusCockpit.ts'), 'utf8');

  it('reicht dem Voll-Export den Entwurf, nicht die gespeicherte Fassung', () => {
    expect(quelle).toContain('exportiereVersion(entwurf)');
    expect(quelle).not.toContain('exportiereVersion(aktiveVersion)');
  });

  it('reicht dem Phasen-Paket den Entwurf, nicht die gespeicherte Fassung', () => {
    expect(quelle).toContain('exportierePhasenPaket(entwurf)');
    expect(quelle).not.toContain('exportierePhasenPaket(aktiveVersion)');
  });

  it('baut beide Dateinamen über den einen Helfer', () => {
    expect(quelle.match(/exportDateiname\(/g)).toHaveLength(2);
    // Ein handgebauter Name führte den `-entwurf`-Zusatz sofort wieder weg.
    expect(quelle).not.toMatch(/`status-(katalog|phasen)-v\$\{/);
  });
});
