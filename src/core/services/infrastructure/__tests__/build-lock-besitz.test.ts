/**
 * Reine Besitz-Entscheider des Build-Locks (v3.46.1).
 *
 * Hintergrund: Bis v3.46.1 kannte `acquireBuildLock` nur „stale oder nicht".
 * Ein Lock, den der EIGENE Tab Sekunden zuvor hinterlassen hatte (ein noch
 * laufender Heartbeat-Schlag legte die gerade gelöschte Datei neu an), sah
 * damit aus wie ein fremder Schreiber — der Lauf brach ab und das Banner nannte
 * dem Nutzer seinen eigenen Namen als Blockierer.
 *
 * Die drei Funktionen hier sind rein → ohne SMB/IDB testbar, wie `isStale`.
 */
import { describe, it, expect } from 'vitest';
import { bestimmeLockBesitz, darfEigenenLockUebernehmen, bewerteFreigabe } from '../build-lock';

const ICH = 'owner-aaa';
const ANDERER = 'owner-bbb';
const NAME = 'THü (PL)';

describe('bestimmeLockBesitz', () => {
  it('gleiche owner_id → eigener Tab', () => {
    expect(bestimmeLockBesitz({ owner_id: ICH, kurator_name: NAME }, ICH, NAME)).toBe('eigener-tab');
  });

  it('andere owner_id, gleicher Name → anderes Fenster desselben Menschen', () => {
    expect(bestimmeLockBesitz({ owner_id: ANDERER, kurator_name: NAME }, ICH, NAME)).toBe('gleicher-name');
  });

  it('Alt-Lock ohne owner_id, gleicher Name → gleicher Name (nie „eigener Tab")', () => {
    expect(bestimmeLockBesitz({ kurator_name: NAME }, ICH, NAME)).toBe('gleicher-name');
  });

  it('fremder Name → fremd, mit und ohne owner_id', () => {
    expect(bestimmeLockBesitz({ owner_id: ANDERER, kurator_name: 'BIB' }, ICH, NAME)).toBe('fremd');
    expect(bestimmeLockBesitz({ kurator_name: 'BIB' }, ICH, NAME)).toBe('fremd');
  });

  it('ohne eigenen Namen bleibt ein fremder Lock fremd (kein Zufallstreffer)', () => {
    expect(bestimmeLockBesitz({ owner_id: ANDERER, kurator_name: NAME }, ICH)).toBe('fremd');
  });
});

describe('darfEigenenLockUebernehmen', () => {
  it('eigene Kennung + halte selbst NICHT → übernehmen (das Überbleibsel-Szenario)', () => {
    expect(darfEigenenLockUebernehmen({ owner_id: ICH }, ICH, false)).toBe(true);
  });

  it('eigene Kennung, aber wir halten den Lock gerade → NICHT übernehmen', () => {
    // Zweiter Flow im selben Tab (Dialog-Reimport während des Auto-Refresh):
    // der soll weiterhin blockieren statt sich den aktiven Lock zu nehmen.
    expect(darfEigenenLockUebernehmen({ owner_id: ICH }, ICH, true)).toBe(false);
  });

  it('fremde Kennung → nie übernehmen', () => {
    expect(darfEigenenLockUebernehmen({ owner_id: ANDERER }, ICH, false)).toBe(false);
  });

  it('Alt-Lock ohne owner_id → nie übernehmen (verhält sich wie vor v3.46.1)', () => {
    expect(darfEigenenLockUebernehmen({}, ICH, false)).toBe(false);
  });
});

describe('bewerteFreigabe', () => {
  it('nichts mehr da → freigegeben', () => {
    expect(bewerteFreigabe(null, ICH)).toBe('freigegeben');
  });

  it('eigene Kennung liegt noch/wieder da → noch-eigener (Löschen hat nicht gegriffen)', () => {
    expect(bewerteFreigabe({ owner_id: ICH }, ICH)).toBe('noch-eigener');
  });

  it('fremde Kennung → fremd-uebernommen, KEIN Fehlschlag', () => {
    expect(bewerteFreigabe({ owner_id: ANDERER }, ICH)).toBe('fremd-uebernommen');
    expect(bewerteFreigabe({}, ICH)).toBe('fremd-uebernommen');
  });
});
