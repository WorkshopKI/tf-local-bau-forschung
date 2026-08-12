/**
 * `jeWurzel` + Bericht: Teil-Einsammeln darf nicht wie Erfolg aussehen.
 *
 * Zwei Zusagen werden hier festgenagelt, weil beide unsichtbar brechen:
 *  - STRENG SEQUENZIELL — die Feedback-Sammler schreiben dieselbe `feedback.json`
 *    ohne Lock, parallel verlöre der zweite Write die Items des ersten.
 *  - JEDE Wurzel kommt im Bericht vor, auch die nicht verbundene.
 */
import { describe, it, expect } from 'vitest';
import {
  jeWurzel,
  formatiereSammelBericht,
  hatGelesen,
  summeGelesen,
} from '../sammelBericht';
import type { UserFoldersRoot } from '@/core/services/infrastructure/smb-handle';

const handle = {} as FileSystemDirectoryHandle;

function wurzel(id: string, label: string, verbunden = true): UserFoldersRoot {
  return { id, label, handle: verbunden ? handle : null, legacy: false };
}

const PL = wurzel('pl', 'PL-Ordner');
const BEARB_OHNE = wurzel('bearbeiter', 'Bearbeiter-Ordner', false);

describe('jeWurzel', () => {
  it('liest nur verbundene Wurzeln, führt die anderen aber im Bericht', async () => {
    const gelesen: string[] = [];
    const bericht = await jeWurzel([PL, BEARB_OHNE], async root => {
      gelesen.push(root.id);
      return 4;
    });

    expect(gelesen).toEqual(['pl']);
    expect(bericht).toEqual([
      { id: 'pl', label: 'PL-Ordner', ausgang: { art: 'ok', anzahl: 4 } },
      { id: 'bearbeiter', label: 'Bearbeiter-Ordner', ausgang: { art: 'nicht-verbunden' } },
    ]);
  });

  it('ruft `lies` STRENG SEQUENZIELL auf, nie überlappend', async () => {
    const protokoll: string[] = [];
    let offen = 0;
    await jeWurzel([PL, wurzel('bearbeiter', 'Bearbeiter-Ordner')], async root => {
      offen++;
      expect(offen).toBe(1); // nie zwei gleichzeitig
      protokoll.push(`start:${root.id}`);
      await new Promise(r => setTimeout(r, 5));
      protokoll.push(`ende:${root.id}`);
      offen--;
      return 1;
    });

    expect(protokoll).toEqual(['start:pl', 'ende:pl', 'start:bearbeiter', 'ende:bearbeiter']);
  });

  it('isoliert Fehler je Wurzel — die nächste läuft weiter', async () => {
    const bericht = await jeWurzel(
      [PL, wurzel('bearbeiter', 'Bearbeiter-Ordner')],
      async root => {
        if (root.id === 'pl') throw new Error('Zugriff verweigert');
        return 2;
      },
    );

    expect(bericht[0]?.ausgang).toEqual({ art: 'fehler', meldung: 'Zugriff verweigert' });
    expect(bericht[1]?.ausgang).toEqual({ art: 'ok', anzahl: 2 });
  });

  it('wirft selbst nie', async () => {
    await expect(jeWurzel([PL], async () => { throw new Error('x'); })).resolves.toHaveLength(1);
  });

  it('haelt „nicht gelesen" von „nichts gefunden" getrennt', async () => {
    // Die Timer-Pfade lesen eine Wurzel mit verfallener Berechtigung gar nicht
    // erst an. Als 0 gemeldet saehe sie aus wie ein leerer Ordner.
    const bericht = await jeWurzel([PL], async () => 'kein-zugriff');
    expect(bericht[0]?.ausgang).toEqual({ art: 'kein-zugriff' });
    expect(hatGelesen(bericht)).toBe(false);
    expect(formatiereSammelBericht(bericht)).toBe('PL-Ordner: kein Zugriff');
  });
});

describe('formatiereSammelBericht', () => {
  it('nennt jede Wurzel mit ihrem Zustand', async () => {
    const bericht = await jeWurzel([PL, BEARB_OHNE], async () => 4);
    expect(formatiereSammelBericht(bericht)).toBe(
      'PL-Ordner: 4 eingesammelt · Bearbeiter-Ordner: nicht verbunden',
    );
  });

  it('schreibt 0 AUS, statt die Wurzel wegzulassen', async () => {
    // „gelesen, nichts gefunden" ist eine andere Aussage als „gar nicht gelesen".
    const bericht = await jeWurzel([PL], async () => 0);
    expect(formatiereSammelBericht(bericht)).toBe('PL-Ordner: 0 eingesammelt');
  });

  it('nimmt eine eigene Einheit', async () => {
    const bericht = await jeWurzel([PL], async () => 3);
    expect(formatiereSammelBericht(bericht, { einheit: 'Profil(e) gelesen' }))
      .toBe('PL-Ordner: 3 Profil(e) gelesen');
  });

  it('benennt Fehler, ohne die Rohmeldung in die Zeile zu ziehen', async () => {
    const bericht = await jeWurzel([PL], async () => { throw new Error('NotAllowedError'); });
    expect(formatiereSammelBericht(bericht)).toBe('PL-Ordner: Fehler beim Lesen');
  });
});

describe('hatGelesen / summeGelesen', () => {
  it('erkennt, ob überhaupt irgendwo gelesen wurde', async () => {
    expect(hatGelesen(await jeWurzel([BEARB_OHNE], async () => 1))).toBe(false);
    expect(hatGelesen(await jeWurzel([PL], async () => 0))).toBe(true);
  });

  it('summiert nur die gelesenen Wurzeln', async () => {
    const bericht = await jeWurzel([PL, BEARB_OHNE], async () => 4);
    expect(summeGelesen(bericht)).toBe(4);
  });
});
