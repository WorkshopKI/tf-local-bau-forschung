/**
 * Sichtbarkeits-/Ableitungs-Logik der Vier-Ebenen-Karte. Das Repo hat keine
 * Render-Tests (`@testing-library` ist nicht installiert) — deshalb liegt alles
 * Entscheidbare in reinen Funktionen und WIRD HIER getestet, statt eine neue
 * Test-Infrastruktur einzuführen.
 */
import { describe, it, expect } from 'vitest';
import {
  abschnittHinweise, hatQsStrip, pipelineStatus, qsBadge, qsKriterienStand,
} from '../abschnittAnzeige';
import type { QsBefund, StepRun } from '../types';

function step(over: Partial<StepRun> = {}): StepRun {
  return {
    quellenanalyse: '', entwurf: '', finalerText: 'Ein Satz.', checks: [],
    status: 'entwurf', erstellt_am: '2026-07-20T10:00:00.000Z', modell: 'llama.cpp', ...over,
  };
}
const befund = (bewertung: QsBefund['bewertung'], dimension = 'K'): QsBefund =>
  ({ dimension, bewertung, text: 't' });

describe('pipelineStatus', () => {
  it('poliert → Formuliert · Feinschliff', () => {
    expect(pipelineStatus(step({ lektoriert: true }))).toEqual({ text: 'Formuliert · Feinschliff', ton: 'ok' });
  });

  it('uebersprungen → benennt das und bleibt im Hinweis-Ton', () => {
    const p = pipelineStatus(step({ feinschliffUebersprungen: true }));
    expect(p.text).toBe('Formuliert · Feinschliff übersprungen');
    expect(p.ton).toBe('hinweis');
  });

  it('reiner Rohentwurf (Alt-Stand vor der Auto-Kette) → nur Formuliert', () => {
    expect(pipelineStatus(step())).toEqual({ text: 'Formuliert', ton: 'neutral' });
  });
});

describe('qsBadge', () => {
  it('ungeprueft ist der ehrliche Default', () => {
    expect(qsBadge(step())).toEqual({ text: 'nicht geprüft', ton: 'neutral' });
  });

  it('bestandene Abnahme → ok', () => {
    const b = qsBadge(step({ qsAbnahme: { status: 'bestanden', am: 'x', kriterienVersion: 3 } }));
    expect(b).toEqual({ text: 'QS bestanden', ton: 'ok' });
  });

  it('veraltete Abnahme schlaegt ALLES andere — auch ein bestandenes Urteil', () => {
    const b = qsBadge(step({
      qsAbnahme: { status: 'bestanden', am: 'x', kriterienVersion: 3, veraltet: true },
      qsHinweise: [befund('ok')],
    }));
    expect(b).toEqual({ text: 'QS veraltet', ton: 'hinweis' });
  });

  it('Befunde ohne Abnahme (Default-Dimensionen) → Rollup-Zusammenfassung', () => {
    const b = qsBadge(step({ qsHinweise: [befund('ok'), befund('hinweis', 'Ton')] }));
    expect(b).toEqual({ text: '1 Hinweis', ton: 'hinweis' });
  });

  it('lauter ok-Befunde ohne Abnahme → ok-Ton', () => {
    expect(qsBadge(step({ qsHinweise: [befund('ok')] })).ton).toBe('ok');
  });
});

describe('qsKriterienStand / hatQsStrip', () => {
  it('zaehlt die ok-Befunde gegen die Gesamtzahl', () => {
    expect(qsKriterienStand([befund('ok'), befund('hinweis'), befund('unklar')])).toEqual({ ok: 1, gesamt: 3 });
  });

  it('Strip erscheint bei Befunden ODER Abnahme, sonst nicht', () => {
    expect(hatQsStrip(step())).toBe(false);
    expect(hatQsStrip(step({ qsHinweise: [befund('ok')] }))).toBe(true);
    expect(hatQsStrip(step({ qsAbnahme: { status: 'hinweise', am: 'x', kriterienVersion: 1 } }))).toBe(true);
  });
});

describe('abschnittHinweise', () => {
  it('sauberer Abschnitt → kein Streifen', () => {
    expect(abschnittHinweise(step())).toEqual([]);
  });

  it('sammelt alle Meldungen in EINER Liste statt in fuenf Bannern', () => {
    const keys = abschnittHinweise(step({
      warnung: 'W', chatResetStatus: 'timeout', vbGekuerzt: true,
      zielFallback: true, feinschliffUebersprungen: true,
    }), 'Retry-Vermerk').map(h => h.key);
    expect(keys).toEqual(['retry', 'warnung', 'chatreset', 'vbgekuerzt', 'zielfallback', 'feinschliff']);
  });

  it('trennt „etwas pruefen" von reiner Provenienz-Information', () => {
    const h = abschnittHinweise(step({ zielFallback: true, warnung: 'W' }));
    expect(h.find(x => x.key === 'warnung')!.ton).toBe('hinweis');
    expect(h.find(x => x.key === 'zielfallback')!.ton).toBe('neutral');
  });

  it('der Lektorat-Waechter meldet nur bei messbarer Abweichung zur Vorfassung', () => {
    const ohneAbweichung = abschnittHinweise(step({
      lektoriert: true, finalerText: 'Ein Satz.',
      verlauf: [{ finalerText: 'Ein Satz.', quellenanalyse: '', entwurf: '', checks: [], erstellt_am: 'x', modell: 'm' }],
    }));
    expect(ohneAbweichung.find(h => h.key === 'lektorat')).toBeUndefined();

    const mitAbweichung = abschnittHinweise(step({
      lektoriert: true, finalerText: 'Kurz.',
      verlauf: [{
        finalerText: 'Ein deutlich laengerer Satz mit der Zahl 50 Prozent und noch mehr Inhalt drumherum.',
        quellenanalyse: '', entwurf: '', checks: [], erstellt_am: 'x', modell: 'm',
      }],
    }));
    expect(mitAbweichung.find(h => h.key === 'lektorat')).toBeDefined();
  });

  it('ohne Verlauf meldet der Waechter nichts (nichts zu vergleichen)', () => {
    expect(abschnittHinweise(step({ lektoriert: true })).find(h => h.key === 'lektorat')).toBeUndefined();
  });
});
