/**
 * Schritt-/Phasenmodell des Prüfablaufs.
 *
 * Kernpunkt der Suite: Der Fortschritt kommt aus `bewerte()` und nie aus einer
 * Konstante. Der Design-Prototyp zählte gegen ein hart kodiertes `TOTAL_CRIT`,
 * das über der tatsächlichen Kriterienzahl lag — dadurch konnten „Bewerten"
 * und „Abschluss" nie fertig werden. Der letzte Block hier schützt davor.
 */
import { describe, expect, it } from 'vitest';
import {
  ablaufFortschritt, hatWarnBefund, istSchritt, KONFIG_SCHRITTE, naechsterOffenerSchritt,
  PHASEN, phaseIstFertig, phaseVonSchritt, SCHRITT_LABEL, SCHRITT_ORDER, schrittIndex,
  statusVonSchritt, type SchrittKey, type StatusSignale,
} from '../ansicht/schritte';
import type { RechenBefund } from '../types';

const befund = (schwere: RechenBefund['schwere']): RechenBefund => ({
  id: `b-${schwere}`, titel: 'Check', schwere, erwartet: 'a', gefunden: 'b',
});

/** Alles offen — der Zustand direkt nach dem Import. */
const LEER: StatusSignale = {
  befunde: [],
  vbZugeordnet: false,
  infografikDa: false,
  fortschritt: null,
  abschlussbereit: false,
  besucht: new Set(),
};

/** Alles erledigt. */
const FERTIG: StatusSignale = {
  befunde: [],
  vbZugeordnet: true,
  infografikDa: true,
  fortschritt: { erledigt: 9, gesamt: 9 },
  abschlussbereit: true,
  besucht: new Set(['reader']),
};

describe('Phasen- und Schrittstruktur', () => {
  it('gruppiert neun Ablauf-Schritte in drei Phasen (7/1/1)', () => {
    expect(PHASEN.map(p => p.schritte.length)).toEqual([7, 1, 1]);
    expect(SCHRITT_ORDER).toHaveLength(9);
  });

  it('nimmt die Konfigurations-Screens NICHT in den Ablauf auf', () => {
    for (const k of KONFIG_SCHRITTE) {
      expect(SCHRITT_ORDER as readonly string[]).not.toContain(k);
      expect(schrittIndex(k)).toBe(-1);
      expect(istSchritt(k)).toBe(false);
    }
  });

  it('beschriftet jeden Ablauf- und Konfigurations-Screen', () => {
    for (const s of [...SCHRITT_ORDER, ...KONFIG_SCHRITTE]) {
      expect(SCHRITT_LABEL[s]).toBeTruthy();
    }
  });

  it('ordnet jedem Schritt genau eine Phase zu', () => {
    expect(SCHRITT_ORDER.map(s => phaseVonSchritt(s).nummer))
      .toEqual([1, 1, 1, 1, 1, 1, 1, 2, 3]);
  });

  it('zählt Schritte lückenlos in Reihenfolge', () => {
    SCHRITT_ORDER.forEach((s, i) => expect(schrittIndex(s)).toBe(i));
  });
});

describe('statusVonSchritt — echte Signale statt „besucht"', () => {
  it('meldet Rechencheck-Warnungen an kompakt UND befunde', () => {
    const sig = { ...FERTIG, befunde: [befund('warnung')] };
    expect(statusVonSchritt('kompakt', sig)).toBe('warn');
    expect(statusVonSchritt('befunde', sig)).toBe('warn');
  });

  it('wertet einen Fehler-Befund ebenfalls als Warnung der Navigation', () => {
    const sig = { ...FERTIG, befunde: [befund('fehler')] };
    expect(statusVonSchritt('kompakt', sig)).toBe('warn');
  });

  it('lässt reine Hinweise den Schritt fertig sein', () => {
    const sig = { ...FERTIG, befunde: [befund('hinweis')] };
    expect(hatWarnBefund(sig.befunde)).toBe(false);
    expect(statusVonSchritt('kompakt', sig)).toBe('done');
  });

  it('bindet die Vorhabensbeschreibung an die Zuordnung', () => {
    expect(statusVonSchritt('vb', LEER)).toBe('todo');
    expect(statusVonSchritt('vb', { ...LEER, vbZugeordnet: true })).toBe('done');
  });

  it('bindet Canvas, Delta und Wirkung an den Analyse-Lauf', () => {
    for (const s of ['canvas', 'delta', 'wirkung'] as const) {
      expect(statusVonSchritt(s, LEER)).toBe('todo');
      expect(statusVonSchritt(s, { ...LEER, infografikDa: true })).toBe('done');
    }
  });

  it('verlangt für den Lesemodus Zuordnung UND Besuch', () => {
    const besucht = new Set(['reader']);
    expect(statusVonSchritt('reader', { ...LEER, besucht })).toBe('todo');
    expect(statusVonSchritt('reader', { ...LEER, vbZugeordnet: true })).toBe('todo');
    expect(statusVonSchritt('reader', { ...LEER, vbZugeordnet: true, besucht })).toBe('done');
  });

  it('staffelt die Bewertung todo → partial → done', () => {
    const mit = (erledigt: number, gesamt: number): StatusSignale =>
      ({ ...LEER, fortschritt: { erledigt, gesamt } });
    expect(statusVonSchritt('pruefung', LEER)).toBe('todo');
    expect(statusVonSchritt('pruefung', mit(0, 9))).toBe('todo');
    expect(statusVonSchritt('pruefung', mit(4, 9))).toBe('partial');
    expect(statusVonSchritt('pruefung', mit(9, 9))).toBe('done');
  });

  it('bindet den Abschluss an die Abschlussbereitschaft', () => {
    expect(statusVonSchritt('abschluss', LEER)).toBe('todo');
    expect(statusVonSchritt('abschluss', { ...LEER, abschlussbereit: true })).toBe('done');
  });
});

