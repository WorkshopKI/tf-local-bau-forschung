/**
 * Die Beschriftungen der Seite — geprüft wird nur, was sich sonst still
 * zurückdreht.
 *
 * Anlass ist eine Kollision, die Kollegen über Monate gestolpert hat: der
 * Prominenz-Wert `meilenstein` hieß „Meilenstein" und stand damit im
 * Kürzel-Verzeichnis neben einem Meilenstein-Modul, das etwas völlig anderes
 * meint (Sollwochen ab Eingang, eigener Plan, eigene Freigabe). Die Prominenz
 * entscheidet allein, wie stark ein Punkt in der Chronik gezeichnet wird.
 *
 * Der Bezeichner bleibt `meilenstein` — er steht in jeder gespeicherten Fassung
 * auf dem Share. Nur die Beschriftung darf das Wort nicht mehr führen, und
 * genau das hält dieser Test fest: eine Umbenennung zurück wäre ein
 * Einzeiler, den niemand als Rückschritt erkennt.
 */
import { describe, it, expect } from 'vitest';
import { PROMINENZ_LABEL, PROMINENZ_WERTE, TAB_LABEL } from '../labels';

describe('status-cockpit/labels', () => {
  it('führt „Meilenstein" nicht als Prominenz-Beschriftung', () => {
    const kollision = Object.entries(PROMINENZ_LABEL)
      .filter(([, label]) => /meilenstein/i.test(label));
    if (kollision.length > 0) {
      expect.fail(
        `Prominenz-Beschriftung trägt „Meilenstein":\n`
        + kollision.map(([id, label]) => `  ${id} → „${label}"`).join('\n')
        + `\n\nDas Wort gehört dem Meilenstein-Plan (Sollwochen ab Eingang,`
        + `\neigene Freigabe). Die Prominenz sagt nur, wie stark ein Punkt in`
        + `\nder Chronik gezeichnet wird — sie braucht ein eigenes Wort`
        + `\n(heute „Hauptereignis"). Der Bezeichner „meilenstein" bleibt:`
        + `\ner steht in jeder gespeicherten Fassung.`,
      );
    }
  });

  it('beschriftet jeden Prominenz-Wert genau einmal', () => {
    // Zwei Werte mit derselben Beschriftung wären in der Auswahl nicht
    // unterscheidbar — und die Auswahl ist der einzige Ort, an dem sie
    // auseinandergehalten werden müssen.
    const labels = PROMINENZ_WERTE.map(p => PROMINENZ_LABEL[p]);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.every(l => l.trim().length > 0)).toBe(true);
  });

  it('beschriftet jeden Reiter — auch den ohne Zähler', () => {
    // „Ebenen" trägt bewusst keine Zahl; ohne Beschriftung wäre die Lasche leer.
    for (const [key, label] of Object.entries(TAB_LABEL)) {
      expect(label.trim(), `Reiter ${key} ohne Beschriftung`).not.toBe('');
    }
  });
});
