/**
 * Hält Zahl und Klassenname zusammen.
 *
 * Tailwind liest Klassennamen als Literale aus dem Quelltext — `w-[${TAG_PX}px]`
 * erzeugt kein CSS. Die Maße stehen deshalb zwangsläufig zweimal da. Was hier
 * geprüft wird, ist genau die Stelle, an der ein Patch die eine Hälfte ändert
 * und die andere vergisst: dann rutschen „nach Datum" und „nach Phase"
 * auseinander, und zwar lautlos.
 */
import { describe, expect, it } from 'vitest';
import {
  ABSTAND_PX, ACHSE_PX, CODE_PX, CODE_SPALTE, RINNE_BLOCK, RINNE_PX,
  ROLLE_PX, ROLLEN_SPALTE, SPALTE_CODE, SPALTE_RINNE, SPALTE_ROLLE, SPALTE_TAG,
  TAG_PX, TAG_SPALTE, ZEILE_KLASSE, ZEILE_PX,
} from '../verlaufGeometrie';

describe('verlaufGeometrie — Klassenname trägt dieselbe Zahl', () => {
  const paare: [string, string, number][] = [
    ['RINNE_BLOCK', RINNE_BLOCK, RINNE_PX],
    ['TAG_SPALTE', TAG_SPALTE, TAG_PX],
    ['CODE_SPALTE', CODE_SPALTE, CODE_PX],
    ['ROLLEN_SPALTE', ROLLEN_SPALTE, ROLLE_PX],
  ];

  it.each(paare)('%s enthält w-[%s] passend zur px-Konstante', (_name, klasse, px) => {
    expect(klasse).toContain(`w-[${px}px]`);
  });

  it('ZEILE_KLASSE trägt ZEILE_PX', () => {
    expect(ZEILE_KLASSE).toBe(`leading-[${ZEILE_PX}px]`);
  });
});

describe('verlaufGeometrie — die Tabelle trifft die Flex-Liste', () => {
  it('die Matrix-Spalten summieren sich auf den Beginn des Ereignistexts', () => {
    // Die Chronik rechnet: Rinne, Achsenlinie, Einzug, Tag, Abstand, Kürzel,
    // Abstand, Rollen, Abstand — danach beginnt der Text. Genau diese Summe
    // müssen die vier Tabellenspalten ergeben, sonst springt er beim Umschalten.
    const inDerChronik = RINNE_PX + 1 + ACHSE_PX
      + TAG_PX + ABSTAND_PX
      + CODE_PX + ABSTAND_PX
      + ROLLE_PX + ABSTAND_PX;
    const inDerMatrix = SPALTE_RINNE + SPALTE_TAG + SPALTE_CODE + SPALTE_ROLLE;
    expect(inDerMatrix).toBe(inDerChronik);
  });

  it('keine Spalte ist versehentlich null oder negativ', () => {
    for (const b of [SPALTE_RINNE, SPALTE_TAG, SPALTE_CODE, SPALTE_ROLLE]) {
      expect(b).toBeGreaterThan(0);
    }
  });
});
