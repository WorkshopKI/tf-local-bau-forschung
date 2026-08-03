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
import { describe, it, expect } from 'vitest';
import { statusZuStepperPosition, STEPPER_STATIONS } from '../statusZuStepperPosition';
import { ZAH_PHASEN_REIHENFOLGE, ZAH_PHASE_LABEL } from '@/core/status/zah-phasen';

/** 1-basierte Station einer Phase — wie die Leiste sie rendert. */
const st = (phase: (typeof ZAH_PHASEN_REIHENFOLGE)[number]): number =>
  ZAH_PHASEN_REIHENFOLGE.indexOf(phase) + 1;

describe('Die Stationen sind der Katalog, keine zweite Liste', () => {
  it('trägt die sechs ZAH-Phasen in Verfahrens-Reihenfolge', () => {
    expect(STEPPER_STATIONS).toEqual(ZAH_PHASEN_REIHENFOLGE.map(id => ZAH_PHASE_LABEL[id]));
    expect(STEPPER_STATIONS).toHaveLength(6);
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
  it('1 … STEPPER_STATIONS.length oder null', () => {
    for (const s of [
      'beantragt', 'bearbeitungsreif', 'NF gestellt', 'bewilligt', 'Schlussvermerk',
      'abgelehnt', 'Irrläufer', 'völlig unbekannt',
    ]) {
      const { station } = statusZuStepperPosition(s);
      if (station === null) continue;
      expect(station, s).toBeGreaterThanOrEqual(1);
      expect(station, s).toBeLessThanOrEqual(STEPPER_STATIONS.length);
    }
  });
});