describe('naechsterOffenerSchritt', () => {
  it('zeigt nach dem Import auf die Vorhabensbeschreibung', () => {
    // kompakt/befunde sind ohne Befund bereits „done" — der erste echte
    // Handgriff des Prüfers ist die VB-Zuordnung.
    expect(naechsterOffenerSchritt(LEER)).toBe('vb');
  });

  it('zeigt auf den Rechencheck, sobald dort eine Warnung liegt', () => {
    expect(naechsterOffenerSchritt({ ...LEER, befunde: [befund('warnung')] })).toBe('kompakt');
  });

  it('überspringt Erledigtes und findet die angefangene Bewertung', () => {
    expect(naechsterOffenerSchritt({
      ...FERTIG, fortschritt: { erledigt: 3, gesamt: 9 }, abschlussbereit: false,
    })).toBe('pruefung');
  });

  it('liefert null, wenn der ganze Ablauf erledigt ist', () => {
    expect(naechsterOffenerSchritt(FERTIG)).toBeNull();
  });
});

describe('Phasen- und Ablauf-Fortschritt', () => {
  it('meldet alle drei Phasen fertig, wenn alles erledigt ist', () => {
    expect(PHASEN.every(p => phaseIstFertig(p, FERTIG))).toBe(true);
    expect(ablaufFortschritt(FERTIG)).toBe(1);
  });

  it('hält eine Phase offen, solange ein einzelner Schritt fehlt', () => {
    const sig = { ...FERTIG, vbZugeordnet: false };
    expect(phaseIstFertig(PHASEN[0]!, sig)).toBe(false);
    expect(phaseIstFertig(PHASEN[1]!, sig)).toBe(true);
    expect(ablaufFortschritt(sig)).toBeLessThan(1);
  });
});

describe('Regressionsschutz: Fortschritt stammt aus der Checkliste', () => {
  // Der Prototyp verglich gegen ein konstantes TOTAL_CRIT = 23, während real
  // neun Kriterien existierten. Folge: nie „done", Phase 2/3 nie grün.
  it('wird bei JEDER Kriterienzahl fertig, nicht nur bei einer bestimmten', () => {
    for (const gesamt of [1, 3, 9, 23, 47]) {
      const sig: StatusSignale = {
        ...FERTIG, fortschritt: { erledigt: gesamt, gesamt },
      };
      expect(statusVonSchritt('pruefung', sig)).toBe('done');
      expect(phaseIstFertig(PHASEN[1]!, sig)).toBe(true);
    }
  });

  it('erreicht mit wachsender Checkliste weiterhin 100 % Ablauf-Fortschritt', () => {
    const sig: StatusSignale = { ...FERTIG, fortschritt: { erledigt: 47, gesamt: 47 } };
    expect(ablaufFortschritt(sig)).toBe(1);
  });

  it('kennt keine Kriterien-Konstante im Modul', async () => {
    const quelle = await import('node:fs/promises')
      .then(fs => fs.readFile(
        new URL('../ansicht/schritte.ts', import.meta.url), 'utf-8',
      ));
    // Eine feste Gesamtzahl im Schrittmodell wäre exakt der Prototyp-Fehler.
    expect(quelle).not.toMatch(/TOTAL_CRIT|GESAMT_KRITERIEN/);
  });
});

describe('Vollständigkeit', () => {
  it('liefert für jeden Schritt in jedem Signalzustand einen Status', () => {
    const zustaende: StatusSignale[] = [LEER, FERTIG, { ...LEER, befunde: [befund('warnung')] }];
    const erlaubt = ['done', 'warn', 'partial', 'todo'];
    for (const sig of zustaende) {
      for (const s of SCHRITT_ORDER as readonly SchrittKey[]) {
        expect(erlaubt).toContain(statusVonSchritt(s, sig));
      }
    }
  });
});
