/**
 * Die beiden reinen Bausteine des Bestandslaufs.
 *
 * Verschoben aus `plugins/vorgangs-board/__tests__/boardFilter.test.ts`: die
 * Frage „läuft hier noch eine Frist?" gehört zum Lauf, nicht zu den Filtern des
 * Boards — seit v4.132 lesen ihn auch Startseite und Förderanträge-Liste.
 */
import { describe, expect, it } from 'vitest';
import { fristLaeuftFuer, schmalerFilterSatz } from '@/core/status/bestands-lauf';

/*
 * Bis v4.3 stand hier eine feste Menge von vier Phasen-Ids im Hook. Sobald die
 * PL den Schnitt umhängt, traf sie daneben — lautlos. Diese Tests halten fest,
 * dass die Antwort aus der Fassung kommt.
 */
describe('fristLaeuftFuer', () => {
  // Rohtexte aus STATUS_CODE_KATALOG: 73 terminal, 97 Begleitung, 38 in Prüfung.
  const TERMINAL = 'abgelehnt/zurückgezogen';
  const BEGLEITUNG = 'VN geprüft';
  const IN_PRUEFUNG = 'techn geprüft';

  it('hält die Uhr bei terminalen Vorgängen an — unabhängig von der Phase', () => {
    expect(fristLaeuftFuer('eingang', TERMINAL)).toBe(false);
    expect(fristLaeuftFuer(null, TERMINAL)).toBe(false);
  });

  it('lässt sie in der Begleitphase laufen: dort gilt die echte VN-Frist', () => {
    expect(fristLaeuftFuer('begleitung', BEGLEITUNG)).toBe(true);
  });

  it('folgt ohne Fassung dem ausgelieferten Schnitt', () => {
    expect(fristLaeuftFuer('eingang', IN_PRUEFUNG)).toBe(true);
    // Der Auslieferungs-Seed hält die Uhr in der Entscheidung an: die
    // Antragsfrist misst die Bearbeitung BIS zur Entscheidung.
    expect(fristLaeuftFuer('entscheidung', IN_PRUEFUNG)).toBe(false);
  });

  it('lässt sie bei unbekannter oder verwaister Phase laufen', () => {
    expect(fristLaeuftFuer(null, IN_PRUEFUNG)).toBe(true);
    expect(fristLaeuftFuer('gibt-es-nicht', IN_PRUEFUNG)).toBe(true);
  });

  // Der eigentliche Regressionsbeleg: eine NEU geschnittene Phase, die es im
  // Seed nicht gibt. Die alte feste Menge hätte sie nie erfasst.
  it('folgt der kuratierten Fassung, auch bei einer frisch angelegten Phase', () => {
    const fassung = [
      { id: 'erstsichtung', label: 'Erstsichtung', reihenfolge: 10, fristLaeuft: true },
      { id: 'erstsichtung-qs', label: 'QS der Erstsichtung', reihenfolge: 20, fristLaeuft: false },
    ];
    expect(fristLaeuftFuer('erstsichtung', IN_PRUEFUNG, fassung)).toBe(true);
    expect(fristLaeuftFuer('erstsichtung-qs', IN_PRUEFUNG, fassung)).toBe(false);
    // Terminal schlägt die Fassung weiter — der Sonderfall hängt am Status.
    expect(fristLaeuftFuer('erstsichtung', TERMINAL, fassung)).toBe(false);
  });
});

describe('schmalerFilterSatz', () => {
  it('nimmt die Filter-Spalten mit und lässt den Rest liegen', () => {
    const satz = schmalerFilterSatz({
      status: 'bewilligt', tib_kuerz: 'THü', titel: 'Ein sehr langer Titel', vb_phase: 3,
    });
    expect(satz.status).toBe('bewilligt');
    expect(satz.tib_kuerz).toBe('THü');
    // Der Grund für die Projektion: über 12 000 Zeilen hielte der volle Record
    // den ganzen Bestand im Speicher fest.
    expect(Object.keys(satz)).toEqual(['status', 'tib_kuerz']);
  });

  it('behält gemischt geschriebene Spalten — sonst fielen sie still aus dem Filter', () => {
    const satz = schmalerFilterSatz({ ZTP_KUERZ: 'THü' }) as unknown as Record<string, string>;
    expect(satz.ZTP_KUERZ).toBe('THü');
  });

  it('überspringt Nicht-Zeichenketten (eine Zahl ist kein Kürzel)', () => {
    const satz = schmalerFilterSatz({ tib_kuerz: 42 });
    expect(Object.keys(satz)).toEqual([]);
  });
});
