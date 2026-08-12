import { describe, it, expect } from 'vitest';
import {
  wurzelLage,
  istNutzbar,
  alleGruppenVerbunden,
  sichtbareWurzeln,
} from '../wurzelLage';
import type { UserFoldersRoot } from '@/core/services/infrastructure/smb-handle';

const HANDLE = {} as FileSystemDirectoryHandle;

function gruppe(id: string, mitHandle = true): UserFoldersRoot {
  return { id, label: id.toUpperCase(), handle: mitHandle ? HANDLE : null, legacy: false };
}
function alt(): UserFoldersRoot {
  return { id: 'legacy', label: 'Bisheriger Ordner', handle: HANDLE, legacy: true };
}

describe('wurzelLage', () => {
  it('unterscheidet „nie gewaehlt" von „Berechtigung verfallen"', () => {
    expect(wurzelLage(gruppe('pl', false), {})).toBe('nicht-verbunden');
    expect(wurzelLage(gruppe('pl'), { pl: 'prompt' })).toBe('freigeben');
    expect(wurzelLage(gruppe('pl'), { pl: 'granted' })).toBe('verbunden');
  });

  it('istNutzbar verlangt Handle UND Freigabe', () => {
    expect(istNutzbar(gruppe('pl'), { pl: 'granted' })).toBe(true);
    expect(istNutzbar(gruppe('pl'), { pl: 'denied' })).toBe(false);
    // Ohne Handle ist der Zustandseintrag bedeutungslos — er darf nicht gewinnen.
    expect(istNutzbar(gruppe('pl', false), { pl: 'granted' })).toBe(false);
  });
});

describe('alleGruppenVerbunden', () => {
  const zustaende = { pl: 'granted', bearbeiter: 'granted', legacy: 'granted' } as const;

  it('true, sobald jede Gruppe lesbar ist', () => {
    expect(alleGruppenVerbunden([gruppe('pl'), gruppe('bearbeiter')], { ...zustaende })).toBe(true);
  });

  it('false, solange eine Gruppe offen ist', () => {
    expect(alleGruppenVerbunden(
      [gruppe('pl'), gruppe('bearbeiter')],
      { pl: 'granted', bearbeiter: 'prompt' },
    )).toBe(false);
  });

  it('zaehlt den Alt-Ordner NICHT mit — er ist der Abgeloeste, nicht der Nachfolger', () => {
    expect(alleGruppenVerbunden([gruppe('pl'), alt()], { pl: 'granted', legacy: 'prompt' })).toBe(true);
  });

  it('false ohne konfigurierte Gruppe — ohne Nachfolger loest niemand ab', () => {
    expect(alleGruppenVerbunden([alt()], { legacy: 'granted' })).toBe(false);
    expect(alleGruppenVerbunden([], {})).toBe(false);
  });
});

describe('sichtbareWurzeln', () => {
  it('blendet verbundene Gruppen aus — sie sind keine Aufgabe mehr', () => {
    const zeilen = sichtbareWurzeln(
      [gruppe('pl'), gruppe('bearbeiter')],
      { pl: 'granted', bearbeiter: 'prompt' },
    );
    expect(zeilen.map(r => r.id)).toEqual(['bearbeiter']);
  });

  it('haelt den Alt-Ordner sichtbar, AUCH wenn er gerade lesbar ist', () => {
    // Sonst verschwaende „Erneut freigeben" den einzigen Weg, ihn loszuwerden:
    // die Zeile mit dem Entfernen-Knopf waere im Erfolgsfall selbst weg.
    const zeilen = sichtbareWurzeln(
      [gruppe('pl'), alt()],
      { pl: 'granted', legacy: 'granted' },
    );
    expect(zeilen.map(r => r.id)).toEqual(['legacy']);
  });

  it('zeigt mit nurOffene=false alles, in Config-Reihenfolge', () => {
    const wurzeln = [gruppe('pl'), gruppe('bearbeiter'), alt()];
    const zeilen = sichtbareWurzeln(wurzeln, { pl: 'granted', bearbeiter: 'granted', legacy: 'granted' }, false);
    expect(zeilen.map(r => r.id)).toEqual(['pl', 'bearbeiter', 'legacy']);
  });

  it('gibt nichts zurueck, wenn alles verbunden und der Alt-Ordner entfernt ist', () => {
    expect(sichtbareWurzeln(
      [gruppe('pl'), gruppe('bearbeiter')],
      { pl: 'granted', bearbeiter: 'granted' },
    )).toEqual([]);
  });
});
