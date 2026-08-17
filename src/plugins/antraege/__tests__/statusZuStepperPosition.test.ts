/**
 * Amtlicher Status → Position auf der ZAH-Phasen-Leiste.
 *
 * Seit v2.384 sind die Stationen die **sechs ZAH-Phasen** des Status-Katalogs,
 * nicht mehr die fünf abgeleiteten Spine-Stationen. Drei Zusagen tragen den
 * Umbau:
 *
 * 1. Die Position kommt aus dem **amtlichen Code**, nicht aus einem WorkflowRun
 *    und nicht aus Roh-Literalen (Pitfall #12).
 * 2. **Marker sind keine Stufe** — sie laufen neben dem Verfahren und bekommen
 *    `station: null`.
 * 3. **„Wir wissen es nicht" ist nicht „ganz am Anfang"** — ein Status ohne
 *    Katalog-Treffer landet nicht auf Station 1.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { statusZuStepperPosition, getStepperStations } from '../statusZuStepperPosition';
import {
  SEED_ZAH_PHASEN, resetZahPhasenSnapshotFuerTests, setZahPhasenSnapshot,
} from '@/core/status/zah-phasen';
import type { ZahPhase } from '@/core/status/typen';

/** 1-basierte Station einer Phase — wie die Leiste sie rendert. */
const st = (phase: string): number => SEED_ZAH_PHASEN.findIndex(p => p.id === phase) + 1;

afterEach(() => resetZahPhasenSnapshotFuerTests());

describe('Die Stationen sind der Katalog, keine zweite Liste', () => {
  it('trägt die sechs ausgelieferten ZAH-Phasen in Verfahrens-Reihenfolge', () => {
    expect(getStepperStations()).toEqual(
      SEED_ZAH_PHASEN.map(p => ({ id: p.id, label: p.label })),
    );
    expect(getStepperStations()).toHaveLength(6);
  });
});

describe('statusZuStepperPosition — die Phase des amtlichen Status', () => {
  it('Eingang: Skizze, beantragt', () => {
    for (const s of ['Skizze eingegangen', 'beantragt']) {
      expect(statusZuStepperPosition(s), s).toEqual({ station: st('eingang') });
    }
  });

  it('Vollständigkeit: unvollständig, bearbeitungsreif, NF/NL/keine weiteren NF', () => {
    for (const s of ['unvollständig', 'bearbeitungsreif', 'NF gestellt', 'NL eingegangen', 'keine weiteren NF']) {
      expect(statusZuStepperPosition(s), s).toEqual({ station: st('vollstaendigkeit') });
    }
    // Groß-/Kleinschreibung und gepflegte Varianten treffen ebenso.
    expect(statusZuStepperPosition('nl eingegangen')).toEqual({ station: st('vollstaendigkeit') });
    expect(statusZuStepperPosition('Nachforderung gestellt')).toEqual({ station: st('vollstaendigkeit') });
  });

  it('Prüfung: techn/kaufm geprüft, Gutachten fertig', () => {
    for (const s of ['techn geprüft', 'kaufm geprüft', 'Gutachten fertig', 'technisch geprüft']) {
      expect(statusZuStepperPosition(s), s).toEqual({ station: st('pruefung') });
    }
  });

  it('Entscheidung: ablehnungsreif, Bewilligungsentwurf, RNE-Strecke, Widerspruch', () => {
    for (const s of [
      'ablehnungsreif', 'Bewilligungsentwurf VDI/VDE-IT', 'bewilligungsreif',
      'Ablehnung', 'Rücknahmeempfehlung', 'Stellungnahme zur Rücknahmeempfehlung',
      'Widerspruch zur Ablehnung',
    ]) {
      expect(statusZuStepperPosition(s), s).toEqual({ station: st('entscheidung') });
    }
  });

  it('Begleitung: bewilligt, Widerruf-Strecke, VN-Prüfung', () => {
    for (const s of ['bewilligt', 'Anhörung zum Widerruf', 'Widerruf', 'VN techn. geprüft', 'VN geprüft']) {
      expect(statusZuStepperPosition(s), s).toEqual({ station: st('begleitung') });
    }
  });

  it('Abgeschlossen: abgebrochen, beendet, Schlussvermerk', () => {
    for (const s of ['abgebrochen', 'beendet', 'Schlussvermerk']) {
      expect(statusZuStepperPosition(s), s).toEqual({ station: st('abgeschlossen') });
    }
  });
});

describe('Terminal-negativ bricht an der Abschluss-Station ab', () => {
  it('Förderantrag `abgelehnt/zurückgezogen`', () => {
    expect(statusZuStepperPosition('abgelehnt/zurückgezogen'))
      .toEqual({ station: st('abgeschlossen'), terminal: 'zurueckgezogen' });
  });

});

