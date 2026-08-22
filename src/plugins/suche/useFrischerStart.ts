/**
 * Die Suche beginnt im Startzustand — außer man kommt aus einer Detailseite
 * zurück, in die man von hier gesprungen ist.
 *
 * Gemeldet (v6.10): wer die Suche über die Navigation aufrief, fand den
 * Suchterm von vorhin im Feld und dahinter dessen Trefferliste. Der Einstieg —
 * Zuletzt, Top Ten, Suchsprache, Fragen — war damit unerreichbar, obwohl
 * niemand die alte Suche angefordert hatte.
 *
 * Die Anfrage einfach bei jedem Betreten zu verwerfen wäre der falsche Schnitt:
 * sie liegt seit v3.50 im Store und seit v4.83 in `sessionStorage`, WEIL der
 * Klick auf einen Treffer die Suchseite ausbaut. Ohne sie wäre der Weg zurück
 * eine Sackgasse — leeres Feld, keine Treffer, und das ausgerechnet in dem
 * Moment, in dem jemand nur kurz nachsehen wollte.
 *
 * Also überlebt die Anfrage genau EINEN Sprung, und die Regel dafür steht rein
 * in [sitzungsAnfrage.ts](./sitzungsAnfrage.ts) (`anfrageUeberlebt`). Hier
 * bleibt nur, wann sie gefragt wird.
 *
 * Der VERLAUF bleibt davon unberührt: er liegt in `localStorage` und erscheint
 * beim ersten Tastendruck wieder — genau der Ort, an dem eine alte Anfrage
 * hilft, statt im Weg zu stehen.
 */
import { useLayoutEffect, useRef } from 'react';
import { herkunftJetzt } from '@/core/nav/herkunft';
import { anfrageUeberlebt, nimmSprungVermerk } from './sitzungsAnfrage';
import { useSucheStore } from './store';

/**
 * `useLayoutEffect`, damit der alte Suchterm nicht für einen Bildaufbau im Feld
 * steht, bevor er verschwindet.
 *
 * Die Entscheidung fällt EINMAL je Besuch (`entschieden`): der StrictMode fährt
 * jeden Mount-Effekt zweimal, und der zweite Lauf fände den beim ersten
 * verbrauchten Sprung-Vermerk nicht mehr — er verwürfe die Anfrage, die der
 * erste gerade gerettet hat.
 */
export function useFrischerStart(): void {
  const entschieden = useRef(false);
  useLayoutEffect(() => {
    if (entschieden.current) return;
    entschieden.current = true;
    if (!anfrageUeberlebt(nimmSprungVermerk(), herkunftJetzt()?.route ?? null)) {
      useSucheStore.getState().verwerfeAnfrage();
    }
  }, []);
}