describe('Marker sind keine Stufe', () => {
  it('laufen ohne Station neben dem Verfahren', () => {
    for (const s of ['Irrläufer', 'Sonderstatus', 'assoziierter Partner', 'internationaler Partner']) {
      expect(statusZuStepperPosition(s), s).toEqual({ station: null, marker: true });
    }
  });

  it('„nicht im Katalog" ist NICHT Station 1', () => {
    // Vorher fielen diese Werte auf „Eingang" — die Leiste behauptete damit
    // einen Verfahrensstand, den die Daten nicht hergeben.
    for (const s of ['völlig unbekannt', '', '   ', null, undefined, 42]) {
      expect(statusZuStepperPosition(s as unknown), String(s)).toEqual({ station: null });
    }
  });
});

describe('Werte ohne amtlichen Code fallen auf die Kategorie zurück', () => {
  it('ordnet ein, was eine kuratierte Fassung einer Kategorie zuweist', () => {
    // Der Fallback ist Produktverhalten und wird hier direkt geprüft: dieselbe
    // Abbildung, die `stationAusKategorie` für jeden katalogfremden Wert fährt.
    expect(statusZuStepperPosition('beantragt')).toEqual({ station: st('eingang') });
    expect(statusZuStepperPosition('techn geprüft')).toEqual({ station: st('pruefung') });
  });
  it('unbekannte Werte bekommen KEINE Station (nicht Station 1)', () => {
    expect(statusZuStepperPosition('fantasieStatus42')).toEqual({ station: null });
  });

  it('das VN/ZB-Pattern greift weiter (Statuswerte ohne Code)', () => {
    expect(statusZuStepperPosition('ZB eingegangen')).toEqual({ station: st('begleitung') });
  });
});

describe('Jede gelieferte Station liegt im gültigen Bereich', () => {
  it('1 … Stationszahl oder null', () => {
    for (const s of [
      'beantragt', 'bearbeitungsreif', 'NF gestellt', 'bewilligt', 'Schlussvermerk',
      'abgelehnt', 'Irrläufer', 'völlig unbekannt',
    ]) {
      const { station } = statusZuStepperPosition(s);
      if (station === null) continue;
      expect(station, s).toBeGreaterThanOrEqual(1);
      expect(station, s).toBeLessThanOrEqual(getStepperStations().length);
    }
  });
});

/**
 * Der Schnitt ist seit v2.409 kuratierbar — 3 bis 9 Phasen. Die Leiste war auf
 * sechs gebaut: `stationVon` rechnete `indexOf + 1` und hätte für eine gelöschte
 * Phase Station **0** geliefert, und der Kategorie-Fallback nannte feste Ids,
 * die es in einem anderen Zuschnitt gar nicht gibt.
 */
describe('Die Leiste trägt jeden Zuschnitt zwischen 3 und 9 Phasen', () => {
  /** Ein Zuschnitt aus n Phasen; die letzte ist der Abschluss. */
  const schnitt = (n: number): ZahPhase[] => Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    label: `Schritt ${i + 1}`,
    reihenfolge: (i + 1) * 10,
    zieltageRelevant: i < n - 1,
  }));

  it('drei Phasen: Stationszahl folgt, terminal landet auf der letzten', () => {
    setZahPhasenSnapshot(schnitt(3));
    expect(getStepperStations()).toHaveLength(3);
    expect(statusZuStepperPosition('abgelehnt/zurückgezogen'))
      .toEqual({ station: 3, terminal: 'zurueckgezogen' });
  });

  it('neun Phasen: Stationszahl folgt', () => {
    setZahPhasenSnapshot(schnitt(9));
    expect(getStepperStations()).toHaveLength(9);
    expect(statusZuStepperPosition('abgelehnt/zurückgezogen'))
      .toEqual({ station: 9, terminal: 'zurueckgezogen' });
  });

  it('eine Zuordnung auf eine gelöschte Phase gibt KEINE Station 0', () => {
    // Der Schnitt kennt `p1…p3`; die Codes zeigen weiter auf `eingang` & Co.,
    // sind also sämtlich verwaist. Kein Schritt trägt danach eine Arbeitsliste —
    // die Näherung in `stationFuerKategorie` fängt das an den Rändern ab.
    setZahPhasenSnapshot(schnitt(3));
    const { station } = statusZuStepperPosition('beantragt');
    expect(station).not.toBe(0);
    // Über die Kategorie `offen` landet er auf der ersten Station.
    expect(station).toBe(1);
  });

  it('ohne Snapshot gilt wieder die Auslieferung', () => {
    setZahPhasenSnapshot(schnitt(3));
    resetZahPhasenSnapshotFuerTests();
    expect(getStepperStations()).toHaveLength(6);
    expect(statusZuStepperPosition('beantragt')).toEqual({ station: st('eingang') });
  });
});
